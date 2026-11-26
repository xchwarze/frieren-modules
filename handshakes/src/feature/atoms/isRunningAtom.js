/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { atom } from 'jotai';

// Transient: whether an airodump-ng capture is running right now. Re-seeded from
// moduleStatus on mount, so a page reload re-syncs with the device.
const isRunningAtom = atom(false);

export default isRunningAtom;
