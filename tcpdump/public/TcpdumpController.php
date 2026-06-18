<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\tcpdump;

use frieren\helper\OpenWrtHelper;

class TcpdumpController extends \frieren\core\Controller
{
    // User-saved capture presets, stored in the plugin's own folder. Built-in
    // presets ship in the frontend; only operator-created ones are stored here.
    const PRESETS_FILE = 'presets.json';
    const MAX_PRESETS = 50;
    const PRESET_NAME_REGEX = '/^[A-Za-z0-9 ._+()-]{1,40}$/';

    private $pcapDirectory = '/root/.tcpdump';
    private $logPath = '/tmp/fm-tcpdump.log';

    protected $endpointRoutes = [
        //'checkModuleDependencies' => true,
        'installModuleDependencies' => true,
        'getDependencyInstallationStatus' => true,
        'startCapture' => true,
        'stopCapture' => true,
        'getCaptureHistory' => true,
        'getCaptureOutput' => true,
        'getLogContent' => true,
        'deleteCapture' => true,
        'deleteAll' => true,
        'moduleStatus' => true,
        'getPresets' => true,
        'savePreset' => true,
        'deletePreset' => true,
    ];

    public function startCapture()
    {
        if (!isset($this->request['command'])) {
            return self::setError('No command provided');
        }

        // block tcpdump -z (postrotate command) — would allow arbitrary command execution
        if (preg_match('/(^|\s)-z(\s|=|$)/', $this->request['command'])) {
            return self::setError('The -z postrotate option is not allowed');
        }

        // block tcpdump -r reading a savefile outside the capture dir (arbitrary file read)
        if (preg_match('/(^|\s)-r[\s=]+(\S+)/', $this->request['command'], $m)) {
            $readPath = trim($m[2], "'\"");
            if (strpos($readPath, "{$this->pcapDirectory}/") !== 0) {
                return self::setError('Reading capture files outside the module directory is not allowed');
            }
        }

        $filename = date('Y-m-d\TH-i-s') . '.pcap';
        $pcapFilePath = "{$this->pcapDirectory}/{$filename}";
        $command = escapeshellcmd($this->request['command']);
        $this->logger("tcpdump capture started on {$filename}", 'info');
        OpenWrtHelper::execBackground("tcpdump {$command} -w {$pcapFilePath}", "{$this->logPath} 2>&1");

        return self::setSuccess([
            'outputFile' => $filename
        ]);
    }

    public function stopCapture()
    {
        OpenWrtHelper::exec('killall -9 tcpdump');

        return self::setSuccess([
            'success' => OpenWrtHelper::checkRunning('tcpdump')
        ]);
    }

    public function getCaptureHistory()
    {
        $files = array_diff(scandir($this->pcapDirectory), ['..', '.']);
        $files = array_filter($files, function($file) {
            return is_file("{$this->pcapDirectory}/{$file}");
        });

        return self::setSuccess(['files' => array_values($files)]);
    }

    public function getCaptureOutput()
    {
        $captureName = $this->request['outputFile'] ?? false;
        if (empty($captureName)) {
            // grab last saved capture (skip . and .. — only real files)
            $folder = array_values(array_filter(
                scandir($this->pcapDirectory, SCANDIR_SORT_DESCENDING),
                fn($file) => is_file("{$this->pcapDirectory}/{$file}")
            ));
            $captureName = $folder[0] ?? null;
            if ($captureName === null) {
                return self::setError('No capture output available');
            }
        }

        // prevent path traversal via outputFile param
        $captureName = basename($captureName);
        $filePath = "{$this->pcapDirectory}/{$captureName}";
        if (!file_exists($filePath)) {
            return self::setError("Could not find capture output: {$filePath}");
        }

        $this->responseHandler->streamFile($filePath);
    }

    public function getLogContent()
    {
        if (!file_exists($this->logPath)) {
            return self::setError("Could not find log output: {$this->logPath}");
        }

        return self::setSuccess([
            'isRunning' => file_exists($this->logPath) && OpenWrtHelper::checkRunning('tcpdump'),
            'logContent' => file_get_contents($this->logPath)
        ]);
    }

    public function deleteCapture()
    {
        $filename = $this->request['filename'] ?? '';
        if (empty($filename)) {
            return self::setError('No filename provided');
        }

        // prevent path traversal via filename param
        $filename = basename($filename);
        $filePath = "{$this->pcapDirectory}/{$filename}";
        if (file_exists($filePath)) {
            unlink($filePath);
            return self::setSuccess();
        }

        return self::setError('File does not exist.');
    }

