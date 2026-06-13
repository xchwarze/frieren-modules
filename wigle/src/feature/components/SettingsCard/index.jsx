/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import * as yup from 'yup';

import PanelCard from '@src/components/PanelCard';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import SubmitButton from '@src/components/Form/SubmitButton';
import FormActions from '@src/components/FormActions';
import useGetSettings from '@module/feature/hooks/useGetSettings.js';
import useSaveSettings from '@module/feature/hooks/useSaveSettings.js';

const settingsSchema = yup.object({
    apiToken: yup.string().required('API token is required'),
}).required();

const SettingsCard = () => {
    const settingsQuery = useGetSettings();
    const { mutateAsync: saveSettings } = useSaveSettings();

    const defaultValues = {
        apiToken: settingsQuery?.data?.apiToken ?? '',
    };

    return (
        <PanelCard
            title={'Settings'}
            icon={'key'}
            subtitle={'Enter your WiGLE encoded API token. Get it from wigle.net/account'}
            refetch={settingsQuery.refetch}
            isFetching={settingsQuery.isFetching}
        >
            <FormProvider schema={settingsSchema} onSubmit={saveSettings} defaultValues={defaultValues}>
                <InputField
                    name={'apiToken'}
                    label={'Encoded API Token'}
                    placeholder={'Enter your WiGLE API token'}
                />
                <FormActions>
                    <SubmitButton />
                </FormActions>
            </FormProvider>
        </PanelCard>
    );
};

export default SettingsCard;
