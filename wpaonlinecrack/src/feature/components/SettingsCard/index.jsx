/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import * as yup from 'yup';

import PanelCard from '@common/components/PanelCard';
import FormActions from '@common/components/FormActions';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import SubmitButton from '@src/components/Form/SubmitButton';
import useGetSettings from '@module/feature/hooks/useGetSettings.js';
import useSetSettings from '@module/feature/hooks/useSetSettings.js';

const wpaOnlineCrackSettingsSchema = yup.object({
    wpaSecKey: yup.string(),
    onlinehashcrackEmail: yup.string().email('Must be a valid email')
}).required();

const SettingsCard = () => {
    const settingsQuery = useGetSettings();
    const { mutateAsync: setSettings } = useSetSettings();

    const defaultValues = {
        wpaSecKey: settingsQuery?.data?.wpaSecKey ?? '',
        onlinehashcrackEmail: settingsQuery?.data?.onlinehashcrackEmail ?? '',
    };

    return (
        <PanelCard
            title={'Settings'}
            subtitle={<>To use these third party services you must be registered on their respective sites. <a href="https://wpa-sec.stanev.org/?get_key" target="_blank" rel="noopener noreferrer">Get your WPA-Sec API key here</a>.</>}
            refetch={settingsQuery.refetch}
            isFetching={settingsQuery.isFetching}
        >
            <FormProvider schema={wpaOnlineCrackSettingsSchema} onSubmit={setSettings} defaultValues={defaultValues}>
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
                <FormActions>
                    <SubmitButton />
                </FormActions>
            </FormProvider>
        </PanelCard>
    );
};

export default SettingsCard;
