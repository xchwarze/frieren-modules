/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect } from 'react';
import { useAtom } from 'jotai';

import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import { TCP_DUMP_GET_LOG_CONTENT } from '@module/feature/helpers/queryKeys.js';

const useGetLogContent = () => {
    const [isRunning, setIsRunning] = useAtom(isRunningAtom);

    const query = useAuthenticatedQuery({
        queryKey: [TCP_DUMP_GET_LOG_CONTENT],
        queryFn: () => fetchPost({
            module: 'tcpdump',
            action: 'getLogContent',
        }),
        enabled: isRunning,
        staleTime: 0,
        refetchInterval: 5000,
    });

    useEffect(() => {
        if (query.isSuccess && query.data.isRunning === false) {
            setIsRunning(query.data.isRunning);
        }
    }, [query.data, query.isSuccess, setIsRunning]);

    return query
};

export default useGetLogContent;
