/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect, useRef } from 'react';
import * as yup from 'yup';

import PanelCard from '@src/components/PanelCard';
import FormProvider from '@src/components/Form/FormProvider';
import TextAreaField from '@src/components/Form/TextAreaField';
import SubmitButton from '@src/components/Form/SubmitButton';
import useGetFstabConfig from '@module/feature/hooks/useGetFstabConfig.js';
import useSaveFstabConfig from '@module/feature/hooks/useSaveFstabConfig.js';

const fstabConfigSchema = yup.object({
    config: yup.string().required('Fstab config is mandatory'),
});

const ConfigCard = () => {
    const query = useGetFstabConfig();
    const { mutateAsync: saveFstabConfig } = useSaveFstabConfig();
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.scrollTop = textarea.scrollHeight;
        }
    }, [query?.data?.config]);

    const defaultValues = {
        config: query?.data?.config ?? 'No FSTAB config found!',
    };

    return (
        <PanelCard
            title={'FSTAB Configuration'}
            subtitle={'Manage and configure system mount points through FSTAB settings.' +
                'This interface allows you to view and update the filesystem table configuration, ensuring proper device and partition mounting on system startup.'}
            query={query}
        >
            <FormProvider schema={fstabConfigSchema} defaultValues={defaultValues} onSubmit={saveFstabConfig}>
                <TextAreaField
                    ref={textareaRef}
                    name={'config'}
                    label={'FSTAB Content'}
                    rows={20}
                />
                <SubmitButton />
            </FormProvider>
        </PanelCard>
    );
};

export default ConfigCard;
