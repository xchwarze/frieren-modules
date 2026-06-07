/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';
import * as yup from 'yup';
import { useQueryClient } from '@tanstack/react-query';

import PanelCard from '@common/components/PanelCard';
import FormActions from '@common/components/FormActions';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import SubmitButton from '@src/components/Form/SubmitButton';
import Button from '@common/components/Button';
import ConfirmationModal from '@src/components/ConfirmationModal';
import useGetSettings from '@module/feature/hooks/useGetSettings.js';
import useSaveSettings from '@module/feature/hooks/useSaveSettings.js';
import useToggleRouting from '@module/feature/hooks/useToggleRouting.js';
import useGetRoutingStatus from '@module/feature/hooks/useGetRoutingStatus.js';
import { PROXYHELPER_GET_ROUTING_STATUS } from '@module/feature/helpers/queryKeys.js';

const proxySettingsSchema = yup.object({
    proxyHost: yup.string()
        .required('Proxy IP Address is required')
        .matches(/^((25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(25[0-5]|2[0-4]\d|[01]?\d?\d)$/, 'Must be a valid IPv4 address'),
    proxyPort: yup.string()
        .required('Proxy Port is required')
        .matches(/^([1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/, 'Must be a valid port (1-65535)'),
    forwardPorts: yup.string()
        .required('At least one port is required')
        .test('valid-ports', 'Each port must be 1-65535', (value) => {
            if (!value) return false;
            const ports = value.split(',').map(p => p.trim()).filter(Boolean);
            if (ports.length === 0) return false;
            return ports.every(p => {
                const num = parseInt(p, 10);
                return !isNaN(num) && num >= 1 && num <= 65535;
            });
        }),
}).required();

const ProxyCard = () => {
    const settingsQuery = useGetSettings();
    const { isSuccess } = settingsQuery;
    const { mutateAsync: saveSettings } = useSaveSettings();
    const { mutate: toggleRouting, isPending: togglePending } = useToggleRouting();
    const queryClient = useQueryClient();
    const routingStatusQuery = useGetRoutingStatus();
    const routingEnabled = routingStatusQuery?.data?.enabled ?? false;
    const [showToggleConfirm, setShowToggleConfirm] = useState(false);

    const defaultValues = {
        proxyHost: settingsQuery?.data?.proxyHost ?? '',
        proxyPort: settingsQuery?.data?.proxyPort ?? '',
        forwardPorts: settingsQuery?.data?.forwardPorts ?? '',
    };

    const handleToggleRouting = () => {
        setShowToggleConfirm(false);
        const proxyHost = settingsQuery?.data?.proxyHost ?? '';
        const proxyPort = settingsQuery?.data?.proxyPort ?? '';
        const forwardPortsStr = settingsQuery?.data?.forwardPorts ?? '';
        const forwardPorts = forwardPortsStr.split(',').map((p) => p.trim()).filter(Boolean);

        const newEnabled = !routingEnabled;
        toggleRouting({
            enabled: newEnabled,
            proxyHost,
            proxyPort,
            forwardPorts,
        }, {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: [PROXYHELPER_GET_ROUTING_STATUS] });
            },
        });
    };

    return (
        <PanelCard
            title={'Proxy Configuration'}
            subtitle={'Configure the proxy destination and ports to forward through iptables DNAT rules.'}
            refetch={settingsQuery.refetch}
            isFetching={settingsQuery.isFetching}
        >
            {isSuccess ? (
                <FormProvider schema={proxySettingsSchema} onSubmit={saveSettings} defaultValues={defaultValues}>
                    <InputField
                        name={'proxyHost'}
                        label={'Proxy IP Address'}
                        placeholder={'192.168.1.100'}
                    />
                    <InputField
                        name={'proxyPort'}
                        label={'Proxy Port'}
                        placeholder={'8080'}
                    />
                    <InputField
                        name={'forwardPorts'}
                        label={'Forward Ports'}
                        placeholder={'80,443,8080'}
                    />
                    <FormActions>
                        <Button
                            label={routingEnabled ? 'Disable Routing' : 'Enable Routing'}
                            icon={routingEnabled ? 'x' : 'play'}
                            variant={routingEnabled ? 'danger' : 'success'}
                            onClick={() => setShowToggleConfirm(true)}
                            loading={togglePending}
                        />
                        <SubmitButton />
                    </FormActions>
                </FormProvider>
            ) : (
                <SkeletonTable
                    widths={[400]}
                    rows={4}
                />
            )}
            <ConfirmationModal
                show={showToggleConfirm}
                onHide={() => setShowToggleConfirm(false)}
                onConfirm={handleToggleRouting}
                title={routingEnabled ? 'Disable Routing' : 'Enable Routing'}
                description={routingEnabled
                    ? 'This will remove the DNAT/MASQUERADE rules and disable IP forwarding. A backup of the current firewall is taken first. Continue?'
                    : 'This will enable IP forwarding and add DNAT/MASQUERADE rules for the configured ports. A backup of the current firewall is taken first. Continue?'}
                isConfirmLoading={togglePending}
            />
        </PanelCard>
    );
};

export default ProxyCard;
