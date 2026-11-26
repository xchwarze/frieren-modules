<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\handshakes;

use frieren\helper\OpenWrtHelper;

/**
 * OpenWrt-side operations for the handshakes module.
 *
 * Everything that touches the radio (monitor interface lifecycle, airodump-ng
 * capture, aircrack-ng analysis) lives here so the controller stays a thin
 * dispatcher that only validates input and shapes responses.
 */
class ModuleOpenWrtHelper
{
    const MONITOR_INTERFACE = 'frieren-mon';
    const CAPTURE_SUFFIX = '-01.cap';
    const CSV_SUFFIX = '-01.csv';
    const STORAGE_SD = '/sd/handshakes';
    const STORAGE_INTERNAL = '/root/.handshakes';

    /**
     * Capture directory: the SD card when mounted, the internal overlay otherwise.
     * Created on demand so callers can rely on the path existing.
     *
     * @return string
     */
    public static function getStoragePath()
    {
        $path = OpenWrtHelper::isSDAvailable() ? self::STORAGE_SD : self::STORAGE_INTERNAL;
        if (!is_dir($path)) {
            @mkdir($path, 0755, true);
        }

        return $path;
    }

    /**
     * Wireless interfaces (any netdev backed by a phy80211 device).
     *
     * @return string[]
     */
    public static function getWirelessInterfaces()
    {
        $interfaces = [];
        foreach (self::readNetDevices() as $name) {
            if (file_exists("/sys/class/net/{$name}/phy80211")) {
                $interfaces[] = $name;
            }
        }

        return $interfaces;
    }

    /**
     * Interfaces currently operating as a monitor (the capture-capable ones).
     *
     * @return string[]
     */
    public static function getMonitorInterfaces()
    {
        return array_values(array_filter(self::getWirelessInterfaces(), function ($name) {
            return self::isMonitorInterface($name);
        }));
    }

    /**
     * @param string $interface
     * @return bool
     */
    public static function isMonitorInterface($interface)
    {
        if (!preg_match('/^[A-Za-z0-9_.-]+$/', $interface)) {
            return false;
        }

        $info = OpenWrtHelper::exec('iw dev ' . escapeshellarg($interface) . ' info', true, true);

        return is_string($info) && strpos($info, 'type monitor') !== false;
    }

    /**
     * @param string $interface
     * @return string|false The wireless phy name (e.g. "phy0") or false.
     */
    public static function getPhyName($interface)
    {
        if (!preg_match('/^[A-Za-z0-9_.-]+$/', $interface)) {
            return false;
        }

        $path = "/sys/class/net/{$interface}/phy80211/name";
        if (!file_exists($path)) {
            return false;
        }

        $phy = trim((string)file_get_contents($path));

        return $phy !== '' ? $phy : false;
    }

    /**
     * Return a monitor interface usable for capture: `$interface` itself when it
     * is already a monitor, otherwise a dedicated `frieren-mon` vif added on the
     * same phy. Never mutates a running infrastructure interface's type, so it
     * cannot knock the panel's own AP offline.
     *
     * @param string $interface
     * @return string|false Monitor interface name, or false when none could be created.
     */
    public static function ensureMonitorInterface($interface)
    {
        if (self::isMonitorInterface($interface)) {
            return $interface;
        }

        $phy = self::getPhyName($interface);
        if ($phy === false) {
            return false;
        }

        if (!self::isMonitorInterface(self::MONITOR_INTERFACE)) {
            OpenWrtHelper::exec(
                'iw phy ' . escapeshellarg($phy) . ' interface add ' . escapeshellarg(self::MONITOR_INTERFACE) . ' type monitor',
                true,
                true
            );
        }

        // Bringing it up is idempotent and required before airodump-ng can use it.
        OpenWrtHelper::exec('ip link set ' . escapeshellarg(self::MONITOR_INTERFACE) . ' up', true, true);

        return self::isMonitorInterface(self::MONITOR_INTERFACE) ? self::MONITOR_INTERFACE : false;
    }

    /**
     * Remove the module-managed monitor vif if it exists. Best-effort: a failed
     * delete (e.g. the vif was never created) is not an error.
     */
    public static function removeMonitorInterface()
    {
        if (self::isMonitorInterface(self::MONITOR_INTERFACE)) {
            OpenWrtHelper::exec('iw dev ' . escapeshellarg(self::MONITOR_INTERFACE) . ' del', true, true);
        }
    }

