/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';

import PanelCard from '@common/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import ActionButtons from '@common/components/ActionButtons';
import FormActions from '@common/components/FormActions';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import Button from '@common/components/Button';
import { fetchPost } from '@src/services/fetchService.js';
import useGetHistory from '@module/feature/hooks/useGetHistory.js';
import useDeleteResult from '@module/feature/hooks/useDeleteResult.js';
import useClearHistory from '@module/feature/hooks/useClearHistory.js';
import useDownloadResult from '@module/feature/hooks/useDownloadResult.js';

const HistoryCard = () => {
    const query = useGetHistory();
    const { mutate: deleteResult, isPending: deleteResultRunning } = useDeleteResult();
    const { mutate: clearHistory, isPending: clearHistoryRunning } = useClearHistory();
    const { mutate: downloadResult, isPending: downloadResultRunning } = useDownloadResult();
    const { data, isSuccess } = query;
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState(null);
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    const handleOpenClick = async (filename) => {
        setSelectedFile(filename);
        setIsLoadingContent(true);
        try {
            const result = await fetchPost({
                module: 'mdk4',
                action: 'getOutput',
                outputFile: filename,
            });
            setFileContent(result.logContent);
        } catch {
            setFileContent('Failed to load file content.');
        }
        setIsLoadingContent(false);
    };

    const handleDeleteClick = (filename) => {
        deleteResult({ filename });
        if (selectedFile === filename) {
            setSelectedFile(null);
            setFileContent(null);
        }
    };

    const files = data?.files || [];

    return (
        <PanelCard title={'History'} refetch={query.refetch} isFetching={query.isFetching}>
            {isSuccess ? (
                <>
                    <PanelTable>
                        <thead>
                            <tr>
                                <th>Output File</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.length > 0 ? (
                                files.map((item) => (
                                    <tr key={item}>
                                        <td>{item}</td>
                                        <td>
                                            <ActionButtons>
                                                <Button
                                                    label={'Open'}
                                                    icon={'folder-open'}
                                                    onClick={() => handleOpenClick(item)}
                                                />
                                                <Button
                                                    label={'Download'}
                                                    icon={'download'}
                                                    loading={downloadResultRunning}
                                                    onClick={() => downloadResult({ outputFile: item })}
                                                />
                                                <Button
                                                    label={'Delete'}
                                                    icon={'trash-2'}
                                                    variant={'danger'}
                                                    loading={deleteResultRunning}
                                                    onClick={() => handleDeleteClick(item)}
                                                />
                                            </ActionButtons>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={2}>No attack history to display.</td>
                                </tr>
                            )}
                        </tbody>
                    </PanelTable>

                    <FormActions>
                        <Button
                            label={'Clear All'}
                            icon={'trash-2'}
                            variant={'danger'}
                            loading={clearHistoryRunning}
                            onClick={clearHistory}
                            disabled={files.length === 0}
                        />
                    </FormActions>

                    {selectedFile && (
                        <div className={'mt-4'}>
                            <h5>File Content: {selectedFile}</h5>
                            {isLoadingContent ? (
                                <p>Loading content...</p>
                            ) : (
                                <pre>{fileContent || 'No content available.'}</pre>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <SkeletonTable
                    headers={['Output File', 'Actions']}
                    widths={[220, 260]}
                    rows={3}
                />
            )}
        </PanelCard>
    );
};

export default HistoryCard;
