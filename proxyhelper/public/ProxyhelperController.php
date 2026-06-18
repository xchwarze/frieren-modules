<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\proxyhelper;

class ProxyhelperController extends \frieren\core\Controller
{
    private $backupDirectory = '/root/.proxyhelper';

    // Dedicated nat chain holding our scoped MASQUERADE rules, so disable can flush them
    // all at once (orphan-proof) regardless of the host/port used at enable time.
    const MASQ_CHAIN = 'FRIEREN_PROXY';

    protected $endpointRoutes = [
        'getSettings' => true,
        'setSettings' => true,
        'getRoutingStatus' => true,
        'toggleRouting' => true,
        'getNatRules' => true,
        'getForwardedPorts' => true,
        'addPort' => true,
        'deletePort' => true,
        'getBackups' => true,
        'backupFirewall' => true,
        'restoreFirewall' => true,
        'deleteBackup' => true,
    ];

    private function ensureBackupDirectory()
    {
        if (!is_dir($this->backupDirectory)) {
            mkdir($this->backupDirectory, 0755, true);
        }
    }

    private function autoBackup($label)
    {
        $this->ensureBackupDirectory();

        $timestamp = date('Y-m-d_H-i-s');
        $filename = "iptables_{$label}_{$timestamp}";
        $filepath = "{$this->backupDirectory}/{$filename}";

        exec('iptables-save > ' . escapeshellarg($filepath));
        $this->pruneBackups();

        return $filename;
    }

    /**
     * Keep only the newest $keep auto-backups; timestamped names sort chronologically,
     * so the oldest are at the front. Prevents the backup dir growing without bound
     * (a backup is written on every toggle / port mutation).
     */
    private function pruneBackups($keep = 20)
    {
        $files = array_values(array_diff(scandir($this->backupDirectory), ['.', '..']));
        sort($files);
        $excess = count($files) - $keep;
        for ($i = 0; $i < $excess; $i++) {
            @unlink("{$this->backupDirectory}/{$files[$i]}");
        }
    }

    private function dnatRuleExists($port, $destination)
    {
        $port = escapeshellarg(trim($port));
        $destination = escapeshellarg($destination);
        exec("iptables -t nat -C PREROUTING -p tcp --dport {$port} -j DNAT --to-destination {$destination} 2>/dev/null", $output, $code);

        return $code === 0;
    }

    /**
     * Match scoped to the proxy destination/port, so we MASQUERADE only the proxied flow
     * instead of every outbound packet. Add/check use this same string to stay idempotent.
     * All values escaped.
     */
    private function masqueradeMatch($proxyHost, $proxyPort)
    {
        return '-d ' . escapeshellarg(trim($proxyHost))
            . ' -p tcp --dport ' . escapeshellarg(trim($proxyPort))
            . ' -j MASQUERADE';
    }

    /**
     * Ensure our dedicated MASQUERADE chain exists and is jumped to from POSTROUTING.
     * Isolating our rules in their own chain (like evilportal's nft table) means teardown
     * can flush them all regardless of host/port — no orphans when settings change between
     * enable and disable.
     */
    private function ensureMasqueradeChain()
    {
        exec('iptables -t nat -N ' . self::MASQ_CHAIN . ' 2>/dev/null');
        exec('iptables -t nat -C POSTROUTING -j ' . self::MASQ_CHAIN . ' 2>/dev/null', $output, $code);
        if ($code !== 0) {
            exec('iptables -t nat -A POSTROUTING -j ' . self::MASQ_CHAIN);
        }
    }

    /**
     * Remove every MASQUERADE rule we created plus the chain itself: flush the chain,
     * drop the POSTROUTING jump (draining duplicates), then delete the empty chain.
     */
    private function teardownMasqueradeChain()
    {
        exec('iptables -t nat -F ' . self::MASQ_CHAIN . ' 2>/dev/null');
        while (true) {
            exec('iptables -t nat -C POSTROUTING -j ' . self::MASQ_CHAIN . ' 2>/dev/null', $output, $code);
            if ($code !== 0) {
                break;
            }
            exec('iptables -t nat -D POSTROUTING -j ' . self::MASQ_CHAIN . ' 2>/dev/null');
        }
        exec('iptables -t nat -X ' . self::MASQ_CHAIN . ' 2>/dev/null');
    }

