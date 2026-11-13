<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

// Only framework boundaries are doubled. These tests never execute a shell command.
namespace frieren\helper {
    class OpenWrtHelper
    {
        public static $outputs = [];
        public static $calls = [];

        public static function exec($command, $merge = true, $raw = false)
        {
            self::$calls[] = [$command, $merge, $raw];
            if (self::$outputs === []) {
                throw new \RuntimeException('Unexpected inventory execution.');
            }
            return array_shift(self::$outputs);
        }
    }

    class BackgroundTaskHelper
    {
        public static $starts = [];
        public static $running = false;
        public static $status = ['completed' => false, 'output' => 'fixture progress'];
        public static $tasks = [];

        public static function start($taskName, $command)
        {
            self::$starts[] = [$taskName, $command];
        }

        public static function isRunning($taskName)
        {
            self::$tasks[] = $taskName;
            return self::$running;
        }

        public static function getStatus($taskName)
        {
            self::$tasks[] = $taskName;
            return self::$status;
        }
    }
}

namespace frieren\core {
    // The real base controller routes the request, supplies the module path, and
    // writes responses. Authentication/CSRF checks belong to ApiCore before routing.
    abstract class Controller
    {
        protected $request;
        public $response;
        public static $modulePath;
        public static $logs = [];

        public function __construct($request, $moduleName)
        {
            $this->request = $request;
            $action = $request['action'] ?? '';
            $this->response = isset($this->endpointRoutes[$action])
                ? $this->{$action}() : $this->setError('Unknown action');
        }

        protected function getModulePath()
        {
            return self::$modulePath;
        }

        protected function setError($message = 'The action could not be completed due to an error.')
        {
            return ['error' => $message];
        }

        protected function setSuccess($response = ['success' => true])
        {
            return $response;
        }

        protected function logger($message, $level = 'err')
        {
            self::$logs[] = [$message, $level];
        }
    }
}

namespace {
    use frieren\core\Controller;
    use frieren\helper\BackgroundTaskHelper;
    use frieren\helper\OpenWrtHelper;
    use frieren\modules\usbstorage\StorageDeviceHelper;
    use frieren\modules\usbstorage\UsbstorageController;

    spl_autoload_register(function ($class) {
        $prefix = 'frieren\\modules\\usbstorage\\';
        if (strncmp($class, $prefix, strlen($prefix)) === 0) {
            $path = dirname(__DIR__) . '/public/' . substr($class, strlen($prefix)) . '.php';
            if (is_file($path)) {
                require $path;
            }
        }
    });

    const IDENTITY = 'v1:12345678-1234-1234-1234-123456789abc:8:0:12:16777216';
    $modulePath = dirname(__DIR__) . '/public';
    $passed = 0;
    $failed = 0;

