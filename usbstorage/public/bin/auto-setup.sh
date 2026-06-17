#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2023 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later
# More info at: https://github.com/xchwarze/frieren

# Script to auto-detect storage device and execute formatting and setup scripts
# Liveness/completion is tracked by the backend BackgroundTaskHelper (task
# "usbstorage-autosetup"); this script no longer manages its own progress flag.

# Possible device paths (checked in priority order)
DEVICES="/dev/sdcard/sd /dev/mmcblk0 /dev/sda"

# Determine script directory
SCRIPT_DIR=$(dirname "$0")

# Function to check devices and execute scripts. Returns non-zero on failure.
run_scripts() {
    echo "[*] Starting the search for a valid storage device..."

    for device in $DEVICES; do
        if [ ! -b "$device" ]; then
            continue
        fi

        echo "[+] Device found: $device"
        echo "    Attempting to format the device using format-device.sh..."
        if ! sh "$SCRIPT_DIR/format-device.sh" "$device"; then
            echo "[!] Formatting failed."
            echo "    Follow the manual steps to mount your unit!"
            return 1
        fi

        sleep 5
        echo "[*] Formatting successful. Proceeding setup with post-format.sh..."
        if ! sh "$SCRIPT_DIR/post-format.sh"; then
            echo "[!] Setup script failed."
            echo "    Follow the manual steps to mount your unit!"
            return 1
        fi

        echo "[*] Setup completed successfully."
        return 0
    done

    echo "[!] No valid storage device found."
    echo "    Follow the manual steps to mount your unit!"
    return 1
}

# Main execution — propagate the real result instead of a hardcoded exit 0.
run_scripts
exit $?