    /**
     * Lock a monitor interface to a single channel (1-196). Requires a monitor type.
     *
     * @param string $monitor
     * @param int $channel
     * @return bool
     */
    public static function setChannel($monitor, $channel)
    {
        if (!preg_match('/^[A-Za-z0-9_.-]+$/', $monitor) || $channel < 1 || $channel > 196) {
            return false;
        }

        $result = OpenWrtHelper::exec(
            'iw dev ' . escapeshellarg($monitor) . ' set channel ' . escapeshellarg((string)$channel),
            true,
            true
        );

        return $result !== false;
    }

    /**
     * @return bool Both airodump-ng and aircrack-ng are available.
     */
    public static function toolsAvailable()
    {
        return OpenWrtHelper::commandExists('airodump-ng') && OpenWrtHelper::commandExists('aircrack-ng');
    }

    /**
     * Captured files in the storage dir (aircrack/aircrack-ng `.cap` output),
     * newest first.
     *
     * @return array<int,array{name:string,size:int,modified:int}>
     */
    public static function listCaptures()
    {
        $dir = self::getStoragePath();
        $entries = array_diff(scandir($dir, SCANDIR_SORT_DESCENDING) ?: [], ['.', '..']);
        $captures = [];

        foreach ($entries as $name) {
            $path = "{$dir}/{$name}";
            if (!is_file($path) || !preg_match('/\.(cap|pcap)$/i', $name)) {
                continue;
            }

            $captures[] = [
                'name' => $name,
                'size' => filesize($path),
                'modified' => filemtime($path),
            ];
        }

        return $captures;
    }

    /**
     * Access points seen in a capture, parsed from the airodump-ng CSV sidecar
     * (`<prefix>-01.csv`). Returns an empty list when the CSV is absent or the
     * capture is still open (the CSV header row is all we can rely on mid-capture).
     *
     * @param string $captureName
     * @return array<int,array{bssid:string,channel:string,essid:string}>
     */
    public static function readCaptureAccessPoints($captureName)
    {
        $dir = self::getStoragePath();
        $baseName = basename($captureName);
        if (substr($baseName, -strlen(self::CAPTURE_SUFFIX)) !== self::CAPTURE_SUFFIX) {
            return [];
        }

        $csvPath = $dir . '/' . substr($baseName, 0, -strlen(self::CAPTURE_SUFFIX)) . self::CSV_SUFFIX;
        if (!is_file($csvPath)) {
            return [];
        }

        $accessPoints = [];
        $handle = fopen($csvPath, 'r');
        if ($handle === false) {
            return [];
        }

        $inApSection = false;
        while (($row = fgetcsv($handle)) !== false) {
            // airodump-ng CSV: a station section follows a blank-ish row; AP rows
            // start with a MAC-shaped BSSID. Stop at the first non-AP marker.
            if (isset($row[0]) && trim($row[0]) === 'BSSID') {
                $inApSection = true;
                continue;
            }
            if (!$inApSection) {
                continue;
            }
            if (count($row) < 14 || !preg_match('/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/', trim($row[0]))) {
                break;
            }

            $accessPoints[] = [
                'bssid' => trim($row[0]),
                'channel' => trim($row[3]),
                'essid' => trim((string)end($row)),
            ];
        }
        fclose($handle);

        return $accessPoints;
    }

    /**
     * Count EAPOL handshakes / PMKIDs aircrack-ng can find in a capture. Bounded:
     * aircrack-ng exits quickly when the file has no candidates.
     *
     * @param string $captureName
     * @return array{handshakes:int,pmkid:int}|false
     */
    public static function analyzeCapture($captureName)
    {
        $dir = self::getStoragePath();
        $path = $dir . '/' . basename($captureName);
        if (!is_file($path)) {
            return false;
        }

        $output = OpenWrtHelper::exec('aircrack-ng ' . escapeshellarg($path) . ' 2>&1', true, true);
        if ($output === false) {
            return false;
        }

        $handshakes = 0;
        $pmkid = 0;
        if (preg_match('/(\d+)\s+handshake/i', $output, $m)) {
            $handshakes = (int)$m[1];
        }
        if (preg_match('/(\d+)\s+PMKID/i', $output, $m)) {
            $pmkid = (int)$m[1];
        }

        return ['handshakes' => $handshakes, 'pmkid' => $pmkid];
    }

    /**
     * @return string[] Netdev names under /sys/class/net.
     */
    private static function readNetDevices()
    {
        $entries = scandir('/sys/class/net/');

        return $entries === false ? [] : array_values(array_diff($entries, ['.', '..']));
    }
}
