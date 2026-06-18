/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import * as yup from 'yup';

import PanelCard from '@src/components/PanelCard';
import PanelTable from '@src/components/PanelTable';
import ActionButtons from '@src/components/ActionButtons';
import ConfirmationModal from '@src/components/ConfirmationModal';
import FormActions from '@common/components/FormActions';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import SubmitButton from '@src/components/Form/SubmitButton';
import Button from '@src/components/Button';
import useFetchHosts from '@module/feature/hooks/useFetchHosts';
import useAddHost from '@module/feature/hooks/useAddHost';
import useDeleteHost from '@module/feature/hooks/useDeleteHost';
import useRestartService from '@module/feature/hooks/useRestartService';
import useCreateHostSnapshot from '@module/feature/hooks/useCreateHostSnapshot';
import useRollbackHostsFromSnapshot from '@module/feature/hooks/useRollbackHostsFromSnapshot';
import useFetchWildcards from '@module/feature/hooks/useFetchWildcards';
import useAddWildcard from '@module/feature/hooks/useAddWildcard';
import useRemoveWildcard from '@module/feature/hooks/useRemoveWildcard';

const dnsSpoofSchema = yup.object({
    ip: yup.string().required('IP Address is mandatory'),
    domain: yup.string().required('Domain is mandatory'),
}).required();

const defaultValues = {
    ip: '',
    domain: '',
};

// Loopback / system rows that live in the same /etc/hosts block but must never be
// listed as deletable spoof entries.
const SYSTEM_IPS = ['127.0.0.1', '127.0.1.1', '::1', '0.0.0.0'];

// Parse the managed hosts block into spoof entries, dropping comments, blanks and
// loopback/system rows so only operator-added spoofs are shown (and deletable).
const parseSpoofEntries = (hostsStr) => (hostsStr ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => {
        const [ip, ...rest] = line.split(/\s+/);

        return { ip, domain: rest.join(' ') };
    })
    .filter((entry) => entry.ip && entry.domain && !SYSTEM_IPS.includes(entry.ip));

