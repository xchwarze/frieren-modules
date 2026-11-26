<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\handshakes;

use frieren\helper\OpenWrtHelper;
use frieren\helper\BackgroundTaskHelper;

class HandshakesController extends \frieren\core\Controller
{
    // Single background-task slot for a capture run. airodump-ng runs until it is
    // killed (stopCapture), at which point the task wrapper touches the flag and
    // getCaptureStatus resolves. isRunning() doubles as the concurrency guard.
    const TASK_CAPTURE = 'handshakes-capture';

    const LOG_PATH = '/tmp/fm-handshakes.log';
    const RUN_SCRIPT_PATH = '/tmp/fm-handshakes-run.sh';
    const CAPTURE_NAME_REGEX = '/^[A-Za-z0-9_.-]+\.(cap|pcap)$/i';
    const BSSID_REGEX = '/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/';
    const CHANNEL_MAX = 196;
    const DEAUTH_COUNT_MAX = 100;
    const BAND_OPTIONS = ['bg', 'a', 'abg'];

    protected $endpointRoutes = [
        // Pattern B: aircrack-ng is the only dependency and a single opkg check
        // covers it, but moduleStatus also reports the radio/storage snapshot the
        // UI needs, so the inherited checkModuleDependencies is not routed.
        'installModuleDependencies' => true,
        'getDependencyInstallationStatus' => true,
        'moduleStatus' => true,
        'startCapture' => true,
        'stopCapture' => true,
        'getCaptureStatus' => true,
        'getLogContent' => true,
        'getCaptureHistory' => true,
        'checkHandshake' => true,
        'downloadCapture' => true,
        'deleteCapture' => true,
        'deleteAll' => true,
    ];

    /**
     * Readiness + environment snapshot the UI renders: dependency state, the
     * current run, and the wireless interfaces available for capture.
     */
    public function moduleStatus()
    {
        // Materialise the storage dir so the UI can show it and its free space.
        $storagePath = ModuleOpenWrtHelper::getStoragePath();

        $payload = [
            'isRunning' => OpenWrtHelper::checkRunning('airodump-ng'),
            'interfaces' => ModuleOpenWrtHelper::getWirelessInterfaces(),
            'monitors' => ModuleOpenWrtHelper::getMonitorInterfaces(),
            'storagePath' => $storagePath,
            'storageFree' => @disk_free_space($storagePath) ?: 0,
        ];

        if (ModuleOpenWrtHelper::toolsAvailable()) {
            return self::setSuccess($payload + ['hasDependencies' => true]);
        }

        return self::setSuccess($payload + [
            'hasDependencies' => false,
            'message' => 'aircrack-ng is not installed.',
            'internalAvailable' => (disk_free_space('/') > self::MIN_DISK_SPACE) && \DeviceConfig::MODULE_USE_INTERNAL_STORAGE,
            'SDAvailable' => OpenWrtHelper::isSDAvailable() && \DeviceConfig::MODULE_USE_USB_STORAGE,
        ]);
    }

    /**
     * Start an airodump-ng capture on a monitor interface derived from the chosen
     * radio. Optionally fires a bounded aireplay-ng deauth burst against a target
     * AP to force clients to re-handshake.
     */
    public function startCapture()
    {
        if (OpenWrtHelper::checkRunning('airodump-ng')) {
            return self::setError('A capture is already running.');
        }

        $interface = (string)($this->request['interface'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_.-]+$/', $interface)) {
            return self::setError('Invalid interface.');
        }

        $channel = (int)($this->request['channel'] ?? 0);
        if ($channel !== 0 && ($channel < 1 || $channel > self::CHANNEL_MAX)) {
            return self::setError('Invalid channel.');
        }

        $band = (string)($this->request['band'] ?? '');
        if ($band !== '' && !in_array($band, self::BAND_OPTIONS, true)) {
            return self::setError('Invalid band.');
        }

        $bssid = trim((string)($this->request['bssid'] ?? ''));
        if ($bssid !== '' && !preg_match(self::BSSID_REGEX, $bssid)) {
            return self::setError('Invalid BSSID.');
        }

        $deauthCount = $channel !== 0 && $bssid !== '' ? (int)($this->request['deauthCount'] ?? 0) : 0;
        if ($deauthCount < 0 || $deauthCount > self::DEAUTH_COUNT_MAX) {
            return self::setError('Invalid deauth count.');
        }

        $monitor = ModuleOpenWrtHelper::ensureMonitorInterface($interface);
        if ($monitor === false) {
            return self::setError('Could not bring up a monitor interface on ' . $interface . ', and no other monitor is available.');
        }

        // Channel and deauth both require a locked channel; hop by band otherwise.
        if ($channel !== 0 && !ModuleOpenWrtHelper::setChannel($monitor, $channel)) {
            return self::setError('Could not set the monitor interface to channel ' . $channel . '.');
        }

        $prefix = ModuleOpenWrtHelper::getStoragePath() . '/' . date('Y-m-d\TH-i-s');
        $captureName = basename($prefix) . ModuleOpenWrtHelper::CAPTURE_SUFFIX;

        $arguments = '--output-format pcap,csv -w ' . escapeshellarg($prefix);
        if ($channel !== 0) {
            $arguments .= ' -c ' . escapeshellarg((string)$channel);
        } elseif ($band !== '') {
            $arguments .= ' --band ' . escapeshellarg($band);
        }
        if ($bssid !== '') {
            $arguments .= ' --bssid ' . escapeshellarg($bssid);
        }
        $arguments .= ' ' . escapeshellarg($monitor);

        // Optional deauth burst in the background: a short sleep lets airodump-ng
        // lock the channel first; the assume-y decoys are standard for aireplay-ng.
        $deauthLine = '';
        if ($deauthCount > 0) {
            $deauthLine = sprintf(
                "(sleep 4; aireplay-ng --deauth %d -a %s %s) &\n",
                $deauthCount,
                escapeshellarg($bssid),
                escapeshellarg($monitor)
            );
        }

        // Append to the module log so getLogContent can drain it while the capture
        // is live (airodump-ng repaints continuously and would grow it unbounded).
        file_put_contents(self::LOG_PATH, '');
        file_put_contents(
            self::RUN_SCRIPT_PATH,
            "#!/bin/sh\n" . $deauthLine . 'exec airodump-ng ' . $arguments . ' >> ' . escapeshellarg(self::LOG_PATH) . " 2>&1\n"
        );

        $this->logger("handshakes capture started: {$captureName}", 'info');
        BackgroundTaskHelper::start(self::TASK_CAPTURE, 'sh ' . escapeshellarg(self::RUN_SCRIPT_PATH));

        return self::setSuccess([
            'monitor' => $monitor,
            'captureFile' => $captureName,
        ]);
    }

