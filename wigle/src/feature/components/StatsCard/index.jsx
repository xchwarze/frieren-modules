/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Table from 'react-bootstrap/Table';

import PanelCard from '@src/components/PanelCard';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import useUserStats from '@module/feature/hooks/useUserStats.js';

const StatsCard = () => {
    const query = useUserStats();
    const { isSuccess } = query;
    const stats = query?.data?.statistics ?? null;

    return (
        <PanelCard
            title={'User Statistics'}
            subtitle={'Your WiGLE account stats — confirms API token is working'}
            query={query}
        >
            {isSuccess && stats ? (
                <Table striped hover responsive>
                    <tbody>
                        {Object.entries(stats).map(([key, value]) => (
                            <tr key={key}>
                                <td className={'fw-bold'}>{key}</td>
                                <td>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            ) : (
                <SkeletonTable widths={[120, 180]} rows={5} />
            )}
        </PanelCard>
    );
};

export default StatsCard;
