<?php
/*
 * Project: Frieren Nmap Module
 * Based on Frieren Framework Template Module and other Frieren modules
 * Original Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * Modifications and new code by m5kro <m5kro@proton.me>, 2024
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 *
 * Original code from Frieren Framework is distributed under the terms of the
 * GNU Lesser General Public License (LGPL) version 3 or later. You should have received
 * a copy of the LGPL-3.0-or-later along with this project. If not, see <https://www.gnu.org/licenses>.
 * 
 * Modifications: Added functions to manage Nmap scans, including starting and stopping scans, 
 * checking status, and managing scan history.
 */

namespace frieren\modules\nmap;

use frieren\helper\OpenWrtHelper;

class NmapController extends \frieren\core\Controller
{
    private $nmapDirectory = '/root/.nmap';
    private $logPath = '/tmp/nmap.log';

    protected $endpointRoutes = [
        'checkModuleDependencies',
        'installModuleDependencies',
        'getDependencyInstallationStatus',
        'startScan',
        'stopScan',
        'getHistory',
        'getHistoryContent',
        'getLogContent',
        'deleteHistory',
        'moduleStatus',
    ];

    public function startScan()
    {
        if (!isset($this->request['command'])) {
            return self::setError('No command provided');
        }

        $filename = date('Y-m-d\TH-i-s') . '.log';
        $logFilePath = "{$this->nmapDirectory}/{$filename}";
        $command = escapeshellcmd($this->request['command']);

        // Run Nmap asynchronously and write output to /root/.nmap/ and /tmp/nmap.log
        OpenWrtHelper::execBackground("nmap {$command} -oN {$logFilePath}", "{$this->logPath} 2>&1");

        return self::setSuccess([
            'outputFile' => $filename
        ]);
    }

    public function stopScan()
    {
        OpenWrtHelper::exec('killall -9 nmap');
        return self::setSuccess([
            'success' => !OpenWrtHelper::checkRunning('nmap')
        ]);
    }

    public function getHistory()
    {
        $files = array_diff(scandir($this->nmapDirectory), ['..', '.']);
        $files = array_filter($files, function($file) {
            return is_file("{$this->nmapDirectory}/{$file}");
        });

        return self::setSuccess(['files' => array_values($files)]);
    }

    public function getHistoryContent()
    {
        if (!isset($this->request['filename'])) {
            return self::setError('No filename provided');
        }

        $filename = $this->request['filename'];
        $filePath = "{$this->nmapDirectory}/{$filename}";

        if (!file_exists($filePath)) {
            return self::setError("File not found: {$filePath}");
        }

        $logContent = file_get_contents($filePath);

        return self::setSuccess([
            'filename' => $filename,
            'logContent' => $logContent,
        ]);
    }

    public function getLogContent()
    {
        if (!file_exists($this->logPath)) {
            return self::setError("Could not find log output: {$this->logPath}");
        }

        return self::setSuccess([
            'isRunning' => OpenWrtHelper::checkRunning('nmap'),
            'logContent' => file_get_contents($this->logPath)
        ]);
    }

    public function deleteHistory()
    {
        $filename = $this->request['filename'];
        $filePath = "{$this->nmapDirectory}/{$filename}";
        if (file_exists($filePath)) {
            unlink($filePath);
            return self::setSuccess();
        }

        return self::setError('File does not exist.');
    }

    public function moduleStatus()
    {
        // Ensure the Nmap directory exists
        if (!file_exists($this->nmapDirectory)) {
            mkdir($this->nmapDirectory, 0777, true);
        }

        return self::setSuccess([
            'isRunning' => false,
        ]);
    }
}