    private function masqueradeRuleExists($proxyHost, $proxyPort)
    {
        exec('iptables -t nat -C ' . self::MASQ_CHAIN . ' ' . $this->masqueradeMatch($proxyHost, $proxyPort) . ' 2>/dev/null', $output, $code);

        return $code === 0;
    }

    public function getSettings()
    {
        $config = self::getConfig();

        return self::setSuccess([
            'proxyHost' => $config['proxyHost'] ?? '',
            'proxyPort' => $config['proxyPort'] ?? '',
            'forwardPorts' => $config['forwardPorts'] ?? '',
        ]);
    }

    public function setSettings()
    {
        self::setConfig([
            'proxyHost' => $this->request['proxyHost'],
            'proxyPort' => $this->request['proxyPort'],
            'forwardPorts' => $this->request['forwardPorts'],
        ]);

        return self::setSuccess();
    }

    public function getRoutingStatus()
    {
        $ipForward = trim(@file_get_contents('/proc/sys/net/ipv4/ip_forward'));
        $natRules = trim(exec('iptables -t nat -L PREROUTING -n 2>/dev/null'));
        $hasDnatRules = strpos($natRules, 'DNAT') !== false;

        return self::setSuccess([
            'enabled' => $ipForward === '1' && $hasDnatRules,
        ]);
    }

    public function toggleRouting()
    {
        $enabled = $this->request['enabled'] ?? false;
        $proxyHost = $this->request['proxyHost'] ?? '';
        $proxyPort = $this->request['proxyPort'] ?? '';
        $forwardPorts = $this->request['forwardPorts'] ?? [];

        if (empty($proxyHost) || empty($proxyPort) || empty($forwardPorts)) {
            return self::setError('Missing required parameters');
        }

        // Auto-backup current firewall state before mutating live rules
        $this->autoBackup($enabled ? 'before_enable' : 'before_disable');
        $this->logger('proxyhelper routing ' . ($enabled ? 'enabled' : 'disabled') . " (proxy {$proxyHost}:{$proxyPort})", 'info');

        $destinationRaw = "{$proxyHost}:{$proxyPort}";

        if ($enabled) {
            exec("echo '1' > /proc/sys/net/ipv4/ip_forward");

            foreach ($forwardPorts as $port) {
                // Idempotency: only append when the rule does not already exist
                if (!$this->dnatRuleExists($port, $destinationRaw)) {
                    $portArg = escapeshellarg(trim($port));
                    $destination = escapeshellarg($destinationRaw);
                    exec("iptables -t nat -A PREROUTING -p tcp --dport {$portArg} -j DNAT --to-destination {$destination}");
                }
            }

            $this->ensureMasqueradeChain();
            if (!$this->masqueradeRuleExists($proxyHost, $proxyPort)) {
                exec('iptables -t nat -A ' . self::MASQ_CHAIN . ' ' . $this->masqueradeMatch($proxyHost, $proxyPort));
            }

            return self::setSuccess(['message' => 'Routing enabled']);
        } else {
            foreach ($forwardPorts as $port) {
                $portArg = escapeshellarg(trim($port));
                $destination = escapeshellarg($destinationRaw);
                // Delete every duplicate copy of the rule that may exist
                while ($this->dnatRuleExists($port, $destinationRaw)) {
                    exec("iptables -t nat -D PREROUTING -p tcp --dport {$portArg} -j DNAT --to-destination {$destination}");
                }
            }

            // Flush the whole MASQUERADE chain — removes our rules for ANY host/port,
            // so a settings change between enable and disable can't leave an orphan.
            $this->teardownMasqueradeChain();

            exec("echo '0' > /proc/sys/net/ipv4/ip_forward");

            return self::setSuccess(['message' => 'Routing disabled']);
        }
    }

    public function getNatRules()
    {
        $rules = shell_exec('iptables -t nat -L -n -v 2>&1');

        return self::setSuccess([
            'rules' => $rules !== null ? rtrim($rules) : '',
        ]);
    }

