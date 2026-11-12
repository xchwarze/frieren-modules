# USB Storage Module

Configure explicitly selected external USB storage or removable SD cards on OpenWrt. Setup erases one whole device, creates **1 GiB swap plus an ext4 data partition mounted at `/sd`**, and preserves unrelated fstab entries. Internal eMMC is never supported, even when it does not contain the running system. There is no force override or automatic destination selection.

## Safe setup in the browser

1. Open **Setup device**. Read-only discovery lists device paths, models, capacities, transports, connection information, existing partitions, mounts, swap, warnings, and blocking reasons. Protected disks remain visible but cannot be selected.
2. Choose an eligible disk yourself. Nothing is preselected, including when only one disk is available. Existing partitions do not mean a device is empty.
3. Choose **Review erase**. Check the exact disk, capacity, model, warnings, and proposed layout. Type its displayed canonical `/dev/...` path exactly, without extra spaces.
4. Choose **Erase device** only if you intend to destroy **every partition and all data on that disk**. Formatting cannot be undone.
5. Read the progress log. **Not running does not mean successful**: the status API provides liveness and logs, not an exit-code success field. Failures can leave a formatted disk or partial configuration/activation; there is no rollback guarantee.

**Refresh** reloads inventory and task status and clears the selection and typed confirmation. Changed/missing identity, lost eligibility, or discovery failure also invalidates the selection. A rejected request displays the backend reason; the UI never chooses another destination or automatically retries an erase. Unknown/loading/error task status, inventory refresh, pending requests, and running tasks block submission. Existing running tasks are checked on page load and status polls every second. When a running task stops, inventory refreshes and logs remain visible.

USB ancestry must be positively identified. A USB SSD reporting non-removable media is not automatically internal. Positive fixed/internal information at the storage device's USB attachment blocks setup. An integrated intermediate hub describes its own attachment, not the downstream storage connection. **An unknown USB physical connection location remains eligible only after all other checks, with a visible warning and explicit confirmation.** This is a usability tradeoff, not proof that the disk is physically external.

## Refusal conditions and capability limits

- System/boot/ROM/overlay/extroot backing disks, all MMC/eMMC, unknown transport, unstable disk identity, read-only devices, mounted filesystems, active swap, block holders, and conflicting `/sd` mounts/configuration are refused. Unrelated filesystems are never force-unmounted.
- Discovery and formatting require reliable kernel disk-generation information and resolvable system backing storage. Missing evidence causes a clear refusal, not a compatibility bypass. A `mmcblk*` name alone does not identify external storage: only positively identified removable SD is supported.
- Stock PARTLABEL roots use verified kernel partition metadata. PARTUUID roots require an **already-installed supported full `blkid` probe**; without it setup refuses. Installing the base module dependencies alone does not guarantee this capability.
- Canonical device numbers use stock BusyBox `ls -dnL` numeric block/character-node output, not an undeclared `stat` dependency. Missing/unsupported numeric output refuses setup; inventory adds no package dependency.
- The retained **DOS partition table limits setup to at most 2 TiB (2,199,023,255,552 bytes)**. Larger media are refused before any writer, even when a 4Kn device could support a larger DOS layout. GPT and larger-device support are not included.
- Mount checks validate a fresh `/proc/self/mountinfo` snapshot on the OpenWrt host. Run setup on the router host, not in a container or chroot. Mounts hidden in other namespaces or chroots are outside this host-only scope; setup does not inspect processes/threads or prove complete namespace visibility. The earlier hidden-mount concern is excluded, not technically fixed.
- Every configured loop is reverse-resolved, even without mounts, swap, or sysfs holders. Its resolved physical backing disks are held; unresolved or changing loop backing refuses setup. Fresh host mount and loop checks also run before activation, retaining the snapshot for swapfile backing resolution.
- Fstab targets must use one single-line, single-quoted UCI scalar. Embedded apostrophe encodings, lists, multiline values, and malformed targets are conservatively refused before erasure. No metadata is evaluated as shell code.
- Mounted Btrfs, emulated/unproven MTD, and aliased `/sd` paths are deliberately unsupported/refused. Known MTD/UBI-root systems and eMMC-root systems can still offer safe external USB/SD candidates when all evidence is available.
- PHP re-enumerates the selected device before launch. The scripts validate the same identity/usage policy again at the destructive boundary and after waits. An atomic lock spans the entire operation. Userspace checks cannot make arbitrary hotplug or external mounting races atomic; avoid changing connections or mounting disks during setup.
- SIGKILL or power loss can leave `/var/lock/usbstorage-setup.lock` stale. Inspect the running processes, device state, and logs before an operator clears it. Never remove a live operation's lock.
- Additional hardware drivers may be required. NTFS, exFAT, and FAT32 setup are not supported.
- The initial functional target is OpenWrt 24.x. Automated fixtures do **not** establish physical OpenWrt behavior. No physical-device or 32-bit verification has occurred.

## Manual scripts

Use the installed module's `bin` directory (the source files live in `public/bin`). Discovery is read-only:

```sh
sh ./storage-devices.sh
```

Inspect the JSON's `error`, `eligible`, `reason`, and `warnings` first. Choose one whole disk and copy its exact `id` and fresh `identity` token. Do not select the first result or infer an ID from a `mmcblk*` name. After checking the model, size, path, partitions, and physical device, replace these placeholders yourself:

