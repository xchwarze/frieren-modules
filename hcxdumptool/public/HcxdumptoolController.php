<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\hcxdumptool;

use frieren\helper\OpenWrtHelper;

class HcxdumptoolController extends \frieren\core\Controller
{
    private $pcapDirectory = '/root/.hcxdumptool';
    private $logPath = '/tmp/fm-hcxdumptool.log';
    private $filterApPath = '/tmp/fm-hcxdumptool-filter-ap.txt';
    private $filterClientPath = '/tmp/fm-hcxdumptool-filter-client.txt';
    private $essidListPath = '/tmp/fm-hcxdumptool-essidlist.txt';

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

        // Build optional list files from textarea content and append the matching flags.
        $extraFlags = '';
        if ($this->writeListFile($this->filterApPath, $this->request['filterlistAp'] ?? '')) {
            $extraFlags .= ' --filterlist_ap=' . escapeshellarg($this->filterApPath);
        }
        if ($this->writeListFile($this->filterClientPath, $this->request['filterlistClient'] ?? '')) {
            $extraFlags .= ' --filterlist_client=' . escapeshellarg($this->filterClientPath);
        }
        if ($this->writeListFile($this->essidListPath, $this->request['essidList'] ?? '')) {
            $extraFlags .= ' --essidlist=' . escapeshellarg($this->essidListPath);
        }

        $filename = date('Y-m-d\TH-i-s') . '.pcap';
        $pcapFilePath = "{$this->pcapDirectory}/{$filename}";
        $command = escapeshellcmd($this->request['command']);
        OpenWrtHelper::execBackground("hcxdumptool {$command}{$extraFlags} -w {$pcapFilePath}", "{$this->logPath} 2>&1");

        return self::setSuccess([
            'outputFile' => $filename
        ]);
    }

    public function stopCapture()
    {
        OpenWrtHelper::exec('killall -9 hcxdumptool');

        return self::setSuccess([
            'success' => OpenWrtHelper::checkRunning('hcxdumptool')
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

        return self::setSuccess([
            'isRunning' => file_exists($this->logPath) && OpenWrtHelper::checkRunning('hcxdumptool'),
            'logContent' => file_get_contents($this->logPath)
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

    public function moduleStatus()
    {
        // fix default folder
        if (!file_exists($this->pcapDirectory)) {
            mkdir($this->pcapDirectory, 0755, true);
        }

        // this dependency can be installed by two different packages, so I simplify the default checkModuleDependencies() check
        if (OpenWrtHelper::commandExists('hcxdumptool')) {
            return self::setSuccess([
                'hasDependencies' => true,
                'isRunning' => file_exists($this->logPath) && OpenWrtHelper::checkRunning('hcxdumptool'),
                'interfaces' => $this->getNetworkInterfaces(),
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

    public function listInterfaces()
    {
        $output = OpenWrtHelper::exec('hcxdumptool -L 2>&1');

        return self::setSuccess([
            'output' => $output !== false ? trim($output) : '',
        ]);
    }

    public function showChannels()
    {
        $interface = $this->request['interface'] ?? '';
        $command = 'hcxdumptool -C 2>&1';
        if (!empty($interface)) {
            $command = 'hcxdumptool -i ' . escapeshellarg($interface) . ' -C 2>&1';
        }

        $output = OpenWrtHelper::exec($command);

        return self::setSuccess([
            'output' => $output !== false ? trim($output) : '',
        ]);
    }

    public function interfaceInfo()
    {
        $interface = $this->request['interface'] ?? '';
        if (empty($interface)) {
            return self::setError('No interface provided');
        }

        $output = OpenWrtHelper::exec('hcxdumptool -I ' . escapeshellarg($interface) . ' 2>&1');

        return self::setSuccess([
            'output' => $output !== false ? trim($output) : '',
        ]);
    }

    public function checkDriver()
    {
        $interface = $this->request['interface'] ?? '';
        $command = 'hcxdumptool --check_driver 2>&1';
        if (!empty($interface)) {
            $command = 'hcxdumptool -i ' . escapeshellarg($interface) . ' --check_driver 2>&1';
        }

        $output = OpenWrtHelper::exec($command);

        return self::setSuccess([
            'output' => $output !== false ? trim($output) : '',
        ]);
    }
}
