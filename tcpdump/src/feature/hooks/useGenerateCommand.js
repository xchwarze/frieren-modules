/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

const useGenerateCommand = () => {
    const fields = [
        'interface', 'direction', 'verbose', 'resolve', 'timestamp', 'packetCount', 'snaplen', 'bufferSize', 'filter',
        'dontPrintHostName', 'showHexAndASCII', 'printAscii', 'printAbsoluteNumbers', 'getEthernetHeaders',
        'noPromiscuous', 'noChecksumVerify', 'immediateMode', 'packetNumber', 'lessProtocolInfo', 'monitorMode', 'extraFlags',
    ];
    const { getValues, setValue } = useFormContext();
    const watchFields = useWatch({ name: fields, exact: true });

    useEffect(() => {
        const form = fields.reduce((obj, field, index) => ({ ...obj, [field]: watchFields[index] }), {});
        const commandMap = {
            interface: value => `-i ${value}`,
            direction: value => `-Q ${value}`,
            packetCount: value => `-c ${value}`,
            snaplen: value => `-s ${value}`,
            bufferSize: value => `-B ${value}`,
            filter: value => `'${value}'`,
            dontPrintHostName: value => value ? '-N' : '',
            showHexAndASCII: value => value ? '-X' : '',
            printAscii: value => value ? '-A' : '',
            printAbsoluteNumbers: value => value ? '-S' : '',
            getEthernetHeaders: value => value ? '-e' : '',
            noPromiscuous: value => value ? '-p' : '',
            noChecksumVerify: value => value ? '-K' : '',
            immediateMode: value => value ? '--immediate-mode' : '',
            packetNumber: value => value ? '--number' : '',
            lessProtocolInfo: value => value ? '-q' : '',
            monitorMode: value => value ? '-I' : '',
        };

        const generateCommandPart = (key, value) => {
            if (value === true || (typeof value === 'string' && value.trim() !== '')) {
                return commandMap[key] ? commandMap[key](value) : value;
            }

            return '';
        };

        const value = Object.entries(form)
            .map(([key, value]) => generateCommandPart(key, value))
            .filter(part => part !== '')
            .join(' ');
        if (value !== getValues('command')) {
            setValue('command', value);
        }
    }, [setValue, watchFields]);
};

export default useGenerateCommand;
