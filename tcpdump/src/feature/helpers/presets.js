/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
// Built-in capture presets shipped with the module (read-only, not deletable).
// `values` are partials merged over DEFAULT_VALUES on load; `interface` is left
// to the operator (preserved on load), and the derived `command`/`filter` fields
// are recomputed by the generators after a preset is applied — so presets only
// carry source fields (protocol/option switches/limits), never the built string.
export const DEFAULT_PRESETS = [
    {
        name: 'Verbose TCP',
        builtin: true,
        values: { verbose: '-vv', filterProtocol: 'tcp' },
    },
    {
        name: 'UDP traffic',
        builtin: true,
        values: { filterProtocol: 'udp' },
    },
    {
        name: 'ICMP (ping)',
        builtin: true,
        values: { filterProtocol: 'icmp' },
    },
    {
        name: 'ARP',
        builtin: true,
        values: { filterProtocol: 'arp' },
    },
    {
        name: 'Full payload (hex + ASCII)',
        builtin: true,
        values: { showHexAndASCII: true, printAbsoluteNumbers: true, snaplen: '0' },
    },
    {
        name: 'Fast, no name resolution',
        builtin: true,
        values: { resolve: '-nn' },
    },
    {
        name: 'Quiet (headers only)',
        builtin: true,
        values: { lessProtocolInfo: true, dontPrintHostName: true, resolve: '-nn' },
    },
    {
        name: 'Quick sample (100 packets)',
        builtin: true,
        values: { packetCount: '100', resolve: '-nn' },
    },
];
