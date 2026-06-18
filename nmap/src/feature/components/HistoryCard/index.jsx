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
import PanelCard from '@src/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import ActionButtons from '@common/components/ActionButtons';
import Button from '@src/components/Button';
import SearchInput from '@common/components/SearchInput';
import TablePagination from '@common/components/TablePagination';
import SkeletonBar from '@src/components/SkeletonBar';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import useDebouncedValue from '@common/hooks/useDebouncedValue.js';
import usePagination from '@common/hooks/usePagination.js';
import useGetHistory from '@module/feature/hooks/getHistory.js';
import useDeleteHistory from '@module/feature/hooks/deleteHistory.js';
import useDeleteAll from '@module/feature/hooks/deleteAll.js';
import useGetHistoryContent from '@module/feature/hooks/getHistoryContent.js';
import useGetHistoryStructured from '@module/feature/hooks/getHistoryStructured.js';
import useDownloadResult from '@module/feature/hooks/downloadResult.js';

const HistoryCard = () => {
    const query = useGetHistory();
    const { mutate: deleteHistory, isPending: deleteHistoryRunning } = useDeleteHistory();
    const { mutate: deleteAll, isPending: deleteAllRunning } = useDeleteAll();
    const { mutate: downloadResult } = useDownloadResult();
    const [selectedFile, setSelectedFile] = useState(null);
    const [viewMode, setViewMode] = useState('raw');
    const { data: fileContentData, isLoading: isLoadingContent } = useGetHistoryContent(selectedFile);
    const { data: structuredData, isLoading: isLoadingStructured, isError: structuredError } =
        useGetHistoryStructured(viewMode === 'table' ? selectedFile : null);
    const { data, isSuccess } = query;

    const handleOpenClick = (item) => {
        setSelectedFile(item);
        setViewMode('raw');
    };

    const handleDeleteClick = (item) => {
        deleteHistory({ filename: item });
    };

    const handleDownloadClick = (item) => {
        downloadResult({ filename: item });
    };

    const handleDeleteAllClick = () => {
        deleteAll();
        setSelectedFile(null);
    };

    const files = data?.files || [];
    const hosts = structuredData?.hosts || [];

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
        <PanelCard title={'History'} icon={'clock'} refetch={query.refetch} isFetching={query.isFetching}>
            {isSuccess ? (
                <>
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder={'Search by filename...'}
                    />
                    <div className={'mb-2 text-end'}>
                        <Button
                            icon={'trash-2'}
                            title={'Delete History'}
                            variant={'outline-danger'}
                            size={'sm'}
                            loading={deleteAllRunning}
                            onClick={handleDeleteAllClick}
                        >
                            {'Delete History'}
                        </Button>
                    </div>
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
                                                    icon={'eye'}
                                                    title={'Open'}
                                                    size={'sm'}
                                                    onClick={() => handleOpenClick(item)}
                                                />
                                                <Button
                                                    icon={'download'}
                                                    title={'Download'}
                                                    size={'sm'}
                                                    onClick={() => handleDownloadClick(item)}
                                                />
                                                <Button
                                                    icon={'trash-2'}
                                                    title={'Delete'}
                                                    variant={'outline-danger'}
                                                    size={'sm'}
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
                            <div className={'d-flex justify-content-between align-items-center'}>
                                <h5 className={'mb-0'}>{'File Content: '}{selectedFile}</h5>
                                <ActionButtons>
                                    <Button
                                        icon={'file-text'}
                                        title={'Raw'}
                                        size={'sm'}
                                        variant={viewMode === 'raw' ? 'primary' : 'outline-secondary'}
                                        onClick={() => setViewMode('raw')}
                                    />
                                    <Button
                                        icon={'list'}
                                        title={'Table'}
                                        size={'sm'}
                                        variant={viewMode === 'table' ? 'primary' : 'outline-secondary'}
                                        onClick={() => setViewMode('table')}
                                    />
                                </ActionButtons>
                            </div>

                            {viewMode === 'raw' && (
                                isLoadingContent ? (
                                    <SkeletonBar width={600} height={120} barHeight={114} />
                                ) : (
                                    <pre>{logContent || 'No content available.'}</pre>
                                )
                            )}

                            {viewMode === 'table' && (
                                isLoadingStructured ? (
                                    <SkeletonBar width={600} height={120} barHeight={114} />
                                ) : structuredError || hosts.length === 0 ? (
                                    <p className={'mt-2'}>{'Structured output is not available for this scan.'}</p>
                                ) : (
                                    <PanelTable>
                                        <thead>
                                            <tr>
                                                <th>{'Host'}</th>
                                                <th>{'Port'}</th>
                                                <th>{'State'}</th>
                                                <th>{'Service'}</th>
                                                <th>{'Version'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hosts.flatMap((host) => (
                                                (host.ports || []).length > 0
                                                    ? host.ports.map((port) => (
                                                        <tr key={`${host.address}-${port.port}-${port.protocol}`}>
                                                            <td>{host.hostname ? `${host.address} (${host.hostname})` : host.address}</td>
                                                            <td>{`${port.port}/${port.protocol}`}</td>
                                                            <td>{port.state}</td>
                                                            <td>{port.service}</td>
                                                            <td>{port.version}</td>
                                                        </tr>
                                                    ))
                                                    : [(
                                                        <tr key={host.address}>
                                                            <td>{host.hostname ? `${host.address} (${host.hostname})` : host.address}</td>
                                                            <td colSpan={4}>{'No open ports'}</td>
                                                        </tr>
                                                    )]
                                            ))}
                                        </tbody>
                                    </PanelTable>
                                )
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
