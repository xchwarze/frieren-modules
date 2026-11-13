<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\usbstorage;

use frieren\helper\OpenWrtHelper;

/** Read-only inventory and explicit selection validation. The shell remains authoritative. */
class StorageDeviceHelper
{
    public static function getInventory($modulePath)
    {
        $scriptPath = self::getScriptPath($modulePath, 'storage-devices.sh');
        $output = OpenWrtHelper::exec('sh ' . escapeshellarg($scriptPath), true, true);
        if (!is_string($output) || $output === '') {
            throw new \RuntimeException('Storage discovery failed or returned no inventory.');
        }

        try {
            // Decode objects as objects so {} cannot masquerade as an empty JSON list.
            $inventory = json_decode($output, false, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new \RuntimeException('Storage discovery returned malformed JSON.', 0, $error);
        }
        if (!$inventory instanceof \stdClass || !isset($inventory->devices) ||
            !is_array($inventory->devices) || !property_exists($inventory, 'error') ||
            ($inventory->error !== null && (!is_string($inventory->error) || $inventory->error === ''))) {
            throw new \RuntimeException('Malformed storage inventory envelope.');
        }

        $devices = [];
        $seen = [];
        foreach ($inventory->devices as $value) {
            $device = self::validateDevice($value);
            if (isset($seen[$device['id']])) {
                throw new \RuntimeException('Malformed storage inventory: duplicate device ID.');
            }
            $seen[$device['id']] = true;
            if ($inventory->error !== null) {
                $device['eligible'] = false;
                $device['reason'] = $inventory->error;
            }
            $devices[] = $device;
        }

        return ['devices' => $devices, 'error' => $inventory->error];
    }

    /** Returns a command for BackgroundTaskHelper, without starting a task. */
    public static function prepareSetup($modulePath, array $request)
    {
        if (count($request) !== 3 || !isset($request['deviceId'], $request['identity'], $request['confirmation']) ||
            !self::validName($request['deviceId']) || !self::validIdentity($request['identity']) ||
            !is_string($request['confirmation']) || $request['confirmation'] !== '/dev/' . $request['deviceId']) {
            throw new \InvalidArgumentException('Expected a canonical deviceId, identity, and matching confirmation path.');
        }

        $scriptPath = self::getScriptPath($modulePath, 'auto-setup.sh');
        $inventory = self::getInventory($modulePath);
        if ($inventory['error'] !== null) {
            throw new \RuntimeException($inventory['error']);
        }
        foreach ($inventory['devices'] as $device) {
            if ($device['id'] !== $request['deviceId']) {
                continue;
            }
            if (!$device['eligible']) {
                throw new \InvalidArgumentException($device['reason']);
            }
            if ($device['identity'] !== $request['identity']) {
                throw new \InvalidArgumentException('Disk identity changed; refresh inventory and confirm again.');
            }

            // BackgroundTaskHelper nests this inside double quotes. Every argument,
            // including the configured script path, must exclude outer-shell syntax;
            // escapeshellarg alone does not prevent $()/backtick expansion there.
            // Use only fresh canonical discovery values, never display metadata.
            return 'sh ' . implode(' ', array_map('escapeshellarg', [
                $scriptPath, $device['id'], $device['identity'], $device['path'],
            ]));
        }

        throw new \InvalidArgumentException('Selected whole disk is not present; refresh inventory.');
    }

    private static function getScriptPath($modulePath, $script)
    {
        if (!is_string($modulePath) || !preg_match('~\A/[a-zA-Z0-9_./-]+\z~', $modulePath)) {
            throw new \RuntimeException('Unsupported module path for safe storage execution.');
        }
        $path = rtrim($modulePath, '/') . '/bin/' . $script;
        if (!is_file($path)) {
            throw new \RuntimeException('Storage script not found: ' . $script);
        }
        return $path;
    }

    private static function validName($value)
    {
        return is_string($value) && preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9._-]*\z/', $value) === 1;
    }

