# USB Storage Module

A module for configuring SD card and USB storage on OpenWrt devices. USB Storage automates the detection and mounting of external storage devices through a bundled shell script and provides a manual editor for the OpenWrt fstab configuration, enabling persistent custom mount points.

## Features

- **Auto-setup script** — runs a bundled `auto-setup.sh` in the background that detects a connected storage device, partitions it (a 1 GB swap partition + an ext4 data partition), formats it, and configures the mount point and swap in fstab. Runs as a tracked background task via the framework's `BackgroundTaskHelper`
- **Real-time setup progress** — polls the task log every second and streams output to the browser until the task completes
- **Fstab editor** — reads and displays the current `/etc/config/fstab` in an editable textarea; saving runs a guarded update — it snapshots the current fstab, writes the new content, restarts the `fstab` service, and rolls back to the snapshot if the write or restart fails
- **Dependency management** — checks for and installs the full set of required packages via opkg with progress polling

## Use Cases

- **Expand device storage for captures** — mount a USB drive or SD card to provide persistent storage for large hcxdumptool pcapng files, tcpdump captures, or scan history that would otherwise fill the device's limited internal flash
- **Persistent data across reboots** — configure a mount point in fstab so capture directories survive device restarts, preventing data loss between sessions
- **Custom mount point configuration** — manually edit fstab to set specific mount paths (e.g., `/sd`, `/usb`) or mount options for connected devices
- **Initial device provisioning** — run auto-setup during initial configuration to prepare a freshly inserted USB drive for use without needing terminal access

## Requirements

| Requirement | Notes |
|-------------|-------|
| `block-mount` | OpenWrt block device mount utility |
| `e2fsprogs` | ext2/3/4 filesystem utilities (`mkfs.ext4`) |
| `kmod-fs-ext4` | Kernel module for ext4 filesystem support |
| `kmod-usb-storage-extras` | Kernel module for USB mass storage devices |
| `fdisk` | Partition table management |

All packages are installed via the module's dependency management system (opkg).

## Architecture

```
Frontend                          Backend (PHP)
────────────────────              ──────────────────────────────
SetupCard                         UsbstorageController
  └─ Run auto setup ─────────────▶ startAutoSetup     → BackgroundTaskHelper::start
                                                          ("usbstorage-autosetup", sh auto-setup.sh)
  └─ Progress output ◀──────────── getAutoSetupStatus → BackgroundTaskHelper status
                                      /tmp/task-usbstorage-autosetup.{log,flag} (1s poll)
ConfigCard
  └─ Fstab textarea ◀──────────── getFstabConfig      → ModuleOpenWrtHelper::getFstabConfig
  └─ Save button ─────────────────▶ saveFstabConfig    → ModuleOpenWrtHelper::saveFstabConfig
                                      (snapshot → write → restart → rollback on failure)
```

Liveness is tracked by the framework's `BackgroundTaskHelper`: the completion flag (`/tmp/task-usbstorage-autosetup.flag`) is set when the script exits, and the frontend polls `getAutoSetupStatus` every second until `isRunning` flips to false. A concurrency guard refuses a second run while one is in progress.

## Important Notes

- The fstab editor does not validate UCI syntax, but it snapshots the current fstab before writing and rolls back if the service restart fails — a backup is also left at `/tmp/fstab.bak`. A config that is syntactically valid but semantically wrong can still misconfigure mounts on the next reboot
- The auto-setup script only supports ext4 filesystems; NTFS, exFAT, and FAT32 are not supported
- Auto-setup wipes the selected device — it picks the first present of `/dev/sdcard/sd`, `/dev/mmcblk0`, `/dev/sda` (external SD/USB on these gadgets) and formats it

## License

LGPL-3.0-or-later
