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

import { useState, useMemo } from 'react';
import PanelCard from '@common/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import ActionButtons from '@common/components/ActionButtons';
import Button from '@common/components/Button';
import SearchInput from '@common/components/SearchInput';
import TablePagination from '@common/components/TablePagination';
import SkeletonBar from '@src/components/SkeletonBar';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import useDebouncedValue from '@common/hooks/useDebouncedValue.js';
import usePagination from '@common/hooks/usePagination.js';
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

    const [searchTerm, setSearchTerm] = useState('');
    const debounced = useDebouncedValue(searchTerm);
    const filtered = useMemo(
        () => (!debounced
            ? files
            : files.filter((f) => (f ?? '').toLowerCase().includes(debounced.toLowerCase()))),
        [files, debounced]
    );
    const { pageData, currentPage, totalPages, setCurrentPage } = usePagination(filtered);

    const logContent = fileContentData?.logContent;

    return (
        <PanelCard title={'History'} refetch={query.refetch} isFetching={query.isFetching}>
            {isSuccess ? (
                <>
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder={'Search by filename...'}
                    />
                    <PanelTable>
                        <thead>
                            <tr>
                                <th>Scan File</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length > 0 ? (
                                pageData.map((item) => (
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
                                    <td colSpan={2}>No scan history to display.</td>
                                </tr>
                            )}
                        </tbody>
                    </PanelTable>

                    <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={filtered.length}
                    />

                    {selectedFile && (
                        <div className={'mt-4'}>
                            <h5>File Content: {selectedFile}</h5>
                            {isLoadingContent ? (
                                <SkeletonBar width={600} height={120} barHeight={114} />
                            ) : (
                                <pre>{logContent || 'No content available.'}</pre>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <SkeletonTable
                    headers={['Scan File', 'Actions']}
                    widths={[200, 120]}
                    rows={3}
                />
            )}
        </PanelCard>
    );
};

export default HistoryCard;
