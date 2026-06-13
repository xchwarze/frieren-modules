/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import * as yup from 'yup';

import PanelCard from '@src/components/PanelCard';
import FormActions from '@common/components/FormActions';
import SkeletonBar from '@src/components/SkeletonBar';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import TextAreaField from '@src/components/Form/TextAreaField';
import SubmitButton from '@src/components/Form/SubmitButton';
import Button from '@src/components/Button';
import useFetchHosts from '@module/feature/hooks/useFetchHosts';
import useAddHost from '@module/feature/hooks/useAddHost';
import useRestartService from '@module/feature/hooks/useRestartService';
import useCreateHostSnapshot from '@module/feature/hooks/useCreateHostSnapshot';
import useRollbackHostsFromSnapshot from '@module/feature/hooks/useRollbackHostsFromSnapshot';

const dnsSpoofSchema = yup.object({
    ip: yup.string().required('IP Address is mandatory'),
    domain: yup.string().required('Domain is mandatory')
}).required();

const Screen = () => {
    const query = useFetchHosts();
    const { isSuccess } = query;
    const { mutateAsync: addHostMutation } = useAddHost();
    const { mutateAsync: restartMutation, isPending: restartPending } = useRestartService();
    const { mutateAsync: snapshotMutation, isPending: snapshotPending } = useCreateHostSnapshot();
    const { mutateAsync: rollbackMutation, isPending: rollbackPending } = useRollbackHostsFromSnapshot();

    const defaultValues = {
        ip: '',
        domain: '',
        hosts: query?.data?.hosts ?? ''
    };

    return (
        <PanelCard
            title={'DNS Spoof'}
            icon={'globe'}
            subtitle={'Manage your DNS spoofing settings.'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            {isSuccess ? (
                <FormProvider schema={dnsSpoofSchema} onSubmit={addHostMutation} defaultValues={defaultValues}>
                    <TextAreaField
                        name={'hosts'}
                        label={'Hosts file'}
                        rows={6}
                        readOnly={true}
                    />
                    <InputField
                        name={'ip'}
                        label={'IP Address'}
                        placeholder={'Enter IP address'}
                    />
                    <InputField
                        name={'domain'}
                        label={'Domain'}
                        placeholder={'Enter domain'}
                    />
                    <FormActions>
                        <SubmitButton label={'Add'} icon={'plus'} />
                        <Button
                            label={'Restart Service'}
                            icon={'rotate-cw'}
                            onClick={restartMutation}
                            loading={restartPending}
                        />
                        <Button
                            label={'Snapshot Hosts'}
                            icon={'save'}
                            variant={'secondary'}
                            onClick={snapshotMutation}
                            loading={snapshotPending}
                        />
                        <Button
                            label={'Rollback Hosts'}
                            icon={'rotate-ccw'}
                            variant={'danger'}
                            onClick={rollbackMutation}
                            loading={rollbackPending}
                        />
                    </FormActions>
                </FormProvider>
            ) : (
                <>
                    <div className={'mb-3'}>
                        <SkeletonBar width={500} height={132} barHeight={120} />
                    </div>
                    <div className={'mb-3'}>
                        <SkeletonBar width={500} height={38} barHeight={32} />
                    </div>
                    <div className={'mb-3'}>
                        <SkeletonBar width={500} height={38} barHeight={32} />
                    </div>
                    <div className={'d-flex justify-content-end gap-2'}>
                        <SkeletonBar width={320} height={38} barHeight={32} />
                    </div>
                </>
            )}
        </PanelCard>
    );
};

export default Screen;