    function same($expected, $actual)
    {
        if ($expected !== $actual) {
            throw new \Exception('Expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
        }
    }

    function rejects($call, $messagePart = '')
    {
        try {
            $call();
        } catch (\InvalidArgumentException | \RuntimeException $error) {
            if ($error->getMessage() === '' || stripos($error->getMessage(), $messagePart) === false) {
                throw new \Exception('Missing descriptive validation error: ' . $error->getMessage());
            }
            return;
        }
        throw new \Exception('Expected validation rejection.');
    }

    function test($name, $call)
    {
        global $passed, $failed, $modulePath;
        OpenWrtHelper::$outputs = [];
        OpenWrtHelper::$calls = [];
        BackgroundTaskHelper::$starts = [];
        BackgroundTaskHelper::$running = false;
        BackgroundTaskHelper::$tasks = [];
        Controller::$modulePath = $modulePath;
        Controller::$logs = [];
        try {
            $call();
            $passed++;
        } catch (\Throwable $error) {
            $failed++;
            echo "FAIL {$name}: {$error->getMessage()}\n";
        }
    }

    function device($changes = [])
    {
        return array_replace([
            'id' => 'sda', 'path' => '/dev/sda', 'model' => 'Fixture USB SSD',
            'sizeBytes' => 8589934592, 'transport' => 'usb', 'connection' => 'removable',
            'identity' => IDENTITY, 'eligible' => true, 'reason' => null, 'warnings' => [],
            'partitions' => [['path' => '/dev/sda1', 'sizeBytes' => 2147483648]],
            'mounts' => [], 'swaps' => [],
        ], $changes);
    }

    function inventory($devices = null, $error = null)
    {
        return ['devices' => $devices ?? [device()], 'error' => $error];
    }

    function queueInventory($inventory)
    {
        OpenWrtHelper::$outputs[] = json_encode($inventory, JSON_THROW_ON_ERROR);
    }

    function selection($changes = [])
    {
        return array_replace(['deviceId' => 'sda', 'identity' => IDENTITY, 'confirmation' => '/dev/sda'], $changes);
    }

    function controller($action, $request = [])
    {
        return (new UsbstorageController(array_merge([
            'module' => 'usbstorage', 'action' => $action,
        ], $request), 'usbstorage'))->response;
    }

    function rejectedSetup($request, $fixture = null, $messagePart = '')
    {
        global $modulePath;
        queueInventory($fixture ?? inventory());
        $response = controller('startAutoSetup', $request);
        same(true, isset($response['error']) && is_string($response['error']) && $response['error'] !== '');
        same([], BackgroundTaskHelper::$starts);
        same([], Controller::$logs);
        OpenWrtHelper::$outputs = [];
        queueInventory($fixture ?? inventory());
        rejects(function () use ($modulePath, $request) {
            StorageDeviceHelper::prepareSetup($modulePath, $request);
        }, $messagePart);
    }

    test('inventory preserves the complete display contract and uses read-only CLI', function () use ($modulePath) {
        $fixture = inventory();
        queueInventory($fixture);
        same($fixture, StorageDeviceHelper::getInventory($modulePath));
        same([["sh '{$modulePath}/bin/storage-devices.sh'", true, true]], OpenWrtHelper::$calls);
        same([], BackgroundTaskHelper::$starts);
    });

    test('inventory action exposes the contract through the module route', function () {
        queueInventory(inventory());
        same(inventory(), controller('getStorageDevices'));
        same([], BackgroundTaskHelper::$starts);
    });

    test('empty inventory is not an execution error', function () use ($modulePath) {
        queueInventory(inventory([]));
        same(inventory([]), StorageDeviceHelper::getInventory($modulePath));
    });

    test('blocked devices with unavailable identity remain visible', function () use ($modulePath) {
        $fixture = inventory([device(['identity' => '', 'eligible' => false, 'reason' => 'Unknown or unstable disk identity.'])]);
        queueInventory($fixture);
        same($fixture, StorageDeviceHelper::getInventory($modulePath));
    });

    test('unknown USB connection preserves its explicit warning and is eligible', function () use ($modulePath) {
        $fixture = inventory([device(['connection' => 'unknown', 'warnings' => ['Verify external connection before erasing.']])]);
        queueInventory($fixture);
        same($fixture, StorageDeviceHelper::getInventory($modulePath));
        queueInventory($fixture);
        same("sh '{$modulePath}/bin/auto-setup.sh' 'sda' '" . IDENTITY . "' '/dev/sda'",
            StorageDeviceHelper::prepareSetup($modulePath, selection()));
    });

    test('global inventory error blocks all targets even if producer claims eligibility', function () use ($modulePath) {
        queueInventory(inventory(null, 'Cannot resolve system backing storage.'));
        $result = StorageDeviceHelper::getInventory($modulePath);
        same('Cannot resolve system backing storage.', $result['error']);
        same(false, $result['devices'][0]['eligible']);
        same('Cannot resolve system backing storage.', $result['devices'][0]['reason']);
        rejectedSetup(selection(), inventory(null, 'Cannot resolve system backing storage.'), 'system');
    });

    $badOutputs = [
        'execution failure' => false,
        'empty stdout' => '', 'invalid JSON' => '{', 'trailing output' => '{"devices":[],"error":null}\nnoise',
        'null root' => 'null', 'list root' => '[]', 'missing devices' => '{"error":null}',
        'missing error' => '{"devices":[]}', 'object devices' => '{"devices":{},"error":null}',
        'null devices' => '{"devices":null,"error":null}', 'wrong error type' => '{"devices":[],"error":false}',
        'empty error' => '{"devices":[],"error":""}',
    ];
    foreach ($badOutputs as $name => $output) {
        test('rejects discovery ' . $name, function () use ($modulePath, $output) {
            OpenWrtHelper::$outputs[] = $output;
            rejects(function () use ($modulePath) { StorageDeviceHelper::getInventory($modulePath); });
            OpenWrtHelper::$outputs[] = $output;
            same(true, isset(controller('getStorageDevices')['error']));
            OpenWrtHelper::$outputs[] = $output;
            same(true, isset(controller('startAutoSetup', selection())['error']));
            same([], BackgroundTaskHelper::$starts);
        });
    }

    $badDevices = [
        'non-object' => [], 'injected id' => device(['id' => 'sda$(id)']),
        'noncanonical path' => device(['path' => '/dev/disk/by-id/sda']),
        'mismatched path' => device(['path' => '/dev/sdb']),
        'wrong model type' => device(['model' => []]),
        'string capacity' => device(['sizeBytes' => '8589934592']),
        'negative capacity' => device(['sizeBytes' => -1]),
        'fractional capacity' => device(['sizeBytes' => 1.5]),
        'overflow capacity' => device(['sizeBytes' => 9007199254740992]),
        'capacity identity mismatch' => device(['sizeBytes' => 8589934080]),
        'unknown transport enum' => device(['transport' => 'sata']),
        'unknown connection enum' => device(['connection' => 'hotplug']),
        'wrong eligibility type' => device(['eligible' => 'true']),
        'wrong reason type' => device(['reason' => false]),
        'eligible with blocking reason' => device(['reason' => 'Mounted.']),
        'blocked without reason' => device(['eligible' => false]),
        'blocked empty reason' => device(['eligible' => false, 'reason' => '']),
        'wrong identity type' => device(['identity' => 1]),
        'missing eligible identity' => device(['identity' => '']),
        'malformed identity' => device(['identity' => 'v1:unknown']),
        'missing unknown USB warning' => device(['connection' => 'unknown']),
        'warning object' => device(['warnings' => (object) []]),
        'wrong warning type' => device(['warnings' => [false]]),
        'partition object' => device(['partitions' => (object) []]),
        'partition non-object' => device(['partitions' => [[]]]),
        'partition missing size' => device(['partitions' => [['path' => '/dev/sda1']]]),
        'partition injected path' => device(['partitions' => [['path' => '/dev/sda1;id', 'sizeBytes' => 512]]]),
        'partition same as disk' => device(['partitions' => [['path' => '/dev/sda', 'sizeBytes' => 512]]]),
        'partition wrong size type' => device(['partitions' => [['path' => '/dev/sda1', 'sizeBytes' => '512']]]),
        'duplicate partitions' => device(['partitions' => [
            ['path' => '/dev/sda1', 'sizeBytes' => 512], ['path' => '/dev/sda1', 'sizeBytes' => 512],
        ]]),
        'mounts object' => device(['mounts' => (object) []]),
        'wrong mount type' => device(['mounts' => [false]]),
        'wrong swaps type' => device(['swaps' => false]),
        'wrong swap entry type' => device(['swaps' => [12]]),
        'forged eMMC eligibility' => device(['transport' => 'mmc', 'connection' => 'fixed']),
        'forged fixed USB eligibility' => device(['connection' => 'fixed']),
        'forged SD eligibility' => device(['transport' => 'sd', 'connection' => 'unknown']),
        'forged unknown transport eligibility' => device(['transport' => 'unknown']),
        'forged mounted eligibility' => device(['mounts' => ['/mnt/usb']]),
        'forged active swap eligibility' => device(['swaps' => ['/dev/sda1']]),
    ];
    foreach (array_keys(device()) as $field) {
        $missing = device();
        unset($missing[$field]);
        $badDevices['missing ' . $field] = $missing;
    }
    foreach ($badDevices as $name => $badDevice) {
        test('rejects malformed inventory device: ' . $name, function () use ($badDevice) {
            rejectedSetup(selection(), inventory([$badDevice]));
            queueInventory(inventory([$badDevice]));
            same(true, isset(controller('getStorageDevices')['error']));
        });
    }

    test('duplicate whole disk identifiers are rejected', function () {
        rejectedSetup(selection(), inventory([device(), device()]));
    });

    test('explicit setup command contains exactly the freshly discovered selection', function () use ($modulePath) {
        queueInventory(inventory());
        same("sh '{$modulePath}/bin/auto-setup.sh' 'sda' '" . IDENTITY . "' '/dev/sda'",
            StorageDeviceHelper::prepareSetup($modulePath, selection()));
        same(1, count(OpenWrtHelper::$calls));
        same([], BackgroundTaskHelper::$starts);
    });

    test('controller launches the existing task only after validation', function () use ($modulePath) {
        queueInventory(inventory());
        same(['success' => true], controller('startAutoSetup', selection()));
        same([['usbstorage-autosetup', "sh '{$modulePath}/bin/auto-setup.sh' 'sda' '" . IDENTITY . "' '/dev/sda'"]],
            BackgroundTaskHelper::$starts);
        same([['usbstorage auto-setup started', 'info']], Controller::$logs);
    });

    test('removable SD uses its selected whole disk rather than USB priority', function () use ($modulePath) {
        $identity = 'v1:12345678-1234-1234-1234-123456789abc:179:0:42:16777216';
        queueInventory(inventory([device(), device([
            'id' => 'mmcblk1', 'path' => '/dev/mmcblk1', 'transport' => 'sd',
            'identity' => $identity, 'partitions' => [],
        ])]));
        same("sh '{$modulePath}/bin/auto-setup.sh' 'mmcblk1' '{$identity}' '/dev/mmcblk1'",
            StorageDeviceHelper::prepareSetup($modulePath, selection([
                'deviceId' => 'mmcblk1', 'identity' => $identity, 'confirmation' => '/dev/mmcblk1',
            ])));
    });

    test('untrusted display metadata never enters the setup command', function () use ($modulePath) {
        queueInventory(inventory([device([
            'model' => "\"; $(touch /not-run) `id` ' \\ \n",
            'warnings' => ['$(id) " `id`'],
        ])]));
        same("sh '{$modulePath}/bin/auto-setup.sh' 'sda' '" . IDENTITY . "' '/dev/sda'",
            StorageDeviceHelper::prepareSetup($modulePath, selection()));
    });

    $badRequests = [
        'legacy no arguments' => [], 'bare path only' => ['path' => '/dev/sda'],
        'missing device' => ['identity' => IDENTITY, 'confirmation' => '/dev/sda'],
        'missing identity' => ['deviceId' => 'sda', 'confirmation' => '/dev/sda'],
        'missing confirmation' => ['deviceId' => 'sda', 'identity' => IDENTITY],
        'extra metadata' => selection(['model' => 'ignored']),
        'extra path' => selection(['path' => '/dev/sda']),
        'device path instead of ID' => selection(['deviceId' => '/dev/sda']),
        'unknown device' => selection(['deviceId' => 'sdb', 'confirmation' => '/dev/sdb']),
        'partition instead of disk' => selection(['deviceId' => 'sda1', 'confirmation' => '/dev/sda1']),
        'mismatched confirmation' => selection(['confirmation' => '/dev/sdb']),
        'alias confirmation' => selection(['confirmation' => '/dev/disk/by-id/sda']),
        'stale identity' => selection(['identity' => str_replace(':12:', ':13:', IDENTITY)]),
    ];
    foreach (['deviceId', 'identity', 'confirmation'] as $field) {
        foreach (['' => '', 'array' => [], 'object' => (object) [], 'null' => null, 'integer' => 1, 'boolean' => true] as $type => $value) {
            $badRequests[$field . ' wrong type/value ' . $type] = selection([$field => $value]);
        }
        foreach (["sda;id", '$(id)', '`id`', 'sda";id', "sda'", "sda\n", 'sda\\', "sda\0", 'sda/../sdb'] as $value) {
            $badRequests[$field . ' injection ' . bin2hex($value)] = selection([$field => $value]);
        }
    }
    foreach ([
        'v2:12345678-1234-1234-1234-123456789abc:8:0:12:16777216',
        'v1:12345678-1234-1234-1234-123456789abz:8:0:12:16777216',
        str_replace(':8:0:', ':08:0:', IDENTITY), str_replace(':8:0:', ':8:00:', IDENTITY),
        str_replace(':8:0:', ':-1:0:', IDENTITY), str_replace(':8:0:', ':17592186044416:0:', IDENTITY),
        str_replace(':12:', ':0:', IDENTITY), str_replace(':12:', ':012:', IDENTITY),
        str_replace(':12:', ':17592186044416:', IDENTITY),
        str_replace(':16777216', ':0', IDENTITY), str_replace(':16777216', ':016777216', IDENTITY),
        str_replace(':16777216', ':17592186044416', IDENTITY), IDENTITY . "\n", IDENTITY . ':1',
    ] as $index => $identity) {
        $badRequests['noncanonical identity ' . $index] = selection(['identity' => $identity]);
    }
    foreach ($badRequests as $name => $request) {
        test('rejects setup ' . $name . ' without background launch', function () use ($request) {
            rejectedSetup($request);
        });
    }

    foreach (['System backing disk.', 'Internal eMMC is not supported.', 'Device is read-only.',
        'Device or partition is mounted.', 'Device is used by active swap.',
        'Device or partition is held by another block device.', 'Unknown or unstable disk identity.'] as $reason) {
        test('rejects blocked selection: ' . $reason, function () use ($reason) {
            rejectedSetup(selection(), inventory([device(['eligible' => false, 'reason' => $reason])]), $reason);
        });
    }

    test('selection disappearance is not replaced with another eligible disk', function () {
        rejectedSetup(selection(), inventory([device(['id' => 'sdb', 'path' => '/dev/sdb', 'partitions' => []])]), 'present');
    });

    test('setup re-enumerates rather than using prior inventory', function () {
        queueInventory(inventory());
        same(inventory(), controller('getStorageDevices'));
        queueInventory(inventory([device(['identity' => str_replace(':12:', ':13:', IDENTITY)])]));
        $response = controller('startAutoSetup', selection());
        same(true, isset($response['error']) && stripos($response['error'], 'identity') !== false);
        same(2, count(OpenWrtHelper::$calls));
        same([], BackgroundTaskHelper::$starts);
    });

    test('concurrency guard refuses launch before discovery', function () {
        BackgroundTaskHelper::$running = true;
        same(['error' => 'Auto-setup is already running.'], controller('startAutoSetup', selection()));
        same([], OpenWrtHelper::$calls);
        same([], BackgroundTaskHelper::$starts);
    });

    test('status preserves existing polling contract and task slot', function () {
        BackgroundTaskHelper::$running = true;
        same(['logContent' => 'fixture progress', 'isRunning' => true], controller('getAutoSetupStatus'));
        same(['usbstorage-autosetup', 'usbstorage-autosetup'], BackgroundTaskHelper::$tasks);
    });

    test('missing scripts produce validation errors instead of a launch', function () use ($modulePath) {
        rejects(function () use ($modulePath) { StorageDeviceHelper::getInventory($modulePath . '/missing'); }, 'script');
        rejects(function () use ($modulePath) { StorageDeviceHelper::prepareSetup($modulePath . '/missing', selection()); }, 'script');
        Controller::$modulePath = $modulePath . '/missing';
        same(true, isset(controller('startAutoSetup', selection())['error']));
        same([], BackgroundTaskHelper::$starts);
    });

    foreach (['/tmp/module$(id)', '/tmp/module`id`', '/tmp/module"', "/tmp/module'", '/tmp/module\\',
        "/tmp/module\n", '/tmp/module space', 'relative/module'] as $path) {
        test('unsafe module path cannot reach nested background quoting: ' . bin2hex($path), function () use ($path) {
            rejects(function () use ($path) { StorageDeviceHelper::prepareSetup($path, selection()); }, 'path');
            Controller::$modulePath = $path;
            same(true, isset(controller('startAutoSetup', selection())['error']));
            same([], OpenWrtHelper::$calls);
            same([], BackgroundTaskHelper::$starts);
        });
    }

    echo "{$passed} passed, {$failed} failed\n";
    exit($failed === 0 ? 0 : 1);
}