```sh
device_id='REPLACE_WITH_SELECTED_ID'
identity='REPLACE_WITH_FRESH_IDENTITY'
printf 'Type the selected canonical /dev/... path to erase ALL its data: '
IFS= read -r confirmation
sh ./auto-setup.sh "$device_id" "$identity" "$confirmation"
```

The three arguments are mandatory. Old no-argument calls refuse; a missing, changed, busy, or unsafe selection never falls back to another disk. Both `auto-setup.sh` (format and configure) and `format-device.sh` (format only) enforce the same policy and exact-path confirmation. Do not run both for one setup. Advanced `post-format.sh` usage requires five arguments: device ID, the same identity, exact confirmation, and the exact newly created swap and data partition paths. Never guess partition suffixes or use positional fstab entries. Failures return nonzero and must be inspected.

## Requirements and other features

The module's dependency manager installs `block-mount`, `e2fsprogs`, `kmod-fs-ext4`, `kmod-usb-storage-extras`, `fdisk`, and `swap-utils` via opkg. Kernel/system-topology capabilities described above are also required and are not supplied by that package list.

OpenWrt 24.10's `swap-utils` package installs the UUID-capable util-linux writer at **`/usr/sbin/mkswap`**. Setup invokes that exact path, not the default UUID-less BusyBox `/sbin/mkswap`. Before `fdisk`, read-only version/help queries and a device-less invalid-UUID parsing check verify UUID support, including rejection of a util-linux build without libuuid. Missing or unsupported writers refuse before erasure. Post-format probes still require nonzero, distinct swap/ext4 UUIDs with no existing configuration owner; no path or all-zero UUID fallback is allowed.

The manual fstab editor remains available. It snapshots configuration before saving and rolls back on write or service-restart failure, leaving `/tmp/fstab.bak`. It does not validate UCI syntax or mount semantics; a saved configuration can still misconfigure mounts after reboot. Setup updates only the selected new swap/data entries and preserves unrelated mounts and swaps. The existing hotplug loader and storage-path setup remain in place where safe.

## API and architecture

Authenticated inventory request: `{module: 'usbstorage', action: 'getStorageDevices'}`. Response: `{devices, error}`. Each device includes a canonical ID/path, model, capacity, transport/connection, identity snapshot, eligibility/reason, warnings, partitions, mounts, and swaps. A global error disables all candidates.

Setup sends exactly `{module: 'usbstorage', action: 'startAutoSetup', deviceId, identity, confirmation}`. `deviceId` is the selected canonical basename; `identity` is the exact discovery token; `confirmation` is the exact displayed path, not trimmed or normalized. Missing/extra/malformed fields, legacy requests, stale devices, and unsafe selections are rejected before background launch.

`BackgroundTaskHelper` tracks `usbstorage-autosetup`; `getAutoSetupStatus` returns `{logContent, isRunning}` using `/tmp/task-usbstorage-autosetup.{log,flag}`. A completion flag records that the command exited, not whether it succeeded. The server and scripts enforce authoritative validation and operation locking independently of the UI.

## Focused verification (no hardware)

From the repository root:

```sh
python3 -m unittest discover -s usbstorage/tests-shell -p 'test_*.py' -v
php -n usbstorage/tests-php/storage_test.php
for script in usbstorage/public/bin/*.sh usbstorage/public/files/20-sd-loader; do
    sh -n "$script" || exit 1
done
shellcheck -x -P usbstorage/public/bin usbstorage/public/bin/*.sh
```

Allow at least ten minutes for the shell suite. Fixtures use synthetic sysfs/proc data, stock-style numeric readers, and strict capability/execution-boundary doubles. They do not create block nodes, attach loop devices, create namespaces, mount filesystems, or run real drive commands. The unchanged hotplug loader `public/files/20-sd-loader` has **14 pre-existing ShellCheck diagnostics**; syntax covers it, while focused static analysis covers all six `public/bin/*.sh` files. No baseline diagnostics were silently fixed or suppressed. The existing loader's later hotplug activation policy is not made selected-only by the setup guards.

From `usbstorage`, with the framework checked out at the sibling layout `modules/usbstorage` and `frieren/frieren-front`:

```sh
corepack yarn install --immutable
VITE_COMMON_ALIAS=../../frieren/frieren-front/src corepack yarn test
VITE_ANALYZER_ENABLE=false VITE_COMMON_ALIAS=../../frieren/frieren-front/src corepack yarn build
corepack yarn validate
```

Use a current Node 22 patch release (test DOM dependencies require **22.22.2+**) or supported Node 24. Tests run actual React 18/Bootstrap components, Jotai state, authenticated query/mutation hooks, and request serialization, doubling only HTTP. Test resolution deduplicates React and shared providers against the module's dependencies; no framework changes are needed. Production peer contracts remain unchanged.

The existing production config enables an interactive bundle analyzer that opens a browser and starts a local server. Disable it with `VITE_ANALYZER_ENABLE=false` for headless builds; this does not change the production bundle's functionality. CI uses this override without changing the shared build config.

`.github/workflows/usbstorage-tests.yml` runs Ubuntu 24.04 shell fixtures/static checks, PHP 8.2–8.4 syntax/tests, and Node 22 UI tests/build/schema validation. Only the UI job checks out pinned framework source for the shared aliases. CI does not build release tarballs, publish, or touch physical storage.

## License

LGPL-3.0-or-later
