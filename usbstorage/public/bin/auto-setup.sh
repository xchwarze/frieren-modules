#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2023 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later
# More info at: https://github.com/xchwarze/frieren

# Script to auto-detect storage device and execute formatting and setup scripts

PROGRESS_FLAG="/tmp/auto_setup.flag"

# Possible device paths
DEVICES="/dev/sdcard/sd /dev/mmcblk0 /dev/sda"

# Determine script directory
SCRIPT_DIR=$(dirname "$0")

# Function to check devices and execute scripts
run_scripts() {
    echo "[*] Starting the search for a valid storage device..."

    for device in $DEVICES; do
        if [ -b "$device" ]; then
            echo "[+] Device found: $device"
            echo "    Attempting to format the device using format-device.sh..."
            $SCRIPT_DIR/format-device.sh "$device"
            FORMAT_EXIT_CODE=$?

            if [ $FORMAT_EXIT_CODE -eq 0 ]; then
                echo
                sleep 5

                echo "[*] Formatting successful. Proceeding setup with post-format.sh..."
                $SCRIPT_DIR/post-format.sh
                SETUP_EXIT_CODE=$?

                if [ $SETUP_EXIT_CODE -eq 0 ]; then
                    echo "[*] Setup completed successfully."
                else
                    echo "[!] Setup script failed with exit code: $SETUP_EXIT_CODE"
                    echo "    Follow the manual steps to mount your unit!"
                fi

                return
            else
                echo "[!] Formatting failed with exit code: $FORMAT_EXIT_CODE"
                echo "    Follow the manual steps to mount your unit!"
                return

            fi
        fi
    done

    echo "[!] No valid storage device found."
    echo "    Follow the manual steps to mount your unit!"
}

# Main execution
touch "$PROGRESS_FLAG"
run_scripts
rm "$PROGRESS_FLAG"

exit 0
