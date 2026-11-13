#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2023 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later
# More info at: https://github.com/xchwarze/frieren

# Format and configure only an explicitly selected, freshly validated device.
# Liveness/completion is tracked by the backend BackgroundTaskHelper (task
# "usbstorage-autosetup"); this script no longer manages its own progress flag.

# Determine script directory
SCRIPT_DIR=$(dirname "$0")
# shellcheck source=storage-common.sh
. "$SCRIPT_DIR/storage-common.sh" || exit 1
# shellcheck source=storage-format.sh
. "$SCRIPT_DIR/storage-format.sh" || exit 1

# Main execution — propagate the real result instead of a hardcoded exit 0.
storage_setup "$@"
exit $?
