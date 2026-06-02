<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\wpaonlinecrack;

class WpaonlinecrackController extends \frieren\core\Controller
{
    protected $endpointRoutes = [
        'checkModuleDependencies' => true,
        'installModuleDependencies' => true,
        'getDependencyInstallationStatus' => true,
        'getSettings' => true,
        'setSettings' => true,
        'getCapFiles' => true,
        'sendCap' => true,
        'checkResults' => true,
    ];

    const REPORT_PATH = '/tmp/fm-wpaonlinecrack-report.json';

    public function getSettings()
    {
        $config = self::getConfig();

        return self::setSuccess([
            'wpaSecKey' => $config['wpaSecKey'] ?? '',
            'onlinehashcrackEmail' => $config['onlinehashcrackEmail'] ?? '',
        ]);
    }

    public function setSettings()
    {
        self::setConfig([
            'wpaSecKey' => $this->request['wpaSecKey'] ?? '',
            'onlinehashcrackEmail' => $this->request['onlinehashcrackEmail'] ?? '',
        ]);

        return self::setSuccess();
    }

    public function getCapFiles()
    {
        $modulesFolder = \DeviceConfig::MODULE_ROOT_FOLDER;
        // command is fixed server-side — never run an arbitrary command from the request (RCE)
        $command = "find -L {$modulesFolder} -type f \\( -name '*.cap' -o -name '*.pcap' -o -name '*.pcapng' -o -name '*.hccapx' \\) 2>&1";
        $files = self::setupCoreHelper()::exec($command, false);
        if ($files === false) {
            $files = [];
        }

        $report = self::getReport();
        $entries = [];
        foreach ($files as $file) {
            $entries[] = [
                'path' => $file,
                'submitted' => in_array($file, $report),
            ];
        }

        return self::setSuccess([
            'files' => $entries,
        ]);
    }

    protected static function getReport()
    {
        if (file_exists(self::REPORT_PATH)) {
            return json_decode(file_get_contents(self::REPORT_PATH), true) ?? [];
        }

        return [];
    }

    public function sendCap()
    {
        $captures = $this->request['captures'] ?? [];
        if (empty($captures)) {
            return self::setError('No captures provided');
        }

        $config = self::getConfig();
        $wpaSecKey = $config['wpaSecKey'] ?? false;
        $onlinehashcrackEmail = $config['onlinehashcrackEmail'] ?? false;
        if (empty($wpaSecKey) && empty($onlinehashcrackEmail)) {
            return self::setError('Configuration incomplete');
        }

        $report = self::getReport();

        $submitted = 0;
        $skipped = 0;
        $failed = 0;
        foreach ($captures as $capture) {
            if (in_array($capture, $report)) {
                $skipped++;
                continue;
            }

            // capture path comes from the request — must be a real existing file, escaped before use
            if (!is_file($capture)) {
                $failed++;
                continue;
            }

            $success = true;

            if ($wpaSecKey) {
                // -f makes curl exit non-zero on HTTP errors so exec() returns false, and -w appends the
                // HTTP status code so we can confirm the server actually accepted the upload.
                $result = self::setupCoreHelper()::exec(
                    sprintf('curl -s -f -w "\nHTTP_STATUS:%%{http_code}" -X POST -F %s --cookie %s "https://wpa-sec.stanev.org/?submit"',
                        escapeshellarg("webfile=@{$capture}"),
                        escapeshellarg("key={$wpaSecKey}")
                    ),
                    true,
                    true
                );

                $success = $success
                    && $result !== false
                    && strpos($result, 'HTTP_STATUS:200') !== false
                    && stripos($result, 'error') === false;
            }

            if ($onlinehashcrackEmail) {
                $result = self::setupCoreHelper()::exec(
                    sprintf('curl -s -f -w "\nHTTP_STATUS:%%{http_code}" -X POST -F %s -F %s "https://api.onlinehashcrack.com"',
                        escapeshellarg("email={$onlinehashcrackEmail}"),
                        escapeshellarg("file=@{$capture}")
                    ),
                    true,
                    true
                );

                $success = $success
                    && $result !== false
                    && strpos($result, 'HTTP_STATUS:200') !== false;
            }

            if ($success) {
                $report[] = $capture;
                $submitted++;
            } else {
                $failed++;
            }
        }

        file_put_contents(self::REPORT_PATH, json_encode($report));

        return self::setSuccess([
            'submitted' => $submitted,
            'skipped' => $skipped,
            'failed' => $failed,
        ]);
    }

    public function checkResults()
    {
        $config = self::getConfig();
        $wpaSecKey = $config['wpaSecKey'] ?? false;
        if (empty($wpaSecKey)) {
            return self::setError('No API key configured');
        }

        $pingResult = self::setupCoreHelper()::exec('ping -c 1 -W 3 wpa-sec.stanev.org 2>&1');
        if (strpos($pingResult, '1 received') === false && strpos($pingResult, '1 packets received') === false) {
            return self::setError('No internet connection');
        }

        // Potfile-style listing of cracked networks via the wpa-sec API endpoint.
        $output = self::setupCoreHelper()::exec(
            sprintf('curl -s -f --cookie %s "https://wpa-sec.stanev.org/?api&dl=1"',
                escapeshellarg("key={$wpaSecKey}")
            ),
            true,
            true
        );

        if ($output === false) {
            return self::setError('Failed to retrieve results from WPA-Sec');
        }

        $results = [];
        foreach (explode("\n", trim($output)) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            // Format: BSSID:STATIONMAC:ESSID:PASSWORD
            $parts = explode(':', $line);
            if (count($parts) < 4) {
                continue;
            }

            $bssid = $parts[0];
            $essid = $parts[2];
            $password = implode(':', array_slice($parts, 3));
            $results[] = [
                'bssid' => $bssid,
                'essid' => $essid,
                'password' => $password,
            ];
        }

        return self::setSuccess([
            'results' => $results,
        ]);
    }
}
