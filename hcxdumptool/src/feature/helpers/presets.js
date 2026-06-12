/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
// Built-in capture presets shipped with the module (read-only, not deletable).
// `values` are partials merged over DEFAULT_VALUES on load; `interface` is left
// to the operator (preserved on load).
//
// 6.3.x channel syntax (-c) uses band suffixes: a = 2.4GHz, b = 5GHz, c = 6GHz.
// The 5GHz sets use common non-DFS UNII-1/UNII-3 channels (36-48, 149-161) to
// avoid DFS radar wait. 6.2.x uses the predefined -s scanlists instead.
export const DEFAULT_PRESETS = [
    // --- 6.3.x ---
    {
        name: 'PMKID + Handshake (2.4GHz, 6.3)',
        builtin: true,
        toolVersion: '6.3',
        values: { channel: '1a,6a,11a', rdsSort: true },
    },
    {
        name: 'PMKID + Handshake (5GHz, 6.3)',
        builtin: true,
        toolVersion: '6.3',
        values: { channel: '36b,40b,44b,48b,149b,153b,157b,161b', rdsSort: true },
    },
    {
        name: 'PMKID + Handshake (2.4+5GHz, 6.3)',
        builtin: true,
        toolVersion: '6.3',
        values: { channel: '1a,6a,11a,36b,40b,44b,48b,149b,153b,157b,161b', rdsSort: true },
    },
    {
        name: 'All frequencies sweep (6.3)',
        builtin: true,
        toolVersion: '6.3',
        values: { allFrequencies: true, rdsSort: true },
    },
    {
        name: 'Aggressive AP attack (6.3)',
        builtin: true,
        toolVersion: '6.3',
        values: { channel: '1a,6a,11a,36b,40b,44b,48b', attemptApMax: '1', rdsSort: true },
    },
    {
        name: 'Client-only, no AP attack (2.4GHz, 6.3)',
        builtin: true,
        toolVersion: '6.3',
        values: { channel: '1a,6a,11a', attemptApMax: '0' },
    },
    {
        name: 'Client-only, no AP attack (5GHz, 6.3)',
        builtin: true,
        toolVersion: '6.3',
        values: { channel: '36b,40b,44b,48b,149b,153b,157b,161b', attemptApMax: '0' },
    },
    {
        name: 'Passive recon scan (6.3)',
        builtin: true,
        toolVersion: '6.3',
        values: { rcascan: 'p' },
    },
    {
        name: 'Active recon scan (6.3)',
        builtin: true,
        toolVersion: '6.3',
        values: { rcascan: 'a' },
    },
    // --- 6.2.x ---
    {
        name: 'Handshake capture (5GHz, 6.2)',
        builtin: true,
        toolVersion: '6.2',
        values: { scanlist: '3', statusEapol: true },
    },
    {
        name: 'Beacon recon (6.2)',
        builtin: true,
        toolVersion: '6.2',
        values: { statusBeacon: true, doRcascan: true },
    },
];
