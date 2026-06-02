/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

const FIELD_NAMES = [
    'target', 'verbose', 'osDetection', 'serviceVersion', 'traceroute',
    'topPorts', 'scanType', 'timing', 'script', 'customOptions',
];

const COMMAND_MAP = {
    target: value => `${value}`,
    verbose: value => value ? '-v' : '',
    osDetection: value => value ? '-O' : '',
    serviceVersion: value => value ? '-sV' : '',
    traceroute: value => value ? '--traceroute' : '',
    topPorts: value => value ? `--top-ports ${value}` : '',
    scanType: value => value ? `-s${value}` : '',
    timing: value => value ? `-T${value}` : '',
    script: value => value ? `--script=${value}` : '',
    customOptions: value => value,
};

const useGenerateCommand = () => {
    const { getValues, setValue } = useFormContext();
    const watchFields = useWatch({ name: FIELD_NAMES, exact: true });

    useEffect(() => {
        const form = FIELD_NAMES.reduce((obj, field, index) => ({ ...obj, [field]: watchFields[index] }), {});

        const value = Object.entries(form)
            .map(([key, val]) => {
                if (val === true || (typeof val === 'string' && val.trim() !== '')) {
                    return COMMAND_MAP[key]?.(val) ?? val;
                }
                return '';
            })
            .filter(Boolean)
            .join(' ');

        if (value !== getValues('command')) {
            setValue('command', value);
        }
    }, [getValues, setValue, watchFields]);
};

export default useGenerateCommand;
