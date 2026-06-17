#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2023 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later
# More info at: https://github.com/xchwarze/frieren

# Path for the formatting progress flag
PROGRESS_FLAG="/tmp/format_device.flag"

# Wait until a block device node appears. After fdisk rewrites the table the
# kernel/hotplug re-creates the partition nodes asynchronously; this bounds the
# wait so a node that never shows up can't hang the script.
wait_for_block() {
    _dev=$1
    _tries=0
    while [ ! -b "$_dev" ] && [ "$_tries" -lt 10 ]; do
        sleep 1
        _tries=$((_tries + 1))
    done

    [ -b "$_dev" ]
}

# Unmount and format the device into a 1G swap partition + an ext4 data
# partition. Returns non-zero on the first failed step so the caller can react.
steps() {
    DEVICE_PATH=$1
    MOUNT_POINT=$2

    # Free the device: unmount the target mount and every partition of the
    # device, and disable any swap living on it, so fdisk is not writing to a
    # busy disk (the old version only unmounted MOUNT_POINT).
    echo "[+] Releasing device ${DEVICE_PATH} ..."
    if mount | grep -q " ${MOUNT_POINT} "; then
        umount -f "${MOUNT_POINT}" 2>/dev/null
    fi
    for part in ${DEVICE_PATH}*; do
        [ -b "$part" ] || continue
        umount -f "$part" 2>/dev/null
        swapoff "$part" 2>/dev/null
    done
    sync
    sleep 2

    echo "[+] Writing partition table (1G swap + ext4)..."
    # printf (not "echo -e") feeds the interactive fdisk prompts: it expands \n
    # reliably under busybox ash, where echo's -e handling is not guaranteed.
    # fdisk steps: o(new table) n p 1 <def> +1G  t 82(swap)  n p 2 <def> <def>  w
    printf 'o\nn\np\n1\n\n+1G\nt\n82\nn\np\n2\n\n\nw\n' | fdisk "${DEVICE_PATH}"
    if [ $? -ne 0 ]; then
        echo "[!] fdisk failed."
        return 1
    fi
    sync
    # best-effort kernel re-read; the wait_for_block loop below is the real guard
    partprobe "${DEVICE_PATH}" 2>/dev/null
    sleep 2

    # Detect the partition node names from the freshly written table. Reading
    # them back (vs computing a 'p' suffix) stays correct for aliased device
    # paths such as /dev/sdcard/sd.
    PARTITIONS=$(fdisk -l "${DEVICE_PATH}" | awk '/^\/dev/ {print $1}')
    SWAP_PART=$(echo "$PARTITIONS" | head -n 1)
    FS_PART=$(echo "$PARTITIONS" | tail -n 1)
    if [ -z "$SWAP_PART" ] || [ -z "$FS_PART" ] || [ "$SWAP_PART" = "$FS_PART" ]; then
        echo "[!] Could not detect the two partitions."
        return 1
    fi

    echo "[+] Waiting for partition nodes (${SWAP_PART}, ${FS_PART})..."
    if ! wait_for_block "$SWAP_PART" || ! wait_for_block "$FS_PART"; then
        echo "[!] Partition device nodes did not appear."
        return 1
    fi

    echo "[+] Formatting partitions..."
    if ! mkswap "$SWAP_PART"; then
        echo "[!] mkswap failed."
        return 1
    fi
    if ! mkfs.ext4 -F "$FS_PART"; then
        echo "[!] mkfs.ext4 failed."
        return 1
    fi
    sync

    echo "[+] Mounting and activating swap..."
    mkdir -p "${MOUNT_POINT}"
    if ! mount "$FS_PART" "${MOUNT_POINT}"; then
        echo "[!] mount failed."
        return 1
    fi
    # swap is non-fatal: the data mount is what matters
    swapon "$SWAP_PART" 2>/dev/null || echo "[!] swapon failed (continuing)."

    echo "[*] Device and partition information:"
    fdisk -l "${DEVICE_PATH}"

    return 0
}


# Check if device path argument was provided
if [ -z "$1" ]; then
    echo "[!] Error: No device path provided."
    echo "    Usage: $0 /dev/sdX"
    exit 1
fi

# Check if the device path exists
if [ ! -b "$1" ]; then
    echo "[!] Error: Device path '$1' does not exist or is not a block device."
    exit 1
fi

# Check if the formatting process is already running
if [ -f "$PROGRESS_FLAG" ]; then
    echo "[!] Formatting process is already running!"
    exit 1
fi

DEVICE_PATH=$1
MOUNT_POINT="/sd"

touch "$PROGRESS_FLAG"
steps "$DEVICE_PATH" "$MOUNT_POINT"
RESULT=$?
rm -f "$PROGRESS_FLAG"

# Propagate the real result so the caller knows if formatting actually worked
# (the old version hardcoded "exit 0", masking every failure).
exit $RESULT
