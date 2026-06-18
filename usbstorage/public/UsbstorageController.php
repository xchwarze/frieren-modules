<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\usbstorage;

use frieren\helper\BackgroundTaskHelper;

class UsbstorageController extends \frieren\core\Controller
{
    // Background task slot for the auto-setup script. BackgroundTaskHelper owns the
    // completion flag + combined log; the script no longer manages its own flag.
    const TASK_AUTOSETUP = 'usbstorage-autosetup';

    protected $endpointRoutes = [
        // dependency control apis
        'checkModuleDependencies' => true,
        'installModuleDependencies' => true,
        'getDependencyInstallationStatus' => true,

        // other apis
        'startAutoSetup' => true,
        'getAutoSetupStatus' => true,
        'getFstabConfig' => true,
        'saveFstabConfig' => true,
    ];

    public function startAutoSetup()
    {
        if (BackgroundTaskHelper::isRunning(self::TASK_AUTOSETUP)) {
            return self::setError('Auto-setup is already running.');
        }

        $scriptPath = self::getModulePath() . '/bin/auto-setup.sh';
        if (!file_exists($scriptPath)) {
            return self::setError('Auto-setup script not found.');
        }

        // Run via `sh <script>` (not the bare path) so the launch does not depend on
        // the script's +x bit, which a module install/extraction can strip.
        $this->logger('usbstorage auto-setup started', 'info');
        BackgroundTaskHelper::start(self::TASK_AUTOSETUP, 'sh ' . escapeshellarg($scriptPath));

        return self::setSuccess();
    }

    public function getAutoSetupStatus()
    {
        $status = BackgroundTaskHelper::getStatus(self::TASK_AUTOSETUP);

        return self::setSuccess([
            'logContent' => $status['output'],
            'isRunning' => BackgroundTaskHelper::isRunning(self::TASK_AUTOSETUP),
        ]);
    }

    public function getFstabConfig()
    {
        return self::setSuccess([
            'config' => self::setupModuleHelper()::getFstabConfig(),
        ]);
    }

    public function saveFstabConfig()
    {
        if (empty($this->request['config'])) {
            return self::setError('config param value is not valid!');
        }

        if (!self::setupModuleHelper()::saveFstabConfig($this->request['config'])) {
            return self::setError('Error saving fstab config.');
        }

        $this->logger('usbstorage fstab config saved', 'info');

        return self::setSuccess();
    }
}
