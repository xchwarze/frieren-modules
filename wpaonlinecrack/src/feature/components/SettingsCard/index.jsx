/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import * as yup from 'yup';
import { useFormContext, useFieldArray } from 'react-hook-form';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';

import PanelCard from '@common/components/PanelCard';
import FormActions from '@common/components/FormActions';
import Button from '@common/components/Button';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import SubmitButton from '@src/components/Form/SubmitButton';
import useGetSettings from '@module/feature/hooks/useGetSettings.js';
import useSetSettings from '@module/feature/hooks/useSetSettings.js';

const wpaOnlineCrackSettingsSchema = yup.object({
    wpaSecKey: yup.string(),
    onlinehashcrackEmail: yup.string().email('Must be a valid email'),
    searchPaths: yup.array().of(yup.object({
        path: yup.string().trim().matches(/^\//, {
            message: 'Path must be absolute (start with /)',
            excludeEmptyString: true,
        }),
    })),
}).required();

// /root is always scanned server-side, so this list is only for additional folders.
const SearchPathsField = () => {
    const { control, register, formState: { errors } } = useFormContext();
    const { fields, append, remove } = useFieldArray({ control, name: 'searchPaths' });

    return (
        <Form.Group className={'mb-3'}>
            <Form.Label>Extra capture folders</Form.Label>
            <div className={'d-flex flex-column gap-2'}>
                {fields.map((field, index) => (
                    <InputGroup key={field.id} hasValidation={true}>
                        <Form.Control
                            placeholder={'/path/to/folder'}
                            isInvalid={!!errors.searchPaths?.[index]?.path}
                            {...register(`searchPaths.${index}.path`)}
                        />
                        <Button
                            type={'button'}
                            variant={'outline-danger'}
                            icon={'trash-2'}
                            title={'Remove folder'}
                            onClick={() => remove(index)}
                        />
                        {errors.searchPaths?.[index]?.path && (
                            <Form.Control.Feedback type={'invalid'} className={'d-block'}>
                                {errors.searchPaths[index].path.message}
                            </Form.Control.Feedback>
                        )}
                    </InputGroup>
                ))}
                <div>
                    <Button
                        type={'button'}
                        variant={'outline-secondary'}
                        icon={'folder-plus'}
                        label={'Add folder'}
                        onClick={() => append({ path: '' })}
                    />
                </div>
            </div>
        </Form.Group>
    );
};

const SettingsCard = () => {
    const settingsQuery = useGetSettings();
    const { mutateAsync: setSettings } = useSetSettings();

    const defaultValues = {
        wpaSecKey: settingsQuery?.data?.wpaSecKey ?? '',
        onlinehashcrackEmail: settingsQuery?.data?.onlinehashcrackEmail ?? '',
        searchPaths: (settingsQuery?.data?.searchPaths ?? []).map((path) => ({ path })),
    };

    const handleSubmit = (values) => setSettings({
        ...values,
        searchPaths: (values.searchPaths ?? []).map((item) => item.path),
    });

    return (
        <PanelCard
            title={'Settings'}
            icon={'sliders'}
            subtitle={<>To use these third party services you must be registered on their respective sites. <a href="https://wpa-sec.stanev.org/?get_key" target="_blank" rel="noopener noreferrer">Get your WPA-Sec API key here</a>.</>}
            refetch={settingsQuery.refetch}
            isFetching={settingsQuery.isFetching}
        >
            <FormProvider schema={wpaOnlineCrackSettingsSchema} onSubmit={handleSubmit} defaultValues={defaultValues}>
                <InputField
                    name={'wpaSecKey'}
                    label={'WPA-Sec Service Key'}
                    placeholder={'Enter your WPA-Sec service key'}
                />
                <InputField
                    name={'onlinehashcrackEmail'}
                    label={'OnlineHashCrack Email'}
                    placeholder={'Enter your email for OnlineHashCrack'}
                />
                <SearchPathsField />
                <FormActions>
                    <SubmitButton />
                </FormActions>
            </FormProvider>
        </PanelCard>
    );
};

export default SettingsCard;
