import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

const useGenerateFilter = () => {
    const fields = [
        'filterType', 'filterDir', 'filterProtocol', 'filterLength', 'filterKind', 'filterOperator',
    ];
    const { getValues, setValue } = useFormContext();
    const watchFields = useWatch({ name: fields, exact: true });

    useEffect(() => {
        const form = fields.reduce((obj, field, index) => ({ ...obj, [field]: watchFields[index] }), {});

        const generateCommandPart = (key, value) => {
            if (typeof value === 'string' && value.trim() !== '') {
                return value;
            }

            return '';
        };

        const value = Object.entries(form)
            .map(([key, value]) => generateCommandPart(key, value))
            .filter(part => part !== '')
            .join(' ');
        if (value !== getValues('filter')) {
            setValue('filter', value);
        }
    }, [setValue, watchFields]);
};

export default useGenerateFilter;
