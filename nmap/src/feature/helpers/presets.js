/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

// Mirrors the backend PRESET_NAME_REGEX (1-40 chars: letters, digits, space, _ . + ( ) -).
export const PRESET_NAME_REGEX = /^[A-Za-z0-9 ._+()-]{1,40}$/;

// Source fields for the scan form; the `command` string is derived, not stored.
export const DEFAULT_VALUES = {
    command: '',
    target: '',
    verbose: false,
    osDetection: false,
    serviceVersion: false,
    traceroute: false,
    timing: '',
    scanType: '',
    topPorts: '',
    script: '',
    customOptions: '',
};

// Built-in presets (not deletable). Each is a partial over DEFAULT_VALUES.
export const DEFAULT_PRESETS = [
    { name: 'Quick Scan', builtin: true, values: { timing: '4', topPorts: '100', verbose: true } },
    { name: 'Intense Scan', builtin: true, values: { timing: '4', osDetection: true, serviceVersion: true, verbose: true } },
    { name: 'Vuln Scan', builtin: true, values: { timing: '4', serviceVersion: true, script: 'vuln' } },
];

export const presetKey = (preset) => `${preset.builtin ? 'builtin' : 'user'}:${preset.name}`;
