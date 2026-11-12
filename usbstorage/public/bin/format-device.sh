#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2023 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later
# More info at: https://github.com/xchwarze/frieren

SCRIPT_DIR=$(dirname "$0")
# shellcheck source=storage-common.sh
. "$SCRIPT_DIR/storage-common.sh" || exit 1
# shellcheck source=storage-format.sh
. "$SCRIPT_DIR/storage-format.sh" || exit 1

# Propagate the real result so the caller knows if formatting actually worked
# (the old version hardcoded "exit 0", masking every failure).
storage_format "$@"
exit $?
