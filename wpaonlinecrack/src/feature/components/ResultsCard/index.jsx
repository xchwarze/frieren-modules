/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import PanelCard from '@common/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
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
            refetch={refetch}
            isFetching={isFetching}
        >
            {isSuccess ? (
                <PanelTable>
                    <thead>
                    <tr>
                        <th>BSSID</th>
                        <th>ESSID</th>
                        <th>Password</th>
                    </tr>
                    </thead>
                    <tbody>
                    {results.length > 0 ? (
                        results.map((item) => (
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
