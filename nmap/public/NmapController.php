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

class NmapController extends \frieren\core\Controller
{
    private $nmapDirectory = '/root/.nmap';
    private $logPath = '/tmp/nmap.log';

    protected $endpointRoutes = [
        //'checkModuleDependencies' => true,
        'installModuleDependencies' => true,
        'getDependencyInstallationStatus' => true,
        'startScan' => true,
        'stopScan' => true,
        'getHistory' => true,
        'getHistoryContent' => true,
        'getHistoryStructured' => true,
        'getLogContent' => true,
        'deleteHistory' => true,
        'deleteAll' => true,
        'downloadResult' => true,
        'getPresets' => true,
        'savePreset' => true,
        'deletePreset' => true,
        'moduleStatus' => true,
    ];

    // Operator-saved scan presets (device-persistent JSON, mirrors tcpdump/hcxdumptool).
    const PRESETS_FILE = 'presets.json';
    const MAX_PRESETS = 50;
    const PRESET_NAME_REGEX = '/^[A-Za-z0-9 ._+()-]{1,40}$/';

    public function startScan()
    {
        if (!isset($this->request['command'])) {
            return self::setError('No command provided');
        }

        $rawCommand = $this->request['command'];

        // The module owns the output path (-oN is appended below). Reject any user-supplied
        // output-file flag, which could otherwise write arbitrary files as root.
        if (preg_match('/(^|\s)-o[ANXGS](\s|=)/', $rawCommand)) {
            return self::setError('Output-file flags (-oN/-oX/-oA/...) are managed by the module and not allowed.');
        }

        // Reject --script pointing at a filesystem path (arbitrary .nse execution); allow
        // NSE names/categories (no slash, no traversal).
        if (preg_match('/--script[=\s]+(\S+)/', $rawCommand, $m)) {
            $spec = trim($m[1], "'\"");
            if (strpos($spec, '/') !== false || strpos($spec, '..') !== false) {
                return self::setError('Script paths are not allowed; use NSE script names or categories.');
            }
        }

        $datetime = date('Y-m-d\TH-i-s');
        $filename = "{$datetime}.log";
        $logFilePath = "{$this->nmapDirectory}/{$filename}";
        $xmlFilePath = "{$this->nmapDirectory}/{$datetime}.xml";
        $command = escapeshellcmd($this->request['command']);

        // Run Nmap asynchronously; -oN feeds the raw view, -oX feeds the structured table.
        $this->logger("nmap scan started: {$rawCommand}", 'info');
        self::setupCoreHelper()::execBackground("nmap {$command} -oN {$logFilePath} -oX {$xmlFilePath}", "{$this->logPath} 2>&1");

        return self::setSuccess([
            'outputFile' => $filename
        ]);
    }

    public function stopScan()
    {
        self::setupCoreHelper()::exec('killall -9 nmap');
        return self::setSuccess([
            'success' => !self::setupCoreHelper()::checkRunning('nmap')
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

        $filename = basename($this->request['filename']);
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
            'isRunning' => self::setupCoreHelper()::checkRunning('nmap'),
            'logContent' => file_get_contents($this->logPath)
        ]);
    }

    public function deleteHistory()
    {
        if (!isset($this->request['filename'])) {
            return self::setError('No filename provided');
        }

        $filename = basename($this->request['filename']);
        $filePath = "{$this->nmapDirectory}/{$filename}";
        if (file_exists($filePath)) {
            unlink($filePath);
            return self::setSuccess();
        }

        return self::setError('File does not exist.');
    }

    public function deleteAll()
    {
        $files = array_diff(scandir($this->nmapDirectory), ['.', '..']);
        foreach ($files as $file) {
            $filePath = "{$this->nmapDirectory}/{$file}";
            if (is_file($filePath)) {
                unlink($filePath);
            }
        }

        return self::setSuccess();
    }