    /**
     * Stop the running capture and tear the module monitor vif back down.
     */
    public function stopCapture()
    {
        OpenWrtHelper::exec('killall -9 airodump-ng', true, true);
        OpenWrtHelper::exec('killall -9 aireplay-ng', true, true);
        ModuleOpenWrtHelper::removeMonitorInterface();

        return self::setSuccess([
            'success' => !OpenWrtHelper::checkRunning('airodump-ng'),
        ]);
    }

    /**
     * Poll a running capture: {completed, isRunning, output}. `completed` is true
     * once the task wrapper has flagged the process as gone.
     */
    public function getCaptureStatus()
    {
        $status = BackgroundTaskHelper::getStatus(self::TASK_CAPTURE);
        $status['isRunning'] = OpenWrtHelper::checkRunning('airodump-ng') || BackgroundTaskHelper::isRunning(self::TASK_CAPTURE);

        return self::setSuccess($status);
    }

    /**
     * Drain the capture log (read + truncate) so the tmpfs file stays tiny while
     * airodump-ng repaints. The launcher runs in append mode, so the writer
     * resumes at offset 0 after each drain.
     */
    public function getLogContent()
    {
        if (!file_exists(self::LOG_PATH)) {
            return self::setError('No capture output yet.');
        }

        $chunk = '';
        $handle = fopen(self::LOG_PATH, 'r+');
        if ($handle !== false) {
            $chunk = stream_get_contents($handle);
            ftruncate($handle, 0);
            fclose($handle);
        }

        return self::setSuccess([
            'isRunning' => OpenWrtHelper::checkRunning('airodump-ng'),
            'chunk' => $chunk,
        ]);
    }

    /**
     * Captured files with size, mtime and the access points seen in each.
     */
    public function getCaptureHistory()
    {
        $captures = ModuleOpenWrtHelper::listCaptures();
        foreach ($captures as &$capture) {
            $capture['accessPoints'] = ModuleOpenWrtHelper::readCaptureAccessPoints($capture['name']);
        }
        unset($capture);

        return self::setSuccess(['captures' => $captures]);
    }

    /**
     * Run aircrack-ng against one capture and report the handshake/PMKID counts.
     */
    public function checkHandshake()
    {
        $captureName = $this->validatedCaptureName();
        if ($captureName === false) {
            return self::setError('Invalid capture file.');
        }

        $analysis = ModuleOpenWrtHelper::analyzeCapture($captureName);
        if ($analysis === false) {
            return self::setError('Could not analyze the capture.');
        }

        return self::setSuccess($analysis);
    }

    public function downloadCapture()
    {
        $captureName = $this->validatedCaptureName();
        if ($captureName === false) {
            return self::setError('Invalid capture file.');
        }

        $path = ModuleOpenWrtHelper::getStoragePath() . '/' . $captureName;
        if (!is_file($path)) {
            return self::setError('Capture not found.');
        }

        $this->responseHandler->streamFile($path);
    }

    public function deleteCapture()
    {
        $captureName = $this->validatedCaptureName();
        if ($captureName === false) {
            return self::setError('Invalid capture file.');
        }

        $path = ModuleOpenWrtHelper::getStoragePath() . '/' . $captureName;
        if (is_file($path)) {
            unlink($path);
            // airodump-ng writes a CSV/erp sidecar set next to the capture; clear them too.
            $base = substr($path, 0, -4);
            foreach (['-01.csv', '-01.kismet.csv', '-01.kismet.netxml', '-01.erp'] as $suffix) {
                if (is_file($base . $suffix)) {
                    unlink($base . $suffix);
                }
            }

            return self::setSuccess();
        }

        return self::setError('Capture does not exist.');
    }

    public function deleteAll()
    {
        foreach (ModuleOpenWrtHelper::listCaptures() as $capture) {
            $path = ModuleOpenWrtHelper::getStoragePath() . '/' . $capture['name'];
            if (is_file($path)) {
                unlink($path);
            }
        }

        return self::setSuccess();
    }

    /**
     * Validate a capture filename from the request. Returns the basename on
     * success, false otherwise — rejects any path traversal or unexpected file.
     *
     * @return string|false
     */
    private function validatedCaptureName()
    {
        $name = basename((string)($this->request['filename'] ?? ''));
        if ($name === '' || !preg_match(self::CAPTURE_NAME_REGEX, $name)) {
            return false;
        }

        return $name;
    }
}
