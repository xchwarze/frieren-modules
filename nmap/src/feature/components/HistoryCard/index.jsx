/*
 * Project: Frieren Nmap Module
 * Based on Frieren Framework Template Module and other Frieren modules
 * Original Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * Modifications and new code by m5kro <m5kro@proton.me>, 2024
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 *
 * Original code from Frieren Framework is distributed under the terms of the
 * GNU Lesser General Public License (LGPL) version 3 or later. You should have received
 * a copy of the LGPL-3.0-or-later along with this project. If not, see <https://www.gnu.org/licenses>.
 * 
 * Modifications: Modified functions to work with Nmap module log format and properly read logs.
 */

import React, { useState } from 'react';
import Table from 'react-bootstrap/Table';
import PanelCard from '@src/components/PanelCard';
import Button from '@src/components/Button';
import useGetHistory from '@module/feature/hooks/getHistory.js';
import useDeleteHistory from '@module/feature/hooks/deleteHistory.js';
import useGetHistoryContent from '@module/feature/hooks/getHistoryContent.js';

const HistoryCard = () => {
    const query = useGetHistory();
    const { mutate: deleteHistory, isPending: deleteHistoryRunning } = useDeleteHistory();
    const [selectedFile, setSelectedFile] = useState(null);
    const { data: fileContentData, isLoading: isLoadingContent } = useGetHistoryContent(selectedFile);
    const { data, isSuccess } = query;

    const handleOpenClick = (item) => {
        setSelectedFile(item);
    };

    const handleDeleteClick = (item) => {
        deleteHistory({ filename: item });
    };

    const files = data?.files || [];

    const logContent = fileContentData?.logContent;

    return (
        <PanelCard title={'History'} query={query}>
            {isSuccess && (
                <>
                    <Table striped hover responsive>
                        <thead>
                            <tr>
                                <th>Scan File</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.length > 0 ? (
                                files.map((item, index) => (
                                    <tr key={index}>
                                        <td>{item}</td>
                                        <td>
                                            <Button
                                                label={'Open'}
                                                icon={'folder-open'}
                                                onClick={() => handleOpenClick(item)}
                                            />
                                            <Button
                                                label={'Delete'}
                                                icon={'trash-2'}
                                                variant={'danger'}
                                                loading={deleteHistoryRunning}
                                                onClick={() => handleDeleteClick(item)}
                                                className={'ms-2'}
                                            />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={2}>No scan history to display.</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>

                    {selectedFile && (
                        <div className="mt-4">
                            <h5>File Content: {selectedFile}</h5>
                            {isLoadingContent ? (
                                <p>Loading content...</p>
                            ) : (
                                <pre>{logContent || 'No content available.'}</pre>
                            )}
                        </div>
                    )}
                </>
            )}
        </PanelCard>
    );
};

export default HistoryCard;
