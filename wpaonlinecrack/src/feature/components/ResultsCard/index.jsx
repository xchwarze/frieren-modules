/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState, useMemo } from 'react';

import PanelCard from '@common/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import SearchInput from '@common/components/SearchInput';
import TablePagination from '@common/components/TablePagination';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import useDebouncedValue from '@common/hooks/useDebouncedValue.js';
import usePagination from '@common/hooks/usePagination.js';
import useCheckResults from '@module/feature/hooks/useCheckResults.js';

const ResultsCard = () => {
    const query = useCheckResults();
    const { data, isSuccess, isFetching, refetch } = query;
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebouncedValue(searchTerm);

    const results = data?.results ?? [];

    const filtered = useMemo(() => {
        if (!debouncedSearch) {
            return results;
        }
        const term = debouncedSearch.toLowerCase();
        return results.filter((item) =>
            [item.bssid, item.essid, item.ssid]
                .some((field) => (field ?? '').toLowerCase().includes(term))
        );
    }, [results, debouncedSearch]);

    const { pageData, currentPage, totalPages, setCurrentPage } = usePagination(filtered);

    return (
        <PanelCard
            title={'Cracked Results'}
            subtitle={'Networks cracked by WPA-Sec for your API key.'}
            refetch={refetch}
            isFetching={isFetching}
        >
            {isSuccess ? (
                <>
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder={'Search results...'}
                    />

                    <PanelTable>
                        <thead>
                        <tr>
                            <th>BSSID</th>
                            <th>ESSID</th>
                            <th>Password</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filtered.length > 0 ? (
                            pageData.map((item) => (
                                <tr key={item.bssid}>
                                    <td>{item.bssid}</td>
                                    <td>{item.essid}</td>
                                    <td>{item.password}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3}>No cracked results yet.</td>
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
            ) : (
                <SkeletonTable
                    headers={['BSSID', 'ESSID', 'Password']}
                    widths={[140, 140, 140]}
                    rows={3}
                />
            )}
        </PanelCard>
    );
};

export default ResultsCard;
