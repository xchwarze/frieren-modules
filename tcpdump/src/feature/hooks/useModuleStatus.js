/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useSetAtom } from 'jotai';

import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import { TCP_DUMP_GET_MODULE_STATUS } from '@module/feature/helpers/queryKeys.js';

const useModuleStatus = () => {
    const setIsRunning = useSetAtom(isRunningAtom);

    const query = useAuthenticatedQuery({
        queryKey: [TCP_DUMP_GET_MODULE_STATUS],
        queryFn: () => fetchPost({
            module: 'tcpdump',
            action: 'moduleStatus',
        }),
    });

    if (query.isSuccess) {
        setIsRunning(query.data.isRunning);
    }

    return query;
};

export default useModuleStatus;
