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

    public $endpointRoutes = [
        'createHostSnapshot' => true,
        'rollbackHostsFromSnapshot' => true,
        'fetchHosts' => true,
        'addHost' => true,
        'deleteHost' => true,
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

        return self::setSuccess();
    }

    public function restartService()
    {
        exec('killall dnsmasq');
        exec('/etc/init.d/dnsmasq start');

        return self::setSuccess();
    }
}
