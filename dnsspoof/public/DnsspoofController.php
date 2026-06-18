<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\dnsspoof;

class DnsspoofController extends \frieren\core\Controller
{
    private $hostFilePath = '/etc/hosts';

    // dnsmasq wildcard spoofing lives in UCI as an `address=/domain/ip` list under the
    // first dnsmasq instance — persistent across reboot, unlike a /tmp conf-dir drop-in.
    private $wildcardConfList = 'dhcp.@dnsmasq[0].address';

    public $endpointRoutes = [
        'createHostSnapshot' => true,
        'rollbackHostsFromSnapshot' => true,
        'fetchHosts' => true,
        'addHost' => true,
        'deleteHost' => true,
        'fetchWildcards' => true,
        'addWildcard' => true,
        'removeWildcard' => true,
        'restartService' => true,
    ];

    private function getHostsSnapshotPath()
    {
        return self::getModulePath() . '/hosts-snapshot';
    }

    public function createHostSnapshot()
    {
        $backupFilePath = $this->getHostsSnapshotPath();
        if (!file_exists($backupFilePath)) {
            $hosts = file_get_contents($this->hostFilePath);
            file_put_contents($backupFilePath, $hosts);
        }

        return self::setSuccess();
    }

    public function rollbackHostsFromSnapshot()
    {
        $backupFilePath = $this->getHostsSnapshotPath();
        if (file_exists($backupFilePath)) {
            $oldHosts = file_get_contents($backupFilePath);
            file_put_contents($this->hostFilePath, $oldHosts);
            return self::setSuccess();
        }

        return self::setError('Backup file does not exist.');
    }

    public function fetchHosts()
    {
        $hosts = file_get_contents($this->hostFilePath);
        $hosts = explode("\n\n", $hosts)[0];

        return self::setSuccess(['hosts' => $hosts]);
    }

    public function addHost()
    {
        $ip = $this->request['ip'] ?? '';
        $domain = $this->request['domain'] ?? '';

        if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return self::setError('Invalid IP address.');
        }

        // RFC 1123 hostname: labels of letters/digits/hyphen, dot-separated, max 253 chars
        if (!preg_match('/^(?=.{1,253}$)([a-zA-Z0-9](-?[a-zA-Z0-9])*)(\.[a-zA-Z0-9](-?[a-zA-Z0-9])*)+$/', $domain)) {
            return self::setError('Invalid domain name.');
        }

        $hosts = file_get_contents($this->hostFilePath);
        $hosts = str_replace("\n\n", "\n" . $ip . " " . $domain . "\n\n", $hosts);
        file_put_contents($this->hostFilePath, $hosts);

        // Apply immediately so the new mapping resolves without a separate manual restart.
        $this->logger("dnsspoof host added: {$domain} -> {$ip}", 'info');
        $this->restartDnsmasq();

        return self::setSuccess();
    }

    public function deleteHost()
    {
        $ip = $this->request['ip'] ?? '';
        $domain = $this->request['domain'] ?? '';
        if ($ip === '' || $domain === '') {
            return self::setError('Missing ip or domain.');
        }

        // Remove the matching entry from the managed block (the part before the
        // first blank line, same block addHost writes to). A line matches when its
        // first token is the ip and the domain appears among the remaining tokens.
        $hosts = file_get_contents($this->hostFilePath);
        $blocks = explode("\n\n", $hosts);
        $lines = array_filter(explode("\n", $blocks[0]), function ($line) use ($ip, $domain) {
            $parts = preg_split('/\s+/', trim($line));

            return !($parts[0] === $ip && in_array($domain, array_slice($parts, 1), true));
        });
        $blocks[0] = implode("\n", $lines);
        file_put_contents($this->hostFilePath, implode("\n\n", $blocks));

        // Apply immediately so the removal takes effect without a manual restart.
        $this->restartDnsmasq();

        return self::setSuccess();
    }

    // RFC-1123 hostname (shared by addHost/addWildcard).
    private function isValidDomain($domain)
    {
        return (bool) preg_match('/^(?=.{1,253}$)([a-zA-Z0-9](-?[a-zA-Z0-9])*)(\.[a-zA-Z0-9](-?[a-zA-Z0-9])*)+$/', $domain);
    }

    /**
     * Current wildcard entries from UCI, parsed from `/domain/ip` list items.
     *
     * @return array<int,array{item:string,domain:string,ip:string}>
     */
    private function readWildcards()
    {
        $raw = self::setupCoreHelper()::exec('uci -q get ' . $this->wildcardConfList, true, true);
        $entries = [];
        if ($raw !== false) {
            foreach (preg_split('/\s+/', trim((string) $raw)) as $item) {
                if (preg_match('#^/([^/]+)/(.+)$#', $item, $m)) {
                    $entries[] = ['item' => $item, 'domain' => $m[1], 'ip' => $m[2]];
                }
            }
        }

        return $entries;
    }

    public function fetchWildcards()
    {
        $wildcards = array_map(function ($e) {
            return ['domain' => $e['domain'], 'ip' => $e['ip']];
        }, $this->readWildcards());

        return self::setSuccess(['wildcards' => $wildcards]);
    }

    public function addWildcard()
    {
        $ip = $this->request['ip'] ?? '';
        $domain = $this->request['domain'] ?? '';

        if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return self::setError('Invalid IP address.');
        }
        if (!$this->isValidDomain($domain)) {
            return self::setError('Invalid domain name.');
        }

        // raw=true: uci's `@dnsmasq[0]` brackets must survive (escapeshellcmd would mangle them);
        // only the value is escapeshellarg'd.
        $value = escapeshellarg("/{$domain}/{$ip}");
        self::setupCoreHelper()::exec("uci add_list {$this->wildcardConfList}={$value}", true, true);
        self::setupCoreHelper()::exec('uci commit dhcp', true, true);
        $this->logger("dnsspoof wildcard added: *.{$domain} -> {$ip}", 'info');
        $this->restartDnsmasq();

        return self::setSuccess();
    }

    public function removeWildcard()
    {
        $domain = $this->request['domain'] ?? '';
        $ip = $this->request['ip'] ?? '';
        if ($domain === '') {
            return self::setError('Missing domain.');
        }

        foreach ($this->readWildcards() as $entry) {
            if ($entry['domain'] === $domain && ($ip === '' || $entry['ip'] === $ip)) {
                self::setupCoreHelper()::exec(
                    "uci del_list {$this->wildcardConfList}=" . escapeshellarg($entry['item']),
                    true,
                    true
                );
            }
        }
        self::setupCoreHelper()::exec('uci commit dhcp', true, true);
        $this->restartDnsmasq();

        return self::setSuccess();
    }

    /**
     * Restart dnsmasq so /etc/hosts changes take effect. Goes through the core
     * helper rather than a raw exec() (house pattern).
     */
    private function restartDnsmasq()
    {
        self::setupCoreHelper()::exec('killall dnsmasq');
        self::setupCoreHelper()::exec('/etc/init.d/dnsmasq start');
    }

    public function restartService()
    {
        $this->restartDnsmasq();

        return self::setSuccess();
    }
}
