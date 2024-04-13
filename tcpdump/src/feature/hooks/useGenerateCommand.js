import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

const useGenerateCommand = () => {
    const fields = [
        'interface', 'verbose', 'resolve', 'timestamp', 'filter',
        'dontPrintHostName', 'showHexAndASCII', 'printAbsoluteNumbers', 'getEthernetHeaders', 'lessProtocolInfo', 'monitorMode',
    ];
    const { getValues, setValue } = useFormContext();
    const watchFields = useWatch({ name: fields, exact: true });

    useEffect(() => {
        const form = fields.reduce((obj, field, index) => ({ ...obj, [field]: watchFields[index] }), {});
        const commandMap = {
            interface: value => `-i ${value}`,
            filter: value => `'${value}'`,
            dontPrintHostName: value => value ? '-N' : '',
            showHexAndASCII: value => value ? '-X' : '',
            printAbsoluteNumbers: value => value ? '-S' : '',
            getEthernetHeaders: value => value ? '-e' : '',
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
