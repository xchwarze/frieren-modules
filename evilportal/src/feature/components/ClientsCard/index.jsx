/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useMemo, useState } from 'react';

import PanelCard from '@common/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import SearchInput from '@common/components/SearchInput';
import TablePagination from '@common/components/TablePagination';
import Button from '@common/components/Button';
import useDebouncedValue from '@common/hooks/useDebouncedValue.js';
import usePagination from '@common/hooks/usePagination.js';
import useGetClients from '@module/feature/hooks/useGetClients.js';
import useDeauthorizeClient from '@module/feature/hooks/useDeauthorizeClient.js';

const ClientsCard = () => {
    const clientsQuery = useGetClients();
    const { isSuccess } = clientsQuery;
    const { mutateAsync: deauthMutation, isPending: deauthPending } = useDeauthorizeClient();

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebouncedValue(searchTerm);

    const clients = clientsQuery?.data?.clients ?? [];

    const filteredClients = useMemo(() => {
        if (!debouncedSearch) {
            return clients;
        }
        const term = debouncedSearch.toLowerCase();
        return clients.filter((client) =>
            [client.mac, client.ip].some((field) => (field ?? '').toLowerCase().includes(term))
        );
    }, [clients, debouncedSearch]);

    const { pageData, currentPage, totalPages, setCurrentPage } = usePagination(filteredClients);

    return (
        <PanelCard
            title={'Authorized Clients'}
            subtitle={'Manage authorized clients'}
            refetch={clientsQuery.refetch}
            isFetching={clientsQuery.isFetching}
        >
            {isSuccess ? (
                <>
                <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder={'Search clients...'}
                />

                <PanelTable size={'sm'}>
                    <thead>
                        <tr>
                            <th>IP Address</th>
                            <th>MAC Address</th>
                            <th>Authorized At</th>
                            <th style={{ width: '120px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageData.map((client) => (
                            <tr key={client.mac}>
                                <td><code>{client.ip}</code></td>
                                <td><code>{client.mac}</code></td>
                                <td>{client.timestamp}</td>
                                <td>
                                    <Button
                                        label={'Revoke'}
                                        icon={'x-circle'}
                                        variant={'outline-danger'}
                                        size={'sm'}
                                        onClick={() => deauthMutation({ ip: client.ip })}
                                        loading={deauthPending}
                                    />
                                </td>
                            </tr>
                        ))}
                        {filteredClients.length === 0 && (
                            <tr>
                                <td colSpan={4} className={'text-center text-body-secondary'}>
                                    No authorized clients
                                </td>
                            </tr>
                        )}
                    </tbody>
                </PanelTable>

                <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={filteredClients.length}
                />
                </>
            ) : (
                <SkeletonTable
                    headers={['IP Address', 'MAC Address', 'Authorized At', 'Actions']}
                    widths={[120, 140, 160, 100]}
                    rows={3}
                />
            )}
        </PanelCard>
    );
};

export default ClientsCard;