    public function downloadResult()
    {
        if (!isset($this->request['filename'])) {
            return self::setError('No filename provided');
        }

        $filename = basename($this->request['filename']);
        $filePath = "{$this->nmapDirectory}/{$filename}";
        if (!file_exists($filePath)) {
            return self::setError("File not found: {$filePath}");
        }

        $this->responseHandler->streamFile($filePath);
    }

    /* --- Structured (XML) scan results --- */

    public function getHistoryStructured()
    {
        if (!isset($this->request['filename'])) {
            return self::setError('No filename provided');
        }

        // The XML sits next to the .log with the same basename (-oX emitted on scan).
        $filename = basename($this->request['filename']);
        $xmlPath = "{$this->nmapDirectory}/" . preg_replace('/\.log$/', '', $filename) . '.xml';
        if (!file_exists($xmlPath)) {
            return self::setError('Structured output is not available for this scan.');
        }

        $hosts = $this->parseNmapXml($xmlPath);
        if ($hosts === false) {
            return self::setError('Could not parse the scan XML.');
        }

        return self::setSuccess(['hosts' => $hosts]);
    }

    /**
     * Parses an nmap -oX file into a normalized hosts/ports/services structure.
     * Defensive: the XML shape varies by nmap version, so every node is guarded.
     *
     * @return array|false
     */
    private function parseNmapXml($xmlPath)
    {
        $prev = libxml_use_internal_errors(true);
        $xml = simplexml_load_file($xmlPath);
        libxml_use_internal_errors($prev);
        if ($xml === false) {
            return false;
        }

        $hosts = [];
        foreach ($xml->host as $host) {
            // Prefer the IP address; fall back to whatever is present (e.g. mac-only),
            // since a host can list both an ipv4/ipv6 and a mac address node.
            $address = '';
            foreach ($host->address as $addr) {
                $type = (string) ($addr['addrtype'] ?? '');
                $value = (string) ($addr['addr'] ?? '');
                if ($value === '') {
                    continue;
                }
                if ($type === 'ipv4' || $type === 'ipv6') {
                    $address = $value;
                    break;
                }
                if ($address === '') {
                    $address = $value;
                }
            }

            $hostname = '';
            if (isset($host->hostnames->hostname[0])) {
                $hostname = (string) ($host->hostnames->hostname[0]['name'] ?? '');
            }

            $ports = [];
            if (isset($host->ports->port)) {
                foreach ($host->ports->port as $port) {
                    $service = $port->service ?? null;
                    $ports[] = [
                        'port' => (string) ($port['portid'] ?? ''),
                        'protocol' => (string) ($port['protocol'] ?? ''),
                        'state' => (string) ($port->state['state'] ?? ''),
                        'service' => $service !== null ? (string) ($service['name'] ?? '') : '',
                        'version' => $service !== null ? trim((string) ($service['product'] ?? '') . ' ' . (string) ($service['version'] ?? '')) : '',
                    ];
                }
            }

            $hosts[] = [
                'address' => $address,
                'hostname' => $hostname,
                'ports' => $ports,
            ];
        }

        return $hosts;
    }

    /* --- Scan presets (operator-saved, device-persistent JSON; mirrors tcpdump) --- */

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


    public function moduleStatus()
    {
        // Ensure the Nmap directory exists
        if (!file_exists($this->nmapDirectory)) {
            mkdir($this->nmapDirectory, 0755, true);
        }

        return self::setSuccess([
            'isRunning' => self::setupCoreHelper()::checkRunning('nmap'),
            'hasDependencies' => !is_string(self::setupCoreHelper()::checkDependency(['nmap'])),
            'message' => self::setupCoreHelper()::checkDependency(['nmap']),
            'internalAvailable' => (disk_free_space('/') > self::MIN_DISK_SPACE) && \DeviceConfig::MODULE_USE_INTERNAL_STORAGE,
            'SDAvailable' => self::setupCoreHelper()::isSDAvailable() && \DeviceConfig::MODULE_USE_USB_STORAGE,
        ]);
    }

}