    public function deleteAll()
    {
        $files = array_diff(scandir($this->pcapDirectory), ['..', '.']);
        foreach ($files as $file) {
            $filePath = "{$this->pcapDirectory}/{$file}";
            if (is_file($filePath)) {
                unlink($filePath);
            }
        }

        return self::setSuccess();
    }

    private function getNetworkInterfaces()
    {
        $interfaces = scandir('/sys/class/net/');
        if ($interfaces === false) {
            return [];
        }

        return array_values(array_diff($interfaces, array('.', '..')));
    }

    /**
     * Detects which tcpdump package is installed. Both packages provide the same
     * /usr/sbin/tcpdump and the same CLI flags, but `tcpdump-mini` is built with
     * fewer protocol dissectors (less detailed verbose output). The frontend uses
     * this only to surface an informational notice — it does not gate any flag.
     *
     * @return string|null 'mini', 'full', or null when neither line is found.
     */
    private function getToolVariant()
    {
        $installed = OpenWrtHelper::exec('/bin/opkg list-installed');
        if ($installed === false) {
            return null;
        }
        if (strpos($installed, 'tcpdump-mini -') !== false) {
            return 'mini';
        }
        if (strpos($installed, 'tcpdump -') !== false) {
            return 'full';
        }

        return null;
    }

    public function moduleStatus()
    {
        // fix default folder
        if (!file_exists($this->pcapDirectory)) {
            mkdir($this->pcapDirectory, 0755, true);
        }

        // this dependency can be installed by two different packages, so I simplify the default checkModuleDependencies() check
        if (OpenWrtHelper::commandExists('tcpdump')) {
            return self::setSuccess([
                'hasDependencies' => true,
                'isRunning' => file_exists($this->logPath) && OpenWrtHelper::checkRunning('tcpdump'),
                'interfaces' => $this->getNetworkInterfaces(),
                // 'mini' | 'full' | null — informational only (mini has fewer decoders).
                'toolVariant' => $this->getToolVariant(),
            ]);
        }

        return self::setSuccess([
            'hasDependencies' => false,
            'message' => false,
            'isRunning' => false,
            'internalAvailable' => (disk_free_space('/') > self::MIN_DISK_SPACE) && \DeviceConfig::MODULE_USE_INTERNAL_STORAGE,
            'SDAvailable' => OpenWrtHelper::isSDAvailable() && \DeviceConfig::MODULE_USE_USB_STORAGE,
        ]);
    }

    /* --- Capture presets (operator-saved, device-persistent JSON) --- */

    private function presetsPath()
    {
        return self::getModulePath() . '/' . self::PRESETS_FILE;
    }

    private function readPresets()
    {
        $path = $this->presetsPath();
        if (!file_exists($path)) {
            return [];
        }
        $decoded = json_decode(file_get_contents($path), true);

        return is_array($decoded) ? array_values($decoded) : [];
    }

    private function writePresets($presets)
    {
        // The plugin folder already exists (module is installed), so no mkdir.
        return file_put_contents($this->presetsPath(), json_encode(array_values($presets), JSON_PRETTY_PRINT)) !== false;
    }

    public function getPresets()
    {
        return self::setSuccess(['presets' => $this->readPresets()]);
    }

    public function savePreset()
    {
        $name = $this->request['name'] ?? '';
        if (!is_string($name) || !preg_match(self::PRESET_NAME_REGEX, $name)) {
            return self::setError('Invalid preset name (1-40 chars: letters, digits, space, _ -).');
        }

        $values = $this->request['values'] ?? null;
        if (!is_array($values)) {
            return self::setError('Invalid preset values');
        }

        // Upsert by name (overwrite an existing same-named preset).
        $presets = array_values(array_filter($this->readPresets(), function ($preset) use ($name) {
            return ($preset['name'] ?? '') !== $name;
        }));
        if (count($presets) >= self::MAX_PRESETS) {
            return self::setError('Preset limit reached (' . self::MAX_PRESETS . ').');
        }
        $presets[] = ['name' => $name, 'values' => $values];

        if (!$this->writePresets($presets)) {
            return self::setError('Failed to save preset');
        }

        return self::setSuccess(['presets' => $presets]);
    }

    public function deletePreset()
    {
        $name = $this->request['name'] ?? '';
        if (!is_string($name) || $name === '') {
            return self::setError('Invalid preset name');
        }

        $presets = array_values(array_filter($this->readPresets(), function ($preset) use ($name) {
            return ($preset['name'] ?? '') !== $name;
        }));

        if (!$this->writePresets($presets)) {
            return self::setError('Failed to delete preset');
        }

        return self::setSuccess(['presets' => $presets]);
    }
}
