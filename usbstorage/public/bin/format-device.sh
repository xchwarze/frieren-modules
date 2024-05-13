#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2023 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later
# More info at: https://github.com/xchwarze/frieren

# Path for the formatting progress flag
PROGRESS_FLAG="/tmp/format_device.flag"

# Function to unmount and format the SD card partitions
steps() {
    DEVICE_PATH=$1
    MOUNT_POINT=$2

    # Ensure the SD card is not in use
    if mount | grep -q " ${MOUNT_POINT} "; then
        echo "[+] Unmount the SD card..."
        
        umount -f ${MOUNT_POINT}
        if swapon -s | grep -q "^${DEVICE_PATH}"; then
            echo "[+] Turning off swap asociated to device"
            swapoff ${DEVICE_PATH}*
        fi
        
        sleep 4
    fi

    echo "[+] Apply fdisk options"
    # fdisk params explanation:
    # o   -> Create a new empty DOS partition table
    # n   -> New partition
    # p   -> Primary partition
    # 1   -> Partition number 1
    #     -> First sector (Accept default: 1)
    # +1G -> Last sector (1GB for the swap partition)
    # t   -> Change partition type
    # 82  -> Set type to Linux swap / Solaris
    # n   -> New partition
    # p   -> Primary partition
    # 2   -> Partition number 2
    #     -> First sector (Accept default: next available)
    #     -> Last sector (Accept default: remainder of the disk)
    # w   -> Write changes
    echo -e "o\nn\np\n1\n\n+1G\nt\n82\nn\np\n2\n\n\nw\n" | fdisk ${DEVICE_PATH}
    sleep 2

    # Determine new partition names
    PARTITIONS=$(fdisk -l ${DEVICE_PATH} | awk '/^\/dev/ {print $1}')
    SWAP_PART=$(echo "$PARTITIONS" | head -n 1)
    FS_PART=$(echo "$PARTITIONS" | tail -n 1)

    echo "[+] Formatting and setting up partitions..."
    mkswap $SWAP_PART
    mkfs.ext4 -F $FS_PART    

    echo "[+] Mounting and activating swap..."
    mount $FS_PART ${MOUNT_POINT}
    swapon $SWAP_PART

    echo "[*] Device and partition information:"
    fdisk -l ${DEVICE_PATH}
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
steps $DEVICE_PATH $MOUNT_POINT
rm "$PROGRESS_FLAG"

exit 0
