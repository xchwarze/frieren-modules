<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\usbstorage;

use frieren\helper\OpenWrtHelper;

/**
 * Helper class for the OpenWrt platform.
 *
 * the idea behind this whole mechanism of helpers per platform is that the same module can be supported by different platforms.
 */
class ModuleOpenWrtHelper
{
    const FSTAB_PATH = '/etc/config/fstab';
    const FSTAB_BACKUP = '/tmp/fstab.bak';

    /**
     * Reads the current fstab UCI config.
     *
     * @return string|false Config contents, or false if unreadable.
     */
    public static function getFstabConfig()
    {
        return @file_get_contents(self::FSTAB_PATH);
    }

    /**
     * Restarts the fstab service to apply config changes.
     *
     * @return bool True when the service restarted without a non-zero exit.
     */
    public static function restartFstabService()
    {
        return OpenWrtHelper::exec('/etc/init.d/fstab restart') !== false;
    }

    /**
     * Persists a new fstab config as a guarded mutation: snapshots the current
     * file, writes the new content, restarts the service, and rolls back to the
     * snapshot (re-restarting) if the write or restart fails. A bad fstab can
     * break every mount on reboot, so the previous state is always recoverable.
     *
     * @param string $content New fstab config to write.
     * @return bool True on success; false (with the previous config restored) on failure.
     */
    public static function saveFstabConfig($content)
    {
        $previous = @file_get_contents(self::FSTAB_PATH);
        if ($previous !== false) {
            @file_put_contents(self::FSTAB_BACKUP, $previous);
        }

        // A failed write with mode 'w' may have already truncated the file, so
        // restore the snapshot before bailing.
        if (file_put_contents(self::FSTAB_PATH, $content) === false) {
            if ($previous !== false) {
                file_put_contents(self::FSTAB_PATH, $previous);
            }

            return false;
        }

        // Verify by restarting the service; roll back to the snapshot and
        // re-apply if the restart fails.
        if (!self::restartFstabService()) {
            if ($previous !== false) {
                file_put_contents(self::FSTAB_PATH, $previous);
                self::restartFstabService();
            }

            return false;
        }

        return true;
    }
}
