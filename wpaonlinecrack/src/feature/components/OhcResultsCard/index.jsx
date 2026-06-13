/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState, useMemo } from 'react';
import Badge from 'react-bootstrap/Badge';

import PanelCard from '@common/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import Button from '@common/components/Button';
import FormActions from '@common/components/FormActions';
import SearchInput from '@common/components/SearchInput';
import TablePagination from '@common/components/TablePagination';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import useDebouncedValue from '@common/hooks/useDebouncedValue.js';
import usePagination from '@common/hooks/usePagination.js';
import useCheckOhcResults from '@module/feature/hooks/useCheckOhcResults.js';

// OHC doesn't return the recovered plaintext over the API, only task status — so a
// "cracked/found/done" status is shown green and everything else neutral.
const statusVariant = (status) => (
    /crack|found|done|complete|success/i.test(status ?? '') ? 'success' : 'secondary'
);

const OhcResultsCard = () => {
    const query = useCheckOhcResults();
    const { data, isFetching, isFetched, refetch } = query;
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebouncedValue(searchTerm);

    const tasks = data?.tasks ?? [];

    const filtered = useMemo(() => {
        if (!debouncedSearch) {
            return tasks;
        }
        const term = debouncedSearch.toLowerCase();
        return tasks.filter((item) =>
            [item.hash, item.status, item.algorithm]
                .some((field) => (field ?? '').toLowerCase().includes(term))
        );
    }, [tasks, debouncedSearch]);

    const { pageData, currentPage, totalPages, setCurrentPage } = usePagination(filtered);

    return (
        <PanelCard
            title={'OnlineHashCrack Tasks'}
            icon={'cloud'}
            subtitle={'Status of your OnlineHashCrack tasks. The recovered password is shown on onlinehashcrack.com — the API only returns task status.'}
            showRefresh={false}
        >
            <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={'Search tasks...'}
            />

            {isFetching ? (
                <SkeletonTable
                    headers={['Hash', 'Status', 'Algorithm', 'Last Attack']}
                    widths={[220, 90, 120, 120]}
                    rows={3}
                />
            ) : (
                <>
                    <PanelTable>
                        <thead>
                            <tr>
                                <th>Hash</th>
                                <th>Status</th>
                                <th>Algorithm</th>
                                <th>Last Attack</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length > 0 ? (
                                pageData.map((item) => (
                                    <tr key={item.hash}>
                                        <td className={'text-break font-monospace'}>{item.hash}</td>
                                        <td><Badge bg={statusVariant(item.status)}>{item.status || 'unknown'}</Badge></td>
                                        <td>{item.algorithm}</td>
                                        <td>{item.lastAttack}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4}>
                                        {isFetched ? 'No tasks found.' : 'Click "Check Status" to list your OnlineHashCrack tasks.'}
                                    </td>
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
                </>
            )}

            <FormActions>
                <Button
                    label={'Check Status'}
                    icon={'download-cloud'}
                    loading={isFetching}
                    onClick={() => refetch()}
                />
            </FormActions>
        </PanelCard>
    );
};

export default OhcResultsCard;
