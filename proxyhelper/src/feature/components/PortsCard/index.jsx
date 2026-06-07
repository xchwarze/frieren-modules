/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';

import PanelCard from '@common/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import Button from '@common/components/Button';
import ConfirmationModal from '@src/components/ConfirmationModal';
import useGetForwardedPorts from '@module/feature/hooks/useGetForwardedPorts.js';
import useGetSettings from '@module/feature/hooks/useGetSettings.js';
import useAddPort from '@module/feature/hooks/useAddPort.js';
import useDeletePort from '@module/feature/hooks/useDeletePort.js';

const isValidPort = (value) => {
    const num = parseInt(value, 10);
    return /^\d+$/.test(value) && num >= 1 && num <= 65535;
};

const PortsCard = () => {
    const query = useGetForwardedPorts();
    const settingsQuery = useGetSettings();
    const { mutate: addPort, isPending: addPending } = useAddPort();
    const { mutate: deletePort, isPending: deletePending } = useDeletePort();
    const { data, isSuccess } = query;

    const [newPort, setNewPort] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);

    const proxyHost = settingsQuery?.data?.proxyHost ?? '';
    const proxyPort = settingsQuery?.data?.proxyPort ?? '';
    const canAdd = isValidPort(newPort) && proxyHost !== '' && proxyPort !== '';

    const handleAdd = () => {
        if (!canAdd) {
            return;
        }

        addPort({ port: newPort, proxyHost, proxyPort }, {
            onSuccess: () => setNewPort(''),
        });
    };

    const handleConfirmDelete = () => {
        if (!pendingDelete) {
            return;
        }

        deletePort(
            { port: pendingDelete.port, destination: pendingDelete.destination },
            { onSettled: () => setPendingDelete(null) },
        );
    };

    return (
        <PanelCard
            title={'Forwarded Ports'}
            subtitle={'View, add, and remove individual DNAT forwarding rules. Adding a port uses the saved proxy destination.'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            <InputGroup className={'mb-3'}>
                <Form.Control
                    type={'text'}
                    placeholder={'Port to forward (e.g. 80)'}
                    value={newPort}
                    onChange={(event) => setNewPort(event.target.value.trim())}
                />
                <Button
                    label={'Add Port'}
                    icon={'plus'}
                    variant={'success'}
                    onClick={handleAdd}
                    loading={addPending}
                    disabled={!canAdd}
                />
            </InputGroup>
            {isSuccess ? (
                <PanelTable>
                    <thead>
                    <tr>
                        <th>Port</th>
                        <th>Destination</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {data.ports.length > 0 ? (
                        data.ports.map((item) => (
                            <tr key={`${item.port}-${item.destination}`}>
                                <td>{item.port}</td>
                                <td>{item.destination}</td>
                                <td>
                                    <Button
                                        label={'Delete'}
                                        icon={'trash-2'}
                                        variant={'danger'}
                                        loading={deletePending}
                                        onClick={() => setPendingDelete(item)}
                                    />
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={3}>No forwarded ports configured.</td>
                        </tr>
                    )}
                    </tbody>
                </PanelTable>
            ) : (
                <SkeletonTable
                    headers={['Port', 'Destination', 'Actions']}
                    widths={[80, 160, 120]}
                    rows={3}
                />
            )}
            <ConfirmationModal
                show={pendingDelete !== null}
                onHide={() => setPendingDelete(null)}
                onConfirm={handleConfirmDelete}
                title={'Delete Forwarding Rule'}
                description={pendingDelete
                    ? `Remove the DNAT rule forwarding port ${pendingDelete.port} to ${pendingDelete.destination}? A firewall backup is taken first.`
                    : ''}
                isConfirmLoading={deletePending}
            />
        </PanelCard>
    );
};

export default PortsCard;
