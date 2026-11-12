/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import { useAtomValue } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';

import isRunningSetupAtom from '@module/feature/atoms/isRunningSetupAtom.js';
import useStartAutoSetup from '@module/feature/hooks/useStartAutoSetup.js';
import useGetAutoSetupStatus from '@module/feature/hooks/useGetAutoSetupStatus.js';
import useGetStorageDevices from '@module/feature/hooks/useGetStorageDevices.js';
import { USB_STORAGE_GET_AUTO_SETUP_STATUS, USB_STORAGE_GET_STORAGE_DEVICES } from '@module/feature/helpers/queryKeys.js';
import PanelCard from '@src/components/PanelCard';
import Button from '@src/components/Button';
import FormActions from '@common/components/FormActions';
import StorageDeviceList from './StorageDeviceList.jsx';
import FormatConfirmationModal from './FormatConfirmationModal.jsx';

const SetupCard = () => {
    const query = useGetAutoSetupStatus();
    const inventory = useGetStorageDevices();
    const mutation = useStartAutoSetup();
    const queryClient = useQueryClient();
    const isRunningSetup = useAtomValue(isRunningSetupAtom);
    const [selection, setSelection] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const [notice, setNotice] = useState('');
    const submitting = useRef(false);
    const wasRunning = useRef(false);

    const devices = inventory.data?.devices ?? [];
    const inventoryError = inventory.error?.message || inventory.data?.error;
    const statusValid = typeof query.data?.isRunning === 'boolean';
    const statusError = query.error?.message || (query.isSuccess && !statusValid ? 'Invalid setup status response.' : null);
    const inventoryReady = inventory.isSuccess && inventory.isFetchedAfterMount && !inventoryError
        && inventory.fetchStatus === 'idle';
    const statusReady = query.isSuccess && query.isFetchedAfterMount && statusValid && !statusError
        && query.fetchStatus === 'idle';
    const busy = mutation.isPending || isRunningSetup || query.data?.isRunning === true;
    const disabled = !inventoryReady || !statusReady || busy;
    const selectedDevice = !inventoryError && !inventory.isError && devices.find((device) => device.eligible
        && device.id === selection?.id && device.identity === selection.identity && device.path === selection.path);

    const clearSelection = useCallback(() => {
        setSelection(null);
        setShowConfirmation(false);
        setConfirmation('');
    }, []);

    useEffect(() => {
        if (selection && !selectedDevice) {
            clearSelection();
            setNotice('Storage selection is no longer valid. Review the refreshed inventory and select a device again.');
        }
    }, [selection, selectedDevice, clearSelection]);

    useEffect(() => {
        if (isRunningSetup || query.data?.isRunning === true) {
            wasRunning.current = true;
        } else if (wasRunning.current && statusReady && !mutation.isPending) {
            wasRunning.current = false;
            clearSelection();
            void queryClient.invalidateQueries({ queryKey: [USB_STORAGE_GET_STORAGE_DEVICES] });
        }
    }, [isRunningSetup, query.data?.isRunning, statusReady, mutation.isPending, queryClient, clearSelection]);

    const refresh = () => {
        clearSelection();
        setNotice('');
        void inventory.refetch();
        void query.refetch();
    };

    const submit = () => {
        // Recheck render-time safety gates for form submits as well as clicks.
        if (disabled || submitting.current || !selectedDevice || confirmation !== selectedDevice.path) return;
        // Query updates can precede React's next render. Do not submit an old snapshot.
        const currentInventory = queryClient.getQueryState([USB_STORAGE_GET_STORAGE_DEVICES]);
        const currentStatus = queryClient.getQueryState([USB_STORAGE_GET_AUTO_SETUP_STATUS]);
        if (currentInventory?.status !== 'success' || currentInventory.fetchStatus !== 'idle' || currentInventory.data.error
            || currentStatus?.status !== 'success' || currentStatus.fetchStatus !== 'idle' || currentStatus.data?.isRunning !== false
            || !currentInventory.data.devices.some((device) => device.eligible && device.id === selectedDevice.id
                && device.identity === selectedDevice.identity && device.path === confirmation)) return;
        submitting.current = true;
        mutation.mutate({ deviceId: selectedDevice.id, identity: selectedDevice.identity, confirmation }, {
            onSuccess: () => clearSelection(),
            onError: () => {
                clearSelection();
                void inventory.refetch();
            },
            onSettled: () => { submitting.current = false; },
        });
    };

    const { logContent } = query?.data ?? {};
    const resume = logContent || 'No setup log yet. Progress will appear here after setup starts.';

    const textareaRef = useRef(null);
    useEffect(() => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.scrollTop = textarea.scrollHeight;
        }
    }, [resume]);

    return (
        <PanelCard
            title={'Setup device'}
            icon={'tool'}
            subtitle={'Select external USB storage or a removable SD card. Internal eMMC is never supported. Extra device drivers may be required.'}
            refetch={refresh}
            isFetching={inventory.isFetching || query.isFetching}
        >
            {inventory.isPending && <p role={'status'}>Loading storage devices…</p>}
            {inventoryError && <Alert variant={'danger'}>Storage discovery blocked: {inventoryError}</Alert>}
            {inventory.isSuccess && !inventoryError && !devices.length && <p>No storage devices found. Connect external storage and refresh.</p>}
            {notice && <Alert variant={'warning'}>{notice}</Alert>}
            {mutation.isError && <Alert variant={'danger'}>Setup request rejected or unconfirmed: {mutation.error.message}</Alert>}
            {devices.length > 0 && <StorageDeviceList devices={devices} selectedDevice={selectedDevice || null}
                disabled={disabled} onSelect={(device) => {
                    clearSelection();
                    setNotice('');
                    mutation.reset();
                    setSelection({ id: device.id, identity: device.identity, path: device.path });
                }} />}
            {statusError ? <Alert variant={'danger'}>Cannot verify setup status: {statusError}</Alert> : (
                <p role={'status'}>
                    {mutation.isPending ? 'Setup request pending; checking task status…' : !statusReady
                        ? 'Checking setup status…' : busy ? 'Setup is running. See the log below.'
                            : 'Setup is not running. Review the log for the outcome; stopped does not mean successful.'}
                </p>
            )}
            <Form.Control
                aria-label={'Setup log'}
                ref={textareaRef}
                as={'textarea'}
                rows={20}
                readOnly={true}
                value={resume}
                className={'text-body-secondary'}
            />
            <FormActions>
                <Button
                    label={'Review erase'}
                    icon={'alert-triangle'}
                    variant={'danger'}
                    disabled={disabled || !selectedDevice}
                    onClick={() => { setConfirmation(''); setShowConfirmation(true); }}
                />
            </FormActions>
            {showConfirmation && selectedDevice && <FormatConfirmationModal
                device={selectedDevice} confirmation={confirmation} onChange={setConfirmation}
                onHide={() => { setShowConfirmation(false); setConfirmation(''); }}
                onConfirm={submit} disabled={disabled} pending={mutation.isPending}
            />}
        </PanelCard>
    );
};

export default SetupCard;
