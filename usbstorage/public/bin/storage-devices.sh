#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2026 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later

# Inventory only. There are no write-capable options or alternate discovery roots.
if [ "$#" -ne 0 ]; then
    printf '%s\n' 'Usage: storage-devices.sh (read-only JSON inventory)' >&2
    exit 1
fi
STORAGE_BIN_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd) || exit 1
# shellcheck source=usbstorage/public/bin/storage-common.sh
. "$STORAGE_BIN_DIR/storage-common.sh"
storage_inventory
