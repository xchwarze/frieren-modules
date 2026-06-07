/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';

import PanelCard from '@common/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import Button from '@common/components/Button';
import FormActions from '@common/components/FormActions';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import useGetCapFiles from '@module/feature/hooks/useGetCapFiles.js';
import useSendCap from '@module/feature/hooks/useSendCap.js';

const CapturesCard = () => {
    const query = useGetCapFiles();
    const { mutate: sendCaptures, isPending: sendCaptureRunning } = useSendCap();
    const { data, isSuccess, isFetching, refetch } = query;
    const [selectedFiles, setSelectedFiles] = useState([]);

    const files = data?.files ?? [];
    const pendingFiles = files.filter((item) => !item.submitted).map((item) => item.path);
    const allSelected = pendingFiles.length > 0 && selectedFiles.length === pendingFiles.length;

    const handleSelectAll = () => {
        setSelectedFiles(allSelected ? [] : [...pendingFiles]);
    };

    const handleSelectFile = (filePath) => {
        setSelectedFiles((prev) =>
            prev.includes(filePath)
                ? prev.filter((f) => f !== filePath)
                : [...prev, filePath]
        );
    };

    const handleSubmitSelected = () => {
        sendCaptures({
            captures: selectedFiles,
        });
        setSelectedFiles([]);
    };

    return (
        <PanelCard
            title={'Captures'}
            subtitle={'The selected captures will be sent to all the services that you have configured. The listed formats are: .cap .pcap .pcapng .hccapx'}
            refetch={refetch}
            isFetching={isFetching}
        >
            {isSuccess ? (
                <>
                    <PanelTable>
                        <thead>
                        <tr>
                            <th>
                                <Form.Check
                                    type={'checkbox'}
                                    checked={allSelected}
                                    disabled={pendingFiles.length === 0}
                                    onChange={handleSelectAll}
                                    aria-label={'Select all pending captures'}
                                />
                            </th>
                            <th>Capture File</th>
                            <th>Status</th>
                        </tr>
                        </thead>
                        <tbody>
                        {files.length > 0 ? (
                            files.map((item) => (
                                <tr key={item.path}>
                                    <td>
                                        <Form.Check
                                            type={'checkbox'}
                                            checked={selectedFiles.includes(item.path)}
                                            disabled={item.submitted}
                                            onChange={() => handleSelectFile(item.path)}
                                            aria-label={`Select ${item.path}`}
                                        />
                                    </td>
                                    <td>{item.path}</td>
                                    <td>
                                        {item.submitted ? (
                                            <Badge bg={'success'}>Submitted</Badge>
                                        ) : (
                                            <Badge bg={'secondary'}>Pending</Badge>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3}>No capture files found.</td>
                            </tr>
                        )}
                        </tbody>
                    </PanelTable>
                    {files.length > 0 && (
                        <FormActions>
                            <Button
                                label={'Submit Selected'}
                                icon={'upload'}
                                loading={sendCaptureRunning}
                                disabled={selectedFiles.length === 0}
                                onClick={handleSubmitSelected}
                            />
                        </FormActions>
                    )}
                </>
            ) : (
                <SkeletonTable
                    headers={['', 'Capture File', 'Status']}
                    widths={[20, 220, 80]}
                    rows={3}
                />
            )}
        </PanelCard>
    );
};

export default CapturesCard;