    private static function validIdentity($value)
    {
        if (!is_string($value) || !preg_match(
            '/\Av1:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' .
            ':([0-9]+):([0-9]+):([0-9]+):([0-9]+)\z/', $value, $parts
        )) {
            return false;
        }
        // Match storage_uint's bounds without integer overflow on 32-bit PHP.
        foreach (array_slice($parts, 1) as $number) {
            if (!preg_match('/\A(?:0|[1-9][0-9]{0,13})\z/', $number) ||
                (strlen($number) === 14 && strcmp($number, '17592186044415') > 0)) {
                return false;
            }
        }
        return $parts[3] !== '0' && $parts[4] !== '0';
    }

    private static function validSize($value)
    {
        // The shell emits sector_count * 512, bounded below JavaScript's exact limit.
        return (is_int($value) || is_float($value)) && is_finite((float) $value) &&
            $value >= 0 && $value <= 9007199254740480 && floor((float) $value) === (float) $value;
    }

    private static function stringList($value)
    {
        if (!is_array($value)) {
            return false;
        }
        foreach ($value as $item) {
            if (!is_string($item)) {
                return false;
            }
        }
        return true;
    }

    private static function validateDevice($value)
    {
        if (!$value instanceof \stdClass) {
            throw new \RuntimeException('Malformed storage inventory device.');
        }
        $device = (array) $value;
        foreach (['id', 'path', 'model', 'sizeBytes', 'transport', 'connection', 'identity',
            'eligible', 'reason', 'warnings', 'partitions', 'mounts', 'swaps'] as $field) {
            if (!array_key_exists($field, $device)) {
                throw new \RuntimeException('Malformed storage inventory: missing ' . $field . '.');
            }
        }
        if (!self::validName($device['id']) || $device['path'] !== '/dev/' . $device['id'] ||
            !is_string($device['model']) || !self::validSize($device['sizeBytes']) ||
            !in_array($device['transport'], ['usb', 'sd', 'mmc', 'unknown'], true) ||
            !in_array($device['connection'], ['removable', 'fixed', 'unknown'], true) ||
            !is_string($device['identity']) || ($device['identity'] !== '' && !self::validIdentity($device['identity'])) ||
            !is_bool($device['eligible']) ||
            ($device['reason'] !== null && (!is_string($device['reason']) || $device['reason'] === '')) ||
            !self::stringList($device['warnings']) || !self::stringList($device['mounts']) ||
            !self::stringList($device['swaps']) || !is_array($device['partitions'])) {
            throw new \RuntimeException('Malformed storage inventory device fields.');
        }

        $partitions = [];
        $seen = [];
        foreach ($device['partitions'] as $partition) {
            if (!$partition instanceof \stdClass || !isset($partition->path, $partition->sizeBytes) ||
                !is_string($partition->path) || strncmp($partition->path, '/dev/', 5) !== 0 ||
                !self::validName(substr($partition->path, 5)) || $partition->path === $device['path'] ||
                !self::validSize($partition->sizeBytes) || isset($seen[$partition->path])) {
                throw new \RuntimeException('Malformed storage inventory partition.');
            }
            $seen[$partition->path] = true;
            $partitions[] = (array) $partition;
        }
        $device['partitions'] = $partitions;

        if ($device['eligible']) {
            $identityParts = explode(':', $device['identity']);
            if ($device['identity'] === '' || $device['reason'] !== null ||
                !in_array($device['transport'] . ':' . $device['connection'], ['usb:removable', 'usb:unknown', 'sd:removable'], true) ||
                ($device['connection'] === 'unknown' && $device['warnings'] === []) ||
                $device['mounts'] !== [] || $device['swaps'] !== [] ||
                (float) $device['sizeBytes'] !== (float) $identityParts[5] * 512) {
                throw new \RuntimeException('Malformed storage inventory: inconsistent eligibility or identity.');
            }
        } elseif ($device['reason'] === null) {
            throw new \RuntimeException('Malformed storage inventory: blocked device has no reason.');
        }

        return $device;
    }
}
