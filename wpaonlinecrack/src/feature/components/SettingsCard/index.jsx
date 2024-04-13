/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import * as yup from 'yup';

import PanelCard from '@src/components/PanelCard';
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
            subtitle={'To use these third party services you must be registered on their respective sites.'}
            query={settingsQuery}
        >
            <FormProvider schema={wpaOnlineCrackSettingsSchema} onSubmit={setSettings} defaultValues={defaultValues}>
                <InputField
                    name={'wpaSecKey'}
                    label={'WPASEC Service Key'}
                    placeholder={'Enter your WPA service key'}
                />
                <InputField
                    name={'onlinehashcrackEmail'}
                    label={'OnlineHashCrack Email'}
                    placeholder={'Enter your email for OnlineHashCrack'}
                />
                <div className={'d-flex justify-content-end'}>
                    <SubmitButton />
                </div>
            </FormProvider>
        </PanelCard>
    );
};

export default SettingsCard;
