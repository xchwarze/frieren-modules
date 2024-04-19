/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@common/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@common/services/fetchService.js';
import { DEMO_GET_SYSTEM_STATS } from '@module/feature//helpers/queryKeys.js';

/**
 * Generate a query to fetch system statistics data.
 *
 * @return {Object} The result of the query.
 */
const useSystemStats = () => (
    useAuthenticatedQuery({
        queryKey: [DEMO_GET_SYSTEM_STATS],
        queryFn: () => fetchPost({
            module: 'demo',
            action: 'getSystemStats',
        }),

        // milliseconds * seconds
        gcTime: 1000 * 30,
        staleTime: 1000 * 30,
    })
);

export default useSystemStats;
