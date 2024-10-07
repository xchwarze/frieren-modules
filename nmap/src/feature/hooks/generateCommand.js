/*
 * Project: Frieren Nmap Module
 * Based on Frieren Framework Template Module and other Frieren modules
 * Original Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * Modifications and new code by m5kro <m5kro@proton.me>, 2024
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 *
 * Original code from Frieren Framework is distributed under the terms of the
 * GNU Lesser General Public License (LGPL) version 3 or later. You should have received
 * a copy of the LGPL-3.0-or-later along with this project. If not, see <https://www.gnu.org/licenses>.
 * 
 * Modifications: Modified functions to generate Nmap command from form fields.
 */

import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

const useGenerateCommand = () => {
    const fields = [
        'target', 'verbose', 'osDetection', 'serviceVersion', 'traceroute', 'topPorts', 'scanType', 'timing', 'script', 'customOptions'
    ];
    const { getValues, setValue } = useFormContext();
    const watchFields = useWatch({ name: fields, exact: true });

    useEffect(() => {
        const form = fields.reduce((obj, field, index) => ({ ...obj, [field]: watchFields[index] }), {});
        const commandMap = {
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
