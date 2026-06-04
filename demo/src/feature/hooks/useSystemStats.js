/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@common/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@common/services/fetchService.js';
import { sleep } from '@common/helpers/actionsHelper.js';
import { DEMO_GET_SYSTEM_STATS } from '@module/feature/helpers/queryKeys.js';

/**
 * Generate a query to fetch system statistics data.
 *
 * @return {Object} The result of the query.
 */
const useSystemStats = () => (
    useAuthenticatedQuery({
        queryKey: [DEMO_GET_SYSTEM_STATS],
        queryFn: async () => {
            // Artificial delay so the skeleton stays visible longer (demo only)
            await sleep(2000);

            return fetchPost({
                module: 'demo',
                action: 'getSystemStats',
            });
        },
    })
);

export default useSystemStats;
