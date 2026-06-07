/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { Fragment } from 'react';
import { useWatch } from 'react-hook-form';

import SwitchField from '@src/components/Form/SwitchField';
import InputField from '@src/components/Form/InputField';

const ATTACK_OPTIONS = {
    a: [
        { name: 'opt_a_a', flag: '-a', label: 'Test specific AP MAC address', type: 'input', placeholder: 'AP MAC' },
        { name: 'opt_a_m', flag: '-m', label: 'Use valid client MAC from OUI database', type: 'switch' },
        { name: 'opt_a_c', flag: '-c', label: 'Do not check for test being successful', type: 'switch' },
        { name: 'opt_a_i', flag: '-i', label: 'Intelligent test on AP (connect + reinject)', type: 'input', placeholder: 'AP MAC' },
        { name: 'opt_a_s', flag: '-s', label: 'Speed in packets per second', type: 'input', placeholder: 'Rate (pps)' },
    ],
    b: [
        { name: 'opt_b_n', flag: '-n', label: 'Use custom SSID instead of random', type: 'input', placeholder: 'SSID' },
        { name: 'opt_b_a', flag: '-a', label: 'Non-printable chars, break 32-byte SSID limit', type: 'switch' },
        { name: 'opt_b_f', flag: '-f', label: 'Read SSIDs from file', type: 'input', placeholder: 'File path' },
        { name: 'opt_b_v', flag: '-v', label: 'Read MACs and SSIDs from file', type: 'input', placeholder: 'File path' },
        { name: 'opt_b_d', flag: '-d', label: 'Show station as Ad-Hoc', type: 'switch' },
        { name: 'opt_b_w', flag: '-w', label: 'Encryption types (combinable)', type: 'input', placeholder: 'n/w/t/a' },
        { name: 'opt_b_g', flag: '-g', label: 'Show as 802.11g (54 Mbit)', type: 'switch' },
        { name: 'opt_b_m', flag: '-m', label: 'Use valid AP MACs from OUI database', type: 'switch' },
        { name: 'opt_b_h', flag: '-h', label: 'Hop to channel where AP is spoofed', type: 'switch' },
        { name: 'opt_b_c', flag: '-c', label: 'Fake AP on specific channel', type: 'input', placeholder: 'Channel' },
        { name: 'opt_b_b', flag: '-b', label: 'Bitrate selection', type: 'input', placeholder: 'b=11Mbit, g=54Mbit' },
        { name: 'opt_b_C', flag: '-C', label: 'Country code in beacons', type: 'input', placeholder: 'Country code' },
        { name: 'opt_b_i', flag: '-i', label: 'Custom Information Elements', type: 'input', placeholder: 'Hex data' },
        { name: 'opt_b_s', flag: '-s', label: 'Speed in packets per second', type: 'input', placeholder: 'Rate (pps)' },
    ],
    d: [
        { name: 'opt_d_w', flag: '-w', label: 'Whitelist MACs file', type: 'input', placeholder: 'File path' },
        { name: 'opt_d_b', flag: '-b', label: 'Blacklist MACs file', type: 'input', placeholder: 'File path' },
        { name: 'opt_d_s', flag: '-s', label: 'Speed in packets per second', type: 'input', placeholder: 'Rate (pps)' },
        { name: 'opt_d_x', flag: '-x', label: 'Full IDS stealth (match all sequence numbers)', type: 'switch' },
        { name: 'opt_d_E', flag: '-E', label: 'Target specific AP by ESSID', type: 'input', placeholder: 'ESSID' },
        { name: 'opt_d_B', flag: '-B', label: 'Target specific AP by BSSID', type: 'input', placeholder: 'BSSID' },
        { name: 'opt_d_S', flag: '-S', label: 'Target specific station MAC', type: 'input', placeholder: 'Station MAC' },
        { name: 'opt_d_W', flag: '-W', label: 'Whitelist specific station MAC', type: 'input', placeholder: 'Station MAC' },
        { name: 'opt_d_c', flag: '-c', label: 'Channel hopping', type: 'input', placeholder: 'Channels (comma separated)' },
    ],
    e: [
        { name: 'opt_e_t', flag: '-t', label: 'Target WPA AP BSSID', type: 'input', placeholder: 'BSSID' },
        { name: 'opt_e_s', flag: '-s', label: 'Speed in packets per second', type: 'input', placeholder: 'Rate (pps)' },
        { name: 'opt_e_l', flag: '-l', label: 'Use Logoff messages to kick clients', type: 'switch' },
    ],
    m: [
        { name: 'opt_m_t', flag: '-t', label: 'Target BSSID', type: 'input', placeholder: 'BSSID' },
        { name: 'opt_m_w', flag: '-w', label: 'Time between bursts (seconds)', type: 'input', placeholder: 'Time (seconds)' },
        { name: 'opt_m_n', flag: '-n', label: 'Packets per burst', type: 'input', placeholder: 'PPB' },
        { name: 'opt_m_j', flag: '-j', label: 'Use TKIP QoS-Exploit', type: 'switch' },
        { name: 'opt_m_s', flag: '-s', label: 'Speed in packets per second', type: 'input', placeholder: 'Rate (pps)' },
    ],
    p: [
        { name: 'opt_p_e', flag: '-e', label: 'SSID to probe for', type: 'input', placeholder: 'SSID' },
        { name: 'opt_p_f', flag: '-f', label: 'SSID wordlist for bruteforce', type: 'input', placeholder: 'File path' },
        { name: 'opt_p_t', flag: '-t', label: 'Target AP BSSID', type: 'input', placeholder: 'BSSID' },
        { name: 'opt_p_s', flag: '-s', label: 'Speed in packets per second', type: 'input', placeholder: 'Rate (pps)' },
        { name: 'opt_p_b', flag: '-b', label: 'Full bruteforce mode (character set)', type: 'input', placeholder: 'n/u/l/s (combinable)' },
        { name: 'opt_p_p', flag: '-p', label: 'Resume bruteforce from word', type: 'input', placeholder: 'Word' },
        { name: 'opt_p_r', flag: '-r', label: 'Probe request tests', type: 'input', placeholder: 'Channel' },
    ],
    s: [
        { name: 'opt_s_f', flag: '-f', label: 'Fuzzing mode', type: 'input', placeholder: '1-5 (1=replay,2=neighbor,3=truncate,4=overwrite,5=all)' },
        { name: 'opt_s_b', flag: '-b', label: 'Black hole via impersonated meshpoint', type: 'input', placeholder: 'MAC address' },
        { name: 'opt_s_p', flag: '-p', label: 'Path Request flooding', type: 'input', placeholder: 'MAC address' },
        { name: 'opt_s_l', flag: '-l', label: 'Create routing loops', type: 'switch' },
        { name: 'opt_s_s', flag: '-s', label: 'Speed in packets per second', type: 'input', placeholder: 'Rate (pps)' },
        { name: 'opt_s_n', flag: '-n', label: 'Target mesh network ID', type: 'input', placeholder: 'Mesh ID' },
    ],
    w: [
        { name: 'opt_w_e', flag: '-e', label: 'Target WDS network SSID', type: 'input', placeholder: 'SSID' },
        { name: 'opt_w_c', flag: '-c', label: 'Channel hopping', type: 'input', placeholder: 'Channels (comma separated)' },
        { name: 'opt_w_z', flag: '-z', label: 'WIDS exploit (authenticate WDS clients to foreign APs)', type: 'switch' },
        { name: 'opt_w_s', flag: '-s', label: 'Speed in packets per second', type: 'input', placeholder: 'Rate (pps)' },
    ],
    f: [
        { name: 'opt_f_s', flag: '-s', label: 'Packet sources (combinable)', type: 'input', placeholder: 'a/b/c/p' },
        { name: 'opt_f_m', flag: '-m', label: 'Packet modifiers (combinable)', type: 'input', placeholder: 'n/b/m/s/t/c/d' },
        { name: 'opt_f_c', flag: '-c', label: 'Channel hopping', type: 'input', placeholder: 'Channels (comma separated)' },
        { name: 'opt_f_p', flag: '-p', label: 'Speed in packets per second', type: 'input', placeholder: 'Rate (pps)' },
    ],
};

