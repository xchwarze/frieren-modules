/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Form from 'react-bootstrap/Form';

import PanelCard from '@common/components/PanelCard';
import FormActions from '@common/components/FormActions';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import Button from '@common/components/Button';
import useGetStatus from '@module/feature/hooks/useGetStatus.js';
import useStartPortal from '@module/feature/hooks/useStartPortal.js';
import useStopPortal from '@module/feature/hooks/useStopPortal.js';
import useListPortals from '@module/feature/hooks/useListPortals.js';

const ControlCard = () => {
    const statusQuery = useGetStatus();
    const { isSuccess } = statusQuery;
    const portalsQuery = useListPortals();
    const { mutateAsync: startMutation, isPending: startPending } = useStartPortal();
    const { mutateAsync: stopMutation, isPending: stopPending } = useStopPortal();
    const [selectedPortal, setSelectedPortal] = useState('');

    const { isRunning, activePortal, clientCount } = statusQuery?.data ?? {};
    const portals = portalsQuery?.data?.portals ?? [];

    const handleStart = () => {
        if (selectedPortal) {
            startMutation({ portal: selectedPortal });
        }
    };

    const handleStop = async () => {
        await stopMutation();
        setSelectedPortal('');
    };

    return (
        <PanelCard
            title={'Evil Portal'}
            subtitle={'Captive portal control panel'}
            refetch={statusQuery.refetch}
            isFetching={statusQuery.isFetching}
        >
            {isSuccess ? (
            <>
            <div className={'d-flex align-items-center gap-2'}>
                <strong>Status:</strong>
                <Badge bg={isRunning ? 'success' : 'secondary'}>
                    {isRunning ? 'Running' : 'Stopped'}
                </Badge>
                {isRunning && activePortal && (
                    <span className={'text-body-secondary'}>
                        Portal: <strong>{activePortal}</strong> | Clients: <strong>{clientCount ?? 0}</strong>
                    </span>
                )}
            </div>

            {!isRunning && (
                <Form.Group className={'mb-3'}>
                    <Form.Label>Select Portal</Form.Label>
                    <Form.Select
                        value={selectedPortal}
                        onChange={(e) => setSelectedPortal(e.target.value)}
                    >
                        <option value={''}>-- Choose a portal --</option>
                        {portals.map((p) => (
                            <option key={p.name} value={p.name}>
                                {p.title || p.name}
                            </option>
                        ))}
                    </Form.Select>
                </Form.Group>
            )}

            <FormActions>
                {!isRunning ? (
                    <Button
                        label={'Start Portal'}
                        icon={'play'}
                        onClick={handleStart}
                        loading={startPending}
                        disabled={!selectedPortal}
                    />
                ) : (
                    <Button
                        label={'Stop Portal'}
                        icon={'square'}
                        variant={'danger'}
                        onClick={handleStop}
                        loading={stopPending}
                    />
                )}
            </FormActions>
            </>
            ) : (
                <SkeletonTable
                    widths={[400]}
                    rows={3}
                />
            )}
        </PanelCard>
    );
};

export default ControlCard;
