/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import * as yup from 'yup';

import PanelCard from '@common/components/PanelCard';
import FormActions from '@common/components/FormActions';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import TextAreaField from '@src/components/Form/TextAreaField';
import SubmitButton from '@src/components/Form/SubmitButton';
import Button from '@common/components/Button';
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
                            icon={'refresh-cw'}
                            onClick={restartMutation}
                            loading={restartPending}
                        />
                        <Button
                            label={'Snapshot Hosts'}
                            icon={'copy'}
                            variant={'danger'}
                            onClick={snapshotMutation}
                            loading={snapshotPending}
                        />
                        <Button
                            label={'Rollback Hosts'}
                            icon={'shuffle'}
                            variant={'danger'}
                            onClick={rollbackMutation}
                            loading={rollbackPending}
                        />
                    </FormActions>
                </FormProvider>
            ) : (
                <SkeletonTable
                    widths={[500]}
                    rows={6}
                />
            )}
        </PanelCard>
    );
};

export default Screen;
