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

    // Always scanned for captures. hcxdumptool stores its handshakes under
    // /root/.hcxdumptool, so /root is the sane default; operators add more folders
    // via Settings (searchPaths).
    const DEFAULT_SCAN_PATH = '/root';

    public function getSettings()
    {
        $config = self::getConfig();

        return self::setSuccess([
            'wpaSecKey' => $config['wpaSecKey'] ?? '',
            'onlinehashcrackEmail' => $config['onlinehashcrackEmail'] ?? '',
            'searchPaths' => self::getConfiguredPaths(),
        ]);
    }

    public function setSettings()
    {
        self::setConfig([
            'wpaSecKey' => $this->request['wpaSecKey'] ?? '',
            'onlinehashcrackEmail' => $this->request['onlinehashcrackEmail'] ?? '',
            'searchPaths' => json_encode(self::sanitizePaths($this->request['searchPaths'] ?? [])),
        ]);

        return self::setSuccess();
    }

    /**
     * Operator-configured extra scan folders, decoded from the JSON-encoded UCI option.
     *
     * @return string[]
     */
    protected function getConfiguredPaths()
    {
        $config = self::getConfig();
        if (empty($config['searchPaths'])) {
            return [];
        }

        $decoded = json_decode($config['searchPaths'], true);

        return is_array($decoded) ? array_values($decoded) : [];
    }

    /**
     * Keeps only absolute paths, rejecting empties, relative paths and traversal.
     *
     * @param mixed $paths
     * @return string[]
     */
    protected function sanitizePaths($paths)
    {
        if (!is_array($paths)) {
            return [];
        }

        $clean = [];
        foreach ($paths as $path) {
            $path = trim((string) $path);
            if ($path !== '' && $path[0] === '/' && strpos($path, '..') === false) {
                $clean[] = $path;
            }
        }

        return array_values(array_unique($clean));
    }

    /**
     * Resolves the list of existing directories to scan: the default /root plus any
     * configured folders, de-duplicated, order preserved.
     *
     * @return string[]
     */
    protected function getScanFolders()
    {
        $folders = array_merge([self::DEFAULT_SCAN_PATH], self::getConfiguredPaths());

        $dirs = [];
        foreach (array_unique($folders) as $folder) {
            if (is_dir($folder)) {
                $dirs[] = $folder;
            }
        }

        return $dirs;
    }

    public function getCapFiles()
    {
        $folders = self::getScanFolders();
        if (empty($folders)) {
            return self::setSuccess([
                'files' => [],
            ]);
        }

        // Folder list is validated (existing dirs only) and each entry is escaped; the find
        // pattern is fixed server-side — never run an arbitrary command from the request (RCE).
        $pathArgs = implode(' ', array_map('escapeshellarg', $folders));
        $command = "find -L {$pathArgs} -type f \\( -name '*.cap' -o -name '*.pcap' -o -name '*.pcapng' -o -name '*.hccapx' \\) 2>&1";
        // raw=true: the command has globs/redirect/grouping and is already escapeshellarg'd per path;
        // escapeshellcmd would corrupt find's \( \) grouping and the '*.cap' globs (matches nothing).
        $files = self::setupCoreHelper()::exec($command, false, true);
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

        if (!self::setupCoreHelper()::hasInternetConnection()) {
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
