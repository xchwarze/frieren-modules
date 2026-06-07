/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import PanelCard from '@src/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import ActionButtons from '@common/components/ActionButtons';
import FormActions from '@common/components/FormActions';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import Button from '@src/components/Button';
import useGetCaptureHistory from '@module/feature/hooks/useGetCaptureHistory.js';
import useDeleteCapture from '@module/feature/hooks/useDeleteCapture.js';
import useDeleteAll from '@module/feature/hooks/useDeleteAll.js';
import useDownloadCaptureOutput from '@module/feature/hooks/useDownloadCaptureOutput.js';

const CaptureHistory = () => {
    const query = useGetCaptureHistory();
    const { mutate: deleteHistory, isPending: deleteHistoryRunning } = useDeleteCapture();
    const { mutate: deleteAll, isPending: deleteAllRunning } = useDeleteAll();
    const { mutate: downloadCapture, isPending: downloadCaptureRunning } = useDownloadCaptureOutput();
    const { data, isSuccess } = query;

    const handleDownloadClick = (item) => {
        downloadCapture({
            outputFile: item,
        });
    };

    const handleDeleteClick = (item) => {
        deleteHistory({
            filename: item,
        });
    };

    return (
        <PanelCard
            title={'History'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            {isSuccess ? (
                <>
                    <PanelTable>
                        <thead>
                            <tr>
                                <th>Capture File</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.files.length > 0 ? (
                                data.files.map((item) => (
                                    <tr key={item}>
                                        <td>{item}</td>
                                        <td>
                                            <ActionButtons>
                                                <Button
                                                    label={'Download'}
                                                    icon={'download'}
                                                    loading={downloadCaptureRunning}
                                                    onClick={() => handleDownloadClick(item)}
                                                />
                                                <Button
                                                    label={'Delete'}
                                                    icon={'trash-2'}
                                                    variant={'danger'}
                                                    loading={deleteHistoryRunning}
                                                    onClick={() => handleDeleteClick(item)}
                                                />
                                            </ActionButtons>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={2}>No capture history to display.</td>
                                </tr>
                            )}
                        </tbody>
                    </PanelTable>
                    <FormActions>
                        <Button
                            label={'Delete History'}
                            icon={'trash-2'}
                            variant={'danger'}
                            loading={deleteAllRunning}
                            onClick={deleteAll}
                        />
                    </FormActions>
                </>
            ) : (
                <SkeletonTable
                    headers={['Capture File', 'Actions']}
                    widths={[220, 180]}
                    rows={3}
                />
            )}
        </PanelCard>
    );
};

export default CaptureHistory;
