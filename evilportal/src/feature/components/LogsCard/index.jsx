/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Form from 'react-bootstrap/Form';

import PanelCard from '@common/components/PanelCard';
import FormActions from '@common/components/FormActions';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import Button from '@common/components/Button';
import useGetLogs from '@module/feature/hooks/useGetLogs.js';
import useClearLogs from '@module/feature/hooks/useClearLogs.js';

const LogsCard = () => {
    const logsQuery = useGetLogs();
    const { isSuccess } = logsQuery;
    const { mutateAsync: clearMutation, isPending: clearPending } = useClearLogs();

    const logs = logsQuery?.data?.logs ?? '';

    return (
        <PanelCard
            title={'Captured Logs'}
            subtitle={'Credential and event logs'}
            refetch={logsQuery.refetch}
            isFetching={logsQuery.isFetching}
        >
            {isSuccess ? (
                <Form.Control
                    as={'textarea'}
                    rows={12}
                    value={logs}
                    readOnly={true}
                    className={'font-monospace mb-3'}
                    style={{ fontSize: '0.85rem' }}
                />
            ) : (
                <SkeletonTable
                    widths={[600]}
                    rows={12}
                    className={'mb-3'}
                />
            )}
            <FormActions>
                <Button
                    label={'Clear Logs'}
                    icon={'trash-2'}
                    variant={'danger'}
                    onClick={() => clearMutation()}
                    loading={clearPending}
                />
            </FormActions>
        </PanelCard>
    );
};

export default LogsCard;
