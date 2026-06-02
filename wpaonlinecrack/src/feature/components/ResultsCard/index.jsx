/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Table from 'react-bootstrap/Table';

import PanelCard from '@src/components/PanelCard';
import Button from '@src/components/Button';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import useCheckResults from '@module/feature/hooks/useCheckResults.js';

const ResultsCard = () => {
    const query = useCheckResults();
    const { data, isSuccess, isFetching, refetch } = query;

    const results = data?.results ?? [];

    return (
        <PanelCard
            title={'Cracked Results'}
            subtitle={'Networks cracked by WPA-Sec for your API key.'}
            query={query}
        >
            <div className={'d-flex justify-content-end mb-3'}>
                <Button
                    label={'Check Results'}
                    icon={'search'}
                    loading={isFetching}
                    onClick={() => refetch()}
                />
            </div>

            {isSuccess ? (
                <Table striped hover responsive>
                    <thead>
                    <tr>
                        <th>BSSID</th>
                        <th>ESSID</th>
                        <th>Password</th>
                    </tr>
                    </thead>
                    <tbody>
                    {results.length > 0 ? (
                        results.map((item, index) => (
                            <tr key={index}>
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
                </Table>
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
