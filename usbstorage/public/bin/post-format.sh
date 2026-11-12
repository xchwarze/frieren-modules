#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2023 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later
# More info at: https://github.com/xchwarze/frieren

# Standalone configuration also validates the selection and owns the setup lock.
# Usage: post-format.sh DEVICE_ID IDENTITY CONFIRMATION SWAP_PART DATA_PART
SCRIPT_DIR=$(dirname "$0")
# shellcheck source=storage-common.sh
. "$SCRIPT_DIR/storage-common.sh" || exit 1
# shellcheck source=storage-format.sh
. "$SCRIPT_DIR/storage-format.sh" || exit 1
storage_post_format "$@"
exit $?
