/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';

import PanelCard from '@src/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import ActionButtons from '@common/components/ActionButtons';
import ConfirmationModal from '@common/components/ConfirmationModal';
import FormActions from '@common/components/FormActions';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import Button from '@src/components/Button';
import useGetCaptureHistory from '@module/feature/hooks/useGetCaptureHistory.js';
import useCheckHandshake from '@module/feature/hooks/useCheckHandshake.js';
import useDownloadCapture from '@module/feature/hooks/useDownloadCapture.js';
import useDeleteCapture from '@module/feature/hooks/useDeleteCapture.js';
import useDeleteAll from '@module/feature/hooks/useDeleteAll.js';

const formatBytes = (bytes) => {
    if (!bytes) {
        return '0 B';
    }
    const units = ['B', 'KiB', 'MiB', 'GiB'];
    const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));

    return `${(bytes / Math.pow(1024, exponent)).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const formatAccessPoints = (accessPoints) => {
    if (!accessPoints || accessPoints.length === 0) {
        return '—';
    }

    return accessPoints
        .map((ap) => `${ap.essid || ap.bssid} (ch ${ap.channel})`)
        .join(', ');
};

const HistoryCard = () => {
    const query = useGetCaptureHistory();
    const { mutate: checkHandshake, isPending: checkRunning } = useCheckHandshake();
    const { mutate: downloadCapture, isPending: downloadRunning } = useDownloadCapture();
    const { mutate: deleteCapture, isPending: deleteRunning } = useDeleteCapture();
    const { mutate: deleteAll, isPending: deleteAllRunning } = useDeleteAll();

    const { data, isSuccess } = query;
    const captures = data?.captures ?? [];
    const [pendingDelete, setPendingDelete] = useState(null);
    const [showDeleteAll, setShowDeleteAll] = useState(false);

    return (
        <PanelCard
            title={'History'}
            icon={'clock'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            {isSuccess ? (
                <>
                    <PanelTable>
                        <thead>
                            <tr>
                                <th>Capture</th>
                                <th>Access points</th>
                                <th>Size</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {captures.length > 0 ? (
                                captures.map((capture) => (
                                    <tr key={capture.name}>
                                        <td>{capture.name}</td>
                                        <td>{formatAccessPoints(capture.accessPoints)}</td>
                                        <td>{formatBytes(capture.size)}</td>
                                        <td>{new Date(capture.modified * 1000).toLocaleString()}</td>
                                        <td>
                                            <ActionButtons>
                                                <Button
                                                    icon={'shield'}
                                                    title={'Check for handshake'}
                                                    size={'sm'}
                                                    loading={checkRunning}
                                                    onClick={() => checkHandshake({ filename: capture.name })}
                                                />
                                                <Button
                                                    icon={'download'}
                                                    title={'Download'}
                                                    size={'sm'}
                                                    loading={downloadRunning}
                                                    onClick={() => downloadCapture({ filename: capture.name })}
                                                />
                                                <Button
                                                    icon={'trash-2'}
                                                    title={'Delete'}
                                                    variant={'outline-danger'}
                                                    size={'sm'}
                                                    onClick={() => setPendingDelete(capture.name)}
                                                />
                                            </ActionButtons>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5}>No captures yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </PanelTable>

                    <FormActions>
                        <Button
                            label={'Delete all'}
                            icon={'trash-2'}
                            variant={'danger'}
                            loading={deleteAllRunning}
                            disabled={captures.length === 0}
                            onClick={() => setShowDeleteAll(true)}
                        />
                    </FormActions>

                    <ConfirmationModal
                        show={pendingDelete !== null}
                        onHide={() => setPendingDelete(null)}
                        onConfirm={() => deleteCapture(
                            { filename: pendingDelete },
                            { onSettled: () => setPendingDelete(null) }
                        )}
                        title={'Delete capture'}
                        description={`Delete "${pendingDelete}"? This cannot be undone.`}
                        isConfirmLoading={deleteRunning}
                    />
                    <ConfirmationModal
                        show={showDeleteAll}
                        onHide={() => setShowDeleteAll(false)}
                        onConfirm={() => deleteAll(undefined, { onSettled: () => setShowDeleteAll(false) })}
                        title={'Delete all captures'}
                        description={'Delete every capture file? This cannot be undone.'}
                        isConfirmLoading={deleteAllRunning}
                    />
                </>
            ) : (
                <SkeletonTable
                    headers={['Capture', 'Access points', 'Size', 'Date', 'Actions']}
                    widths={[180, 160, 60, 140, 120]}
                    rows={3}
                />
            )}
        </PanelCard>
    );
};

export default HistoryCard;
