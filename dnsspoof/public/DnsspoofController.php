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

    // Guarded-commit snapshot: a bad dhcp commit can take dnsmasq (all DNS) down, so we
    // snapshot the committed file and roll back if dnsmasq fails to come back up.
    const DHCP_CONFIG = '/etc/config/dhcp';
    const DHCP_BACKUP = '/tmp/fm-dnsspoof-dhcp.bak';

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
        if (!$this->commitDhcpGuarded()) {
            return self::setError('Failed to apply wildcard: dnsmasq did not restart; configuration rolled back.');
        }

        $this->logger("dnsspoof wildcard added: *.{$domain} -> {$ip}", 'info');

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
        if (!$this->commitDhcpGuarded()) {
            return self::setError('Failed to apply change: dnsmasq did not restart; configuration rolled back.');
        }

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

    /**
     * Commit a staged `dhcp` UCI change and restart dnsmasq as a guarded mutation:
     * snapshot /etc/config/dhcp first, commit + restart, and if dnsmasq does not come
     * back up, restore the snapshot (and revert any staged change) and restart again —
     * so a bad wildcard value can never leave DNS down for every client.
     *
     * @return bool True when dnsmasq is running after the commit.
     */
    private function commitDhcpGuarded()
    {
        $previous = @file_get_contents(self::DHCP_CONFIG);
        if ($previous !== false) {
            @file_put_contents(self::DHCP_BACKUP, $previous);
        }

        self::setupCoreHelper()::exec('uci commit dhcp', true, true);
        $this->restartDnsmasq();
        sleep(1);

        if (self::setupCoreHelper()::checkRunning('dnsmasq')) {
            return true;
        }

        // dnsmasq failed to come up — restore the previous config, drop staged changes,
        // and restart again so resolution recovers.
        if ($previous !== false) {
            file_put_contents(self::DHCP_CONFIG, $previous);
            self::setupCoreHelper()::exec('uci revert dhcp', true, true);
            $this->restartDnsmasq();
        }

        return false;
    }

    public function restartService()
    {
        $this->restartDnsmasq();

        return self::setSuccess();
    }
}