const Screen = () => {
    const query = useFetchHosts();
    const { isSuccess } = query;
    const { mutateAsync: addHostMutation } = useAddHost();
    const { mutate: deleteHost, isPending: deletePending } = useDeleteHost();
    const { mutate: restartMutation, isPending: restartPending } = useRestartService();
    const { mutate: snapshotMutation, isPending: snapshotPending } = useCreateHostSnapshot();
    const { mutate: rollbackMutation, isPending: rollbackPending } = useRollbackHostsFromSnapshot();

    const wildcardsQuery = useFetchWildcards();
    const { mutateAsync: addWildcardMutation } = useAddWildcard();
    const { mutate: removeWildcard, isPending: removeWildcardPending } = useRemoveWildcard();

    const [pendingDelete, setPendingDelete] = useState(null);
    const [pendingWildcardDelete, setPendingWildcardDelete] = useState(null);

    const entries = parseSpoofEntries(query?.data?.hosts);
    const wildcards = wildcardsQuery?.data?.wildcards ?? [];

    return (
      <>
        <PanelCard
            title={'DNS Spoof'}
            icon={'globe'}
            subtitle={'Add or remove DNS spoofing entries served via dnsmasq.'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            <FormProvider schema={dnsSpoofSchema} onSubmit={addHostMutation} defaultValues={defaultValues}>
                <Row className={'g-3'}>
                    <Col md={6}>
                        <InputField name={'ip'} label={'IP Address'} placeholder={'Enter IP address'} />
                    </Col>
                    <Col md={6}>
                        <InputField name={'domain'} label={'Domain'} placeholder={'Enter domain'} />
                    </Col>
                </Row>
                <FormActions>
                    <SubmitButton label={'Add'} icon={'plus'} />
                </FormActions>
            </FormProvider>

            <div className={'mt-4'}>
                {isSuccess ? (
                    <PanelTable>
                        <thead>
                            <tr>
                                <th>Domain</th>
                                <th>IP</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.length > 0 ? (
                                entries.map((entry) => (
                                    <tr key={`${entry.ip}-${entry.domain}`}>
                                        <td>{entry.domain}</td>
                                        <td><code>{entry.ip}</code></td>
                                        <td>
                                            <ActionButtons>
                                                <Button
                                                    icon={'trash-2'}
                                                    title={'Delete'}
                                                    variant={'outline-danger'}
                                                    size={'sm'}
                                                    loading={deletePending}
                                                    onClick={() => setPendingDelete(entry)}
                                                />
                                            </ActionButtons>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3}>No spoof entries.</td>
                                </tr>
                            )}
                        </tbody>
                    </PanelTable>
                ) : (
                    <SkeletonTable
                        headers={['Domain', 'IP', 'Actions']}
                        widths={[200, 140, 80]}
                        rows={3}
                    />
                )}

                <div className={'d-flex flex-wrap justify-content-end gap-2 mt-3'}>
                    <Button
                        label={'Restart Service'}
                        icon={'rotate-cw'}
                        variant={'secondary'}
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
                </div>
            </div>

            <ConfirmationModal
                show={pendingDelete !== null}
                onHide={() => setPendingDelete(null)}
                onConfirm={() => deleteHost(
                    { ip: pendingDelete.ip, domain: pendingDelete.domain },
                    { onSettled: () => setPendingDelete(null) }
                )}
                title={'Delete spoof entry'}
                description={pendingDelete
                    ? `Remove "${pendingDelete.domain}" -> ${pendingDelete.ip}? Restart the service to apply.`
                    : ''}
                isConfirmLoading={deletePending}
            />
        </PanelCard>

        <PanelCard
            title={'DNS Wildcards'}
            icon={'globe'}
            subtitle={'Map *.domain to an IP via dnsmasq (covers all subdomains, unlike /etc/hosts).'}
            refetch={wildcardsQuery.refetch}
            isFetching={wildcardsQuery.isFetching}
        >
            <FormProvider schema={dnsSpoofSchema} onSubmit={addWildcardMutation} defaultValues={defaultValues}>
                <Row className={'g-3'}>
                    <Col md={6}>
                        <InputField name={'domain'} label={'Domain'} placeholder={'example.com (matches *.example.com)'} />
                    </Col>
                    <Col md={6}>
                        <InputField name={'ip'} label={'IP Address'} placeholder={'Enter IP address'} />
                    </Col>
                </Row>
                <FormActions>
                    <SubmitButton label={'Add Wildcard'} icon={'plus'} />
                </FormActions>
            </FormProvider>

            <div className={'mt-4'}>
                {wildcardsQuery.isSuccess ? (
                    <PanelTable>
                        <thead>
                            <tr>
                                <th>Domain</th>
                                <th>IP</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {wildcards.length > 0 ? (
                                wildcards.map((entry) => (
                                    <tr key={`${entry.domain}-${entry.ip}`}>
                                        <td><code>*.{entry.domain}</code></td>
                                        <td><code>{entry.ip}</code></td>
                                        <td>
                                            <ActionButtons>
                                                <Button
                                                    icon={'trash-2'}
                                                    title={'Remove'}
                                                    variant={'outline-danger'}
                                                    size={'sm'}
                                                    loading={removeWildcardPending}
                                                    onClick={() => setPendingWildcardDelete(entry)}
                                                />
                                            </ActionButtons>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3}>No wildcard entries.</td>
                                </tr>
                            )}
                        </tbody>
                    </PanelTable>
                ) : (
                    <SkeletonTable
                        headers={['Domain', 'IP', 'Actions']}
                        widths={[200, 140, 80]}
                        rows={2}
                    />
                )}
            </div>

            <ConfirmationModal
                show={pendingWildcardDelete !== null}
                onHide={() => setPendingWildcardDelete(null)}
                onConfirm={() => removeWildcard(
                    { ip: pendingWildcardDelete.ip, domain: pendingWildcardDelete.domain },
                    { onSettled: () => setPendingWildcardDelete(null) }
                )}
                title={'Remove wildcard'}
                description={pendingWildcardDelete
                    ? `Remove "*.${pendingWildcardDelete.domain}" -> ${pendingWildcardDelete.ip}?`
                    : ''}
                isConfirmLoading={removeWildcardPending}
            />
        </PanelCard>
      </>
    );
};

export default Screen;
