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
        'createHostSnapshot',
        'rollbackHostsFromSnapshot',
        'fetchHosts',
        'addHost',
        'restartService',
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
        $hosts = file_get_contents($this->hostFilePath);
        $hosts = str_replace("\n\n", "\n" . $this->request['ip'] . " " . $this->request['domain'] . "\n\n", $hosts);
        file_put_contents($this->hostFilePath, $hosts);

        return self::setSuccess();
    }

    public function restartService()
    {
        exec('killall dnsmasq');
        exec('/etc/init.d/dnsmasq start');

        return self::setSuccess();
    }
}