    public function getForwardedPorts()
    {
        $output = [];
        exec('iptables -t nat -S PREROUTING 2>/dev/null', $output);

        $ports = [];
        foreach ($output as $line) {
            // Parse appended DNAT rules: -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination 1.2.3.4:8080
            if (strpos($line, '-j DNAT') === false || strpos($line, '--dport') === false) {
                continue;
            }

            $port = '';
            $destination = '';
            if (preg_match('/--dport\s+(\d+)/', $line, $portMatch)) {
                $port = $portMatch[1];
            }
            if (preg_match('/--to-destination\s+(\S+)/', $line, $destMatch)) {
                $destination = $destMatch[1];
            }

            if ($port !== '') {
                $ports[] = [
                    'port' => $port,
                    'destination' => $destination,
                ];
            }
        }

        return self::setSuccess([
            'ports' => $ports,
        ]);
    }

    public function addPort()
    {
        $port = trim($this->request['port'] ?? '');
        $proxyHost = $this->request['proxyHost'] ?? '';
        $proxyPort = $this->request['proxyPort'] ?? '';

        if ($port === '' || !ctype_digit($port) || (int)$port < 1 || (int)$port > 65535) {
            return self::setError('Invalid port');
        }
        if (empty($proxyHost) || empty($proxyPort)) {
            return self::setError('Missing proxy host or port');
        }

        $this->autoBackup('before_add_port');

        // Ensure IP forwarding is on so the new rule takes effect
        exec("echo '1' > /proc/sys/net/ipv4/ip_forward");

        $destinationRaw = "{$proxyHost}:{$proxyPort}";
        if (!$this->dnatRuleExists($port, $destinationRaw)) {
            $portArg = escapeshellarg($port);
            $destination = escapeshellarg($destinationRaw);
            exec("iptables -t nat -A PREROUTING -p tcp --dport {$portArg} -j DNAT --to-destination {$destination}");
        }

        $this->ensureMasqueradeChain();
        if (!$this->masqueradeRuleExists($proxyHost, $proxyPort)) {
            exec('iptables -t nat -A ' . self::MASQ_CHAIN . ' ' . $this->masqueradeMatch($proxyHost, $proxyPort));
        }

        return self::setSuccess(['message' => "Port {$port} added"]);
    }

    public function deletePort()
    {
        $port = trim($this->request['port'] ?? '');
        $destinationRaw = trim($this->request['destination'] ?? '');

        if ($port === '' || !ctype_digit($port)) {
            return self::setError('Invalid port');
        }
        if ($destinationRaw === '') {
            return self::setError('Missing destination');
        }

        $this->autoBackup('before_delete_port');

        $portArg = escapeshellarg($port);
        $destination = escapeshellarg($destinationRaw);
        // Remove every matching DNAT rule for this port/destination pair
        while ($this->dnatRuleExists($port, $destinationRaw)) {
            exec("iptables -t nat -D PREROUTING -p tcp --dport {$portArg} -j DNAT --to-destination {$destination}");
        }

        return self::setSuccess(['message' => "Port {$port} removed"]);
    }

    public function getBackups()
    {
        $this->ensureBackupDirectory();

        $files = array_diff(scandir($this->backupDirectory), ['.', '..']);
        sort($files);

        return self::setSuccess([
            'backups' => array_values($files),
        ]);
    }

    public function backupFirewall()
    {
        $this->ensureBackupDirectory();

        $timestamp = date('Y-m-d_H-i-s');
        $filename = "iptables_{$timestamp}";
        $filepath = "{$this->backupDirectory}/{$filename}";

        exec("iptables-save > " . escapeshellarg($filepath));

        return self::setSuccess([
            'filename' => $filename,
        ]);
    }

    public function restoreFirewall()
    {
        $filename = $this->request['filename'] ?? '';
        $filename = basename($filename);
        if (empty($filename)) {
            return self::setError('No filename provided');
        }

        $filepath = "{$this->backupDirectory}/{$filename}";
        if (!file_exists($filepath)) {
            return self::setError('Backup file does not exist');
        }

        exec("iptables-restore < " . escapeshellarg($filepath));

        return self::setSuccess();
    }

    public function deleteBackup()
    {
        $filename = $this->request['filename'] ?? '';
        $filename = basename($filename);
        if (empty($filename)) {
            return self::setError('No filename provided');
        }

        $filepath = "{$this->backupDirectory}/{$filename}";
        if (!file_exists($filepath)) {
            return self::setError('Backup file does not exist');
        }

        unlink($filepath);

        return self::setSuccess();
    }
}
