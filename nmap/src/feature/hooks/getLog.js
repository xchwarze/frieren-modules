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
import { NMAP_GET_LOG } from '@module/feature/helpers/queryKeys.js';

const useGetLog = () => {
    const [isRunning, setIsRunning] = useAtom(isRunningAtom);

    const query = useAuthenticatedQuery({
        queryKey: [NMAP_GET_LOG],
        queryFn: () => fetchPost({
            module: 'nmap',
            action: 'getLogContent',
        }),
        enabled: isRunning,
        staleTime: 0,
        refetchInterval: 2000,
    });

    useEffect(() => {
        if (query.isSuccess && query.data.isRunning === false) {
            setIsRunning(query.data.isRunning);
        }
    }, [query.data, query.isSuccess, query.dataUpdatedAt, setIsRunning]);

    return query;
};

export default useGetLog;
