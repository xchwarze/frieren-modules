# USB Storage Module

A module for configuring SD card and USB storage on OpenWrt devices. USB Storage automates the detection and mounting of external storage devices through a bundled shell script and provides a manual editor for the OpenWrt fstab configuration, enabling persistent custom mount points.

## Features

- **Auto-setup script** — runs a bundled `auto-setup.sh` script in the background that detects connected storage devices, creates partitions if needed, formats them as ext4, and configures mount points
- **Real-time setup progress** — polls the setup log every second and streams output to the browser until the script completes
- **Fstab editor** — reads and displays the current `/etc/config/fstab` content in an editable textarea; saving triggers an automatic `fstab` service restart to apply changes immediately
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
────────────────────              ────────────────────────
SetupCard                         UsbstorageController
  └─ Run auto setup ─────────────▶ startAutoSetup  → execBackground(auto-setup.sh)
  └─ Progress output ◀─────────── getAutoSetupStatus → /tmp/auto_setup.log + flag file
                                                       (1s poll until flag disappears)
ConfigCard
  └─ Fstab textarea ◀──────────── getFstabConfig   → read /etc/config/fstab
  └─ Save button ─────────────────▶ saveFstabConfig → write fstab + /etc/init.d/fstab restart
```

The auto-setup script creates a `/tmp/auto_setup.flag` file at startup and removes it on completion; the frontend polls `getAutoSetupStatus` every second and stops when `isRunning` flips to false.

## Important Notes

- The fstab editor writes content directly to `/etc/config/fstab` without syntax validation — malformed UCI content may break storage mounts on the next reboot
- Take a manual backup of `/etc/config/fstab` before making edits if you are unsure of the format
- The auto-setup script only supports ext4 filesystems; NTFS, exFAT, and FAT32 are not supported

## License

LGPL-3.0-or-later
