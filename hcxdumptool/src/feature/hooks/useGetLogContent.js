/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect } from 'react';
import { useAtom } from 'jotai';

import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import { HCXDUMPTOOL_GET_LOG_CONTENT } from '@module/feature/helpers/queryKeys.js';

// The backend drains the log each call (read + truncate), so every poll returns
// only the new output. A short interval keeps the realtime display close to live
// while the payload stays tiny (no growing log re-sent, no extra process).
const POLL_INTERVAL_MS = 1000;

const useGetLogContent = () => {
    const [isRunning, setIsRunning] = useAtom(isRunningAtom);

    const query = useAuthenticatedQuery({
        queryKey: [HCXDUMPTOOL_GET_LOG_CONTENT],
        queryFn: () => fetchPost({
            module: 'hcxdumptool',
            action: 'getLogContent',
        }),
        enabled: isRunning,
        staleTime: 0,
        refetchInterval: POLL_INTERVAL_MS,
    });

    useEffect(() => {
        if (query.isSuccess && query.data.isRunning === false) {
            setIsRunning(false);
        }
    }, [query.data, query.isSuccess, query.dataUpdatedAt, setIsRunning]);

    return query;
};

export default useGetLogContent;
