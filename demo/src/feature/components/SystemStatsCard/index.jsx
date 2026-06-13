/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * More info at: https://github.com/xchwarze/frieren
 */
import PanelCard from '@common/components/PanelCard';
import SkeletonBar from '@common/components/SkeletonBar';
import useSystemStats from '@module/feature/hooks/useSystemStats.js';

/**
 * SystemStatsCard component that displays system stats in a panel card.
 *
 * While the query is loading, an animated react-content-loader skeleton is
 * rendered in place of each statistic so the panel never shows blank content.
 * This is the reference example of the skeleton loading pattern.
 *
 * @return {ReactElement} The panel card component with system stats.
 */
const SystemStatsCard = () => {
    const query = useSystemStats();
    const { data, isSuccess } = query;

    const stats = [
        { key: 'cpu_usage', label: 'cpu usage' },
        { key: 'memory_used', label: 'memory' },
        { key: 'swap_used', label: 'swap' },
        { key: 'uptime', label: 'uptime' },
    ];

    return (
        <PanelCard
            title={'System Stats'}
            icon={'activity'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            <div className={'d-flex justify-content-evenly'}>
                {stats.map(({ key, label }) => (
                    <div key={key} className={'text-center'}>
                        <p className={'fs-4 mb-0'}>
                            {isSuccess ? (data?.[key] ?? '') : (<SkeletonBar width={60} height={32} barHeight={20} />)}
                        </p>
                        <span className={'text-body-secondary text-uppercase'}>
                            {label}
                        </span>
                    </div>
                ))}
            </div>
        </PanelCard>
    );
};

export default SystemStatsCard;
