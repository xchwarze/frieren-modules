#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2023 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later
# More info at: https://github.com/xchwarze/frieren

# Enable fstab service
echo "[+] Enabling fstab service..."
/etc/init.d/fstab enable

# Check if PATH updates already exist to prevent duplication
if ! grep -q '/sd/bin' /etc/profile; then
    echo "export PATH=\$PATH:/sd/bin:/sd/sbin:/sd/usr/bin:/sd/usr/sbin" >> /etc/profile
    echo "[+] Added SD card paths to PATH."
fi

# Check if LD_LIBRARY_PATH updates already exist to prevent duplication
if ! grep -q '/sd/lib' /etc/profile; then
    echo "export LD_LIBRARY_PATH=\$LD_LIBRARY_PATH:/sd/lib:/sd/usr/lib" >> /etc/profile
    echo "[+] Added SD card library paths to LD_LIBRARY_PATH."
fi

echo "[+] Configuring fstab for automatic mount and swap management..."
if [ ! -d "/sd" ]; then
    echo "[+] Creating mount point /sd..."
    mkdir -p /sd
fi

block detect | uci import fstab
uci set fstab.@mount[0].target='/sd'
uci set fstab.@mount[0].options='rw,sync'
uci set fstab.@mount[0].enabled=1

if uci show fstab | grep -q 'fstab.@swap'; then
    uci set fstab.@swap[0].enabled=1
    echo "[+] Swap is now enabled."
fi

uci commit fstab

# Perform block mount to apply any fstab configuration immediately
echo "[+] Mounting block devices..."
sleep 3
block mount

sleep 2

# Link the /etc directory if it is not already linked
if [ ! -e "/sd/etc" ]; then
    echo "[+] Linked /etc directory to /sd/etc"
    ln -s /etc/ /sd/etc
fi

# Copy the hotplug script
SCRIPT_DIR=$(dirname "$0")
HOTPLUG_SOURCE="$SCRIPT_DIR/../files/20-sd-loader"
HOTPLUG_TARGET="/etc/hotplug.d/block/20-sd-loader"
if [ ! -f "$HOTPLUG_TARGET" ]; then
    echo "[+] Copied 20-sd-loader to /etc/hotplug.d/block"
    cp "$HOTPLUG_SOURCE" "$HOTPLUG_TARGET"
fi

echo "[*] Script steps completed successfully."
