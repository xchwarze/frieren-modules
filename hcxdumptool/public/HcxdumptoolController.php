<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\hcxdumptool;

use frieren\helper\OpenWrtHelper;
use frieren\helper\BackgroundTaskHelper;

class HcxdumptoolController extends \frieren\core\Controller
{
    // Single background-task slot for the diagnostic info commands (-L / -C / -I /
    // --check_driver). They probe hardware and can be slow or hang, so they run via
    // BackgroundTaskHelper (start + poll getInfoStatus) instead of blocking a worker.
    const TASK_INFO = 'hcxdumptool-info';

    // User-saved capture presets, stored in the plugin's own folder. Built-in
    // presets ship in the frontend; only operator-created ones are stored here.
    const PRESETS_FILE = 'presets.json';
    const MAX_PRESETS = 50;
    const PRESET_NAME_REGEX = '/^[A-Za-z0-9 ._+()-]{1,40}$/';

    private $pcapDirectory = '/root/.hcxdumptool';
    private $logPath = '/tmp/fm-hcxdumptool.log';
    private $filterApPath = '/tmp/fm-hcxdumptool-filter-ap.txt';
    private $filterClientPath = '/tmp/fm-hcxdumptool-filter-client.txt';
    private $essidListPath = '/tmp/fm-hcxdumptool-essidlist.txt';
    private $bpfPath = '/tmp/fm-hcxdumptool-bpf.txt';
    private $runScriptPath = '/tmp/fm-hcxdumptool-run.sh';

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
        'listInterfaces' => true,
        'showChannels' => true,
        'interfaceInfo' => true,
        'checkDriver' => true,
        'getInfoStatus' => true,
        'stopInfo' => true,
        'getPresets' => true,
        'savePreset' => true,
        'deletePreset' => true,
    ];

    /**
     * Persist a newline separated list (filter list / essid list) to a file.
     * Each entry is trimmed; empty lines are dropped. Returns true when the
     * resulting file is non-empty, false otherwise (so callers can skip the flag).
     */
    private function writeListFile($path, $content)
    {
        $lines = preg_split('/\r\n|\r|\n/', (string)$content);
        $lines = array_filter(array_map('trim', $lines), function ($line) {
            return $line !== '';
        });

        if (empty($lines)) {
            if (file_exists($path)) {
                unlink($path);
            }

            return false;
        }

        file_put_contents($path, implode("\n", $lines) . "\n");

        return true;
    }

    public function startCapture()
    {
        if (!isset($this->request['command'])) {
            return self::setError('No command provided');
        }

        // The capture command is built version-specific by the frontend; the
        // multi-line list / BPF inputs are written to files here and the matching
        // flag appended. --essidlist works on both 6.2.x and 6.3.x. MAC filter lists
        // (--filterlist_ap/--filterlist_client + --filtermode) are 6.2.x-only; the
        // 6.3 rewrite dropped soft filter lists, so on 6.3.x a compiled BPF (--bpf)
        // replaces them. Append only the flags valid for the selected version so a
        // stale textarea never injects a flag that aborts the run.
        $toolBranch = $this->request['toolVersion'] ?? '6.3';
        $extraFlags = '';
        if ($this->writeListFile($this->essidListPath, $this->request['essidList'] ?? '')) {
            $extraFlags .= ' --essidlist=' . escapeshellarg($this->essidListPath);
        }
        if ($toolBranch === '6.2') {
            if ($this->writeListFile($this->filterApPath, $this->request['filterlistAp'] ?? '')) {
                $extraFlags .= ' --filterlist_ap=' . escapeshellarg($this->filterApPath);
            }
            if ($this->writeListFile($this->filterClientPath, $this->request['filterlistClient'] ?? '')) {
                $extraFlags .= ' --filterlist_client=' . escapeshellarg($this->filterClientPath);
            }
        } else {
            if ($this->writeListFile($this->bpfPath, $this->request['bpf'] ?? '')) {
                $extraFlags .= ' --bpf=' . escapeshellarg($this->bpfPath);
            }
        }

        $filename = date('Y-m-d\TH-i-s') . '.pcapng';
        $pcapFilePath = "{$this->pcapDirectory}/{$filename}";
        $command = escapeshellcmd($this->request['command']);

        // Run via a launcher script that APPENDS (>>) to the log. getLogContent
        // drains the log (read + truncate) every poll to keep the tmpfs file tiny
        // (--rds repaints continuously and would grow it unbounded); append mode
        // makes the writer resume at offset 0 after each drain instead of leaving
        // sparse gaps. The launcher keeps the redirect out of inline shell quoting.
        file_put_contents($this->logPath, '');
        file_put_contents(
            $this->runScriptPath,
            "#!/bin/sh\nhcxdumptool {$command}{$extraFlags} -w {$pcapFilePath} >> {$this->logPath} 2>&1\n"
        );
        OpenWrtHelper::execBackground('sh ' . escapeshellarg($this->runScriptPath));

        return self::setSuccess([
            'outputFile' => $filename
        ]);
    }

    public function stopCapture()
    {
        OpenWrtHelper::exec('killall -9 hcxdumptool');

        return self::setSuccess([
            'success' => OpenWrtHelper::checkRunning($this->pcapDirectory, true)
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
            // grab last saved capture (skip the leading "." and ".." entries)
            $folder = array_values(array_diff(
                scandir($this->pcapDirectory, SCANDIR_SORT_DESCENDING),
                ['.', '..']
            ));
            $captureName = $folder[0] ?? null;
        }

        if (empty($captureName)) {
            return self::setError('No capture output available');
        }

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

        // Drain: read whatever the capture has written, then truncate so the tmpfs
        // log stays tiny. hcxdumptool's --rds repaints continuously (cursor-control
        // escapes) and would otherwise grow the in-RAM log without bound. The writer
        // runs in append mode, so it resumes writing at offset 0 after the truncate;
        // the frontend just appends each chunk to the xterm viewer (frames repaint).
        // Single r+ handle (read+truncate on one fd) keeps the read/truncate window
        // minimal and saves an extra open()/close() per poll vs file_get/put_contents.
        $chunk = '';
        $handle = fopen($this->logPath, 'r+');
        if ($handle !== false) {
            $chunk = stream_get_contents($handle);
            ftruncate($handle, 0);
            fclose($handle);
        }

        return self::setSuccess([
            'isRunning' => OpenWrtHelper::checkRunning($this->pcapDirectory, true),
            'chunk' => $chunk,
        ]);
    }

    public function deleteCapture()
    {
        $filename = basename($this->request['filename'] ?? '');
        $filePath = "{$this->pcapDirectory}/{$filename}";
        if ($filename !== '' && file_exists($filePath)) {
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
     * Parses `hcxdumptool --version` (e.g. "hcxdumptool 6.3.4 (C) 2024 ZeroBeat")
     * into the full version + numeric major/minor. The 6.3.0 rewrite changed the
     * CLI heavily, so the frontend uses the major.minor branch to pick the right
     * flag set. Returns null when the tool is missing or the line can't be parsed.
     *
     * @return array{version:string, major:int, minor:int}|null
     */
    private function getToolVersion()
    {
        $output = OpenWrtHelper::exec('hcxdumptool --version 2>&1');
        if ($output === false || !preg_match('/hcxdumptool\s+(\d+)\.(\d+)\.(\d+)/i', $output, $m)) {
            return null;
        }

        return [
            'version' => "{$m[1]}.{$m[2]}.{$m[3]}",
            'major' => (int)$m[1],
            'minor' => (int)$m[2],
        ];
    }

    public function moduleStatus()
    {
        // fix default folder
        if (!file_exists($this->pcapDirectory)) {
            mkdir($this->pcapDirectory, 0755, true);
        }

        // this dependency can be installed by two different packages, so I simplify the default checkModuleDependencies() check
        if (OpenWrtHelper::commandExists('hcxdumptool')) {
            $version = $this->getToolVersion();

            return self::setSuccess([
                'hasDependencies' => true,
                'isRunning' => file_exists($this->logPath) && OpenWrtHelper::checkRunning($this->pcapDirectory, true),
                'interfaces' => $this->getNetworkInterfaces(),
                // Full version string + the major.minor branch the frontend uses to
                // default the tool-version selector (6.2.x vs 6.3.x have different CLIs).
                'toolVersion' => $version['version'] ?? null,
                'toolBranch' => $version ? "{$version['major']}.{$version['minor']}" : null,
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

    /**
     * True when the installed binary is the 6.3 rewrite (or newer), which dropped
     * -C / --check_driver and changed -L/-I. Defaults to true (6.3.x) when the
     * version cannot be parsed, since that is the current shipped baseline.
     */
    private function isRewriteCli()
    {
        $version = $this->getToolVersion();
        if ($version === null) {
            return true;
        }

        return $version['major'] > 6 || ($version['major'] === 6 && $version['minor'] >= 3);
    }

    /**
     * Launches an info/diagnostic command as the single TASK_INFO background task
     * and returns immediately. The frontend polls getInfoStatus for {completed,
     * output}. No `2>&1` here — BackgroundTaskHelper captures stdout+stderr.
     */
    private function startInfoTask($command)
    {
        BackgroundTaskHelper::start(self::TASK_INFO, $command);

        return self::setSuccess(['started' => true]);
    }

    public function listInterfaces()
    {
        // 6.3.x lists interfaces with -L; 6.2.x had no -L — the no-arg -I was the list.
        $flag = $this->isRewriteCli() ? '-L' : '-I';

        return $this->startInfoTask("hcxdumptool {$flag}");
    }

    public function showChannels()
    {
        // -C was removed in the 6.3 rewrite; surface a clear message instead of an
        // abort. On 6.3.x channel/band capability is part of -I <iface> (Interface Info).
        if ($this->isRewriteCli()) {
            return self::setError('Show channels (-C) was removed in hcxdumptool 6.3.x. Use "Interface Info" (-I) instead.');
        }

        $interface = $this->request['interface'] ?? '';
        $command = !empty($interface)
            ? 'hcxdumptool -i ' . escapeshellarg($interface) . ' -C'
            : 'hcxdumptool -C';

        return $this->startInfoTask($command);
    }

    public function interfaceInfo()
    {
        // 6.3.x: -I <iface> shows detailed per-interface info. 6.2.x: -I is the no-arg
        // interface list, so there is no per-interface info command there.
        if (!$this->isRewriteCli()) {
            return self::setError('Per-interface info (-I <iface>) requires hcxdumptool 6.3.x. On 6.2.x use "List Interfaces" / "Show Channels".');
        }

        $interface = $this->request['interface'] ?? '';
        if (empty($interface)) {
            return self::setError('No interface provided');
        }

        return $this->startInfoTask('hcxdumptool -I ' . escapeshellarg($interface));
    }

    public function checkDriver()
    {
        // --check_driver was removed in the 6.3 rewrite (nl80211 dropped the ioctl test).
        if ($this->isRewriteCli()) {
            return self::setError('Driver check (--check_driver) was removed in hcxdumptool 6.3.x.');
        }

        $interface = $this->request['interface'] ?? '';
        $command = !empty($interface)
            ? 'hcxdumptool -i ' . escapeshellarg($interface) . ' --check_driver'
            : 'hcxdumptool --check_driver';

        return $this->startInfoTask($command);
    }

    /**
     * Polls the diagnostic info task: {completed: bool, output: string}.
     */
    public function getInfoStatus()
    {
        return self::setSuccess(BackgroundTaskHelper::getStatus(self::TASK_INFO));
    }

    /**
     * Stops a running diagnostic command. NOTE: diagnostics and captures are both
     * hcxdumptool processes, so this also stops a running capture — the two never run
     * at once on the same radio anyway. The task wrapper still touches its completion
     * flag after the kill, so getInfoStatus resolves with whatever output was produced.
     */
    public function stopInfo()
    {
        OpenWrtHelper::exec('killall -9 hcxdumptool');

        return self::setSuccess(['success' => true]);
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

        $toolVersion = $this->request['toolVersion'] ?? '6.3';
        if (!in_array($toolVersion, ['6.2', '6.3'], true)) {
            return self::setError('Invalid tool version');
        }

        // Upsert by name (overwrite an existing same-named preset).
        $presets = array_values(array_filter($this->readPresets(), function ($preset) use ($name) {
            return ($preset['name'] ?? '') !== $name;
        }));
        if (count($presets) >= self::MAX_PRESETS) {
            return self::setError('Preset limit reached (' . self::MAX_PRESETS . ').');
        }
        $presets[] = ['name' => $name, 'toolVersion' => $toolVersion, 'values' => $values];

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
