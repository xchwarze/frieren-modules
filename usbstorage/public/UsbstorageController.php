<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\usbstorage;

class UsbstorageController extends \frieren\core\Controller
{
    private $autoSetupFlag = '/tmp/auto_setup.flag';
    private $autoSetupLog = '/tmp/auto_setup.log';

    protected $endpointRoutes = [
        // dependency control apis
        'checkModuleDependencies',
        'installModuleDependencies',
        'getDependencyInstallationStatus',

        // other apis
        'startAutoSetup',
        'getAutoSetupStatus',
        'getFstabConfig',
        'saveFstabConfig',
    ];

    public function startAutoSetup()
    {
        $scriptPath = self::getModulePath() . '/bin/auto-setup.sh';
        self::setupCoreHelper()::execBackground("{$scriptPath}", "{$this->autoSetupLog} 2>&1");

        return self::setSuccess();
    }

    public function getAutoSetupStatus()
    {
        return self::setSuccess([
            'logContent' => @file_get_contents($this->autoSetupLog),
            'isRunning' => file_exists($this->autoSetupFlag),
        ]);
    }

    public function getFstabConfig()
    {
        return self::setSuccess([
            'config' => @file_get_contents('/etc/config/fstab'),
        ]);
    }

    public function saveFstabConfig()
    {
        if (empty($this->request['config'])) {
            return self::setError('config param value is not valid!');
        }

        $status = file_put_contents('/etc/config/fstab', $this->request['config']);
        if ($status !== false) {
            exec('/etc/init.d/fstab restart');
            return self::setSuccess();
        }

        return self::setError('Error saving fstab config.');
    }
}