/**
 * Returns the default values object for all attack option fields.
 * Switch options default to false, input options get a toggle + value field.
 */
const getAttackOptionsDefaults = () => {
    const defaults = {};
    for (const options of Object.values(ATTACK_OPTIONS)) {
        for (const option of options) {
            if (option.type === 'switch') {
                defaults[option.name] = false;
            } else {
                defaults[option.name] = '';
                defaults[`${option.name}_enabled`] = false;
            }
        }
    }

    return defaults;
};

/**
 * Builds the command-line flags string from form data for the selected attack mode.
 */
const buildAttackOptionsFlags = (data, attackMode) => {
    const options = ATTACK_OPTIONS[attackMode];
    if (!options) {
        return '';
    }

    const parts = [];
    for (const option of options) {
        if (option.type === 'switch') {
            if (data[option.name]) {
                parts.push(option.flag);
            }
        } else {
            if (!data[`${option.name}_enabled`]) {
                continue;
            }
            const value = data[option.name];
            if (value) {
                parts.push(`${option.flag} ${value}`);
            }
        }
    }

    return parts.join(' ');
};

const AttackModeOptions = () => {
    const attackMode = useWatch({ name: 'attackMode', defaultValue: '' });
    const options = ATTACK_OPTIONS[attackMode];

    if (!attackMode || !options || options.length === 0) {
        return <p className={'text-body-secondary fst-italic mb-0'}>No options available for selected mode.</p>;
    }

    return (
        <>
            {options.map((option) => (
                option.type === 'switch' ? (
                    <SwitchField
                        key={option.name}
                        name={option.name}
                        label={`${option.flag} - ${option.label}`}
                    />
                ) : (
                    <Fragment key={option.name}>
                        <SwitchField
                            name={`${option.name}_enabled`}
                            label={`${option.flag} - ${option.label}`}
                        />
                        <ConditionalInput option={option} />
                    </Fragment>
                )
            ))}
        </>
    );
};

const ConditionalInput = ({ option }) => {
    const enabled = useWatch({ name: `${option.name}_enabled`, defaultValue: false });

    if (!enabled) {
        return null;
    }

    return (
        <InputField
            name={option.name}
            label={option.placeholder}
            placeholder={option.placeholder}
        />
    );
};

export { ATTACK_OPTIONS, getAttackOptionsDefaults, buildAttackOptionsFlags };
export default AttackModeOptions;
