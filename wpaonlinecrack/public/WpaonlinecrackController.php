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
        'checkOhcResults' => true,
    ];

    const REPORT_PATH = '/tmp/fm-wpaonlinecrack-report.json';

    // OnlineHashCrack v2 API. add_tasks/list_tasks take JSON with an sk_ api key.
    // It accepts HASHES, not capture files, so caps are converted with
    // hcxpcapngtool to hashcat mode 22000 (WPA-PBKDF2-PMKID+EAPOL) before upload.
    const OHC_API_URL = 'https://api.onlinehashcrack.com/v2';
    const OHC_ALGO_MODE = 22000;
    const OHC_BATCH_SIZE = 50;
    const OHC_HASH_TMP = '/tmp/fm-wpaonlinecrack-hash.22000';

    // Always scanned for captures. hcxdumptool stores its handshakes under
    // /root/.hcxdumptool, so /root is the sane default; operators add more folders
    // via Settings (searchPaths).
    const DEFAULT_SCAN_PATH = '/root';

    public function getSettings()
    {
        $config = self::getConfig();

        return self::setSuccess([
            'wpaSecKey' => $config['wpaSecKey'] ?? '',
            'onlinehashcrackApiKey' => $config['onlinehashcrackApiKey'] ?? '',
            'searchPaths' => self::getConfiguredPaths(),
        ]);
    }

    public function setSettings()
    {
        self::setConfig([
            'wpaSecKey' => $this->request['wpaSecKey'] ?? '',
            'onlinehashcrackApiKey' => $this->request['onlinehashcrackApiKey'] ?? '',
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
        $onlinehashcrackApiKey = $config['onlinehashcrackApiKey'] ?? false;
        if (empty($wpaSecKey) && empty($onlinehashcrackApiKey)) {
            return self::setError('Configuration incomplete');
        }

        // OnlineHashCrack v2 needs hashes, so caps are converted with hcxpcapngtool.
        // It's a soft dependency: WPA-Sec works without it, so only block when OHC is
        // the only configured service and the tool is missing.
        $ohcEnabled = !empty($onlinehashcrackApiKey);
        $ohcReady = $ohcEnabled && self::setupCoreHelper()::commandExists('hcxpcapngtool');
        if ($ohcEnabled && !$ohcReady && empty($wpaSecKey)) {
            return self::setError('OnlineHashCrack requires hcxpcapngtool (install the hcxtools package).');
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

            if ($ohcReady) {
                // Convert the capture to mode-22000 hashes and submit them. A cap with
                // no usable handshake yields no hashes — nothing to send, not a failure.
                $hashes = self::capToHashes($capture);
                if (!empty($hashes)) {
                    $success = $success && self::submitHashesToOhc($onlinehashcrackApiKey, $hashes);
                }
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
            // True when an OHC key is set but hcxpcapngtool is missing, so OHC was
            // skipped while WPA-Sec still ran — the frontend surfaces this as a notice.
            'ohcSkipped' => ($ohcEnabled && !$ohcReady),
        ]);
    }

    /**
     * Converts a capture file to hashcat mode-22000 hashes via hcxpcapngtool.
     * Returns the list of hash lines (empty when the cap has no usable handshake).
     */
    private function capToHashes($capture)
    {
        @unlink(self::OHC_HASH_TMP);
        self::setupCoreHelper()::exec(
            sprintf('hcxpcapngtool -o %s %s',
                escapeshellarg(self::OHC_HASH_TMP),
                escapeshellarg($capture)
            ),
            true,
            true
        );

        if (!file_exists(self::OHC_HASH_TMP)) {
            return [];
        }

        $content = file_get_contents(self::OHC_HASH_TMP);
        @unlink(self::OHC_HASH_TMP);

        $lines = array_filter(
            array_map('trim', explode("\n", (string) $content)),
            function ($line) {
                return $line !== '';
            }
        );

        return array_values($lines);
    }

    /**
     * Submits hashes to OnlineHashCrack v2 (add_tasks), batched to the API limit.
     * Returns true only when every batch is accepted (curl -f => false on HTTP error).
     */
    private function submitHashesToOhc($apiKey, $hashes)
    {
        foreach (array_chunk($hashes, self::OHC_BATCH_SIZE) as $batch) {
            $payload = json_encode([
                'api_key' => $apiKey,
                'agree_terms' => 'yes',
                'action' => 'add_tasks',
                'algo_mode' => self::OHC_ALGO_MODE,
                'hashes' => array_values($batch),
            ]);

            $result = self::setupCoreHelper()::exec(
                sprintf('curl -s -f -X POST -H %s -d %s %s',
                    escapeshellarg('Content-Type: application/json'),
                    escapeshellarg($payload),
                    escapeshellarg(self::OHC_API_URL)
                ),
                true,
                true
            );

            if ($result === false) {
                return false;
            }
        }

        return true;
    }

    public function checkOhcResults()
    {
        $config = self::getConfig();
        $apiKey = $config['onlinehashcrackApiKey'] ?? false;
        if (empty($apiKey)) {
            return self::setError('No OnlineHashCrack API key configured');
        }

        if (!self::setupCoreHelper()::hasInternetConnection()) {
            return self::setError('No internet connection');
        }

        $payload = json_encode([
            'api_key' => $apiKey,
            'agree_terms' => 'yes',
            'action' => 'list_tasks',
        ]);

        $output = self::setupCoreHelper()::exec(
            sprintf('curl -s -f -X POST -H %s -d %s %s',
                escapeshellarg('Content-Type: application/json'),
                escapeshellarg($payload),
                escapeshellarg(self::OHC_API_URL)
            ),
            true,
            true
        );

        if ($output === false) {
            return self::setError('Failed to retrieve results from OnlineHashCrack');
        }

        $decoded = json_decode($output, true);
        if (!is_array($decoded)) {
            return self::setError('Unexpected response from OnlineHashCrack');
        }

        // The task array wrapper key isn't fixed across versions — accept the common
        // ones, or a bare list. OHC's API returns task STATUS, not the plaintext;
        // the recovered password stays on their site.
        $tasks = $decoded['tasks'] ?? $decoded['data'] ?? $decoded['results'] ?? (isset($decoded[0]) ? $decoded : []);

        $results = [];
        foreach ($tasks as $task) {
            if (!is_array($task)) {
                continue;
            }
            $results[] = [
                'hash' => $task['hash'] ?? '',
                'status' => $task['status'] ?? '',
                'algorithm' => $task['algorithm'] ?? ($task['algomode'] ?? ''),
                'lastAttack' => $task['lastAttack'] ?? '',
                'createdAt' => $task['created_at'] ?? '',
            ];
        }

        return self::setSuccess([
            'tasks' => $results,
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
