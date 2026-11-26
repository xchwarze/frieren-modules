/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useSetAtom } from 'jotai';

import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import { HANDSHAKES_GET_MODULE_STATUS } from '@module/feature/helpers/queryKeys.js';

/**
 * Dependency + environment snapshot (interfaces, storage, running state).
 * staleTime 0 so re-entering the module re-syncs the running capture state.
 */
const useModuleStatus = () => {
    const setIsRunning = useSetAtom(isRunningAtom);

    const query = useAuthenticatedQuery({
        queryKey: [HANDSHAKES_GET_MODULE_STATUS],
        queryFn: () => fetchPost({
            module: 'handshakes',
            action: 'moduleStatus',
        }),
        staleTime: 0,
    });

    if (query.isSuccess) {
        setIsRunning(query.data.isRunning === true);
    }

    return query;
};

export default useModuleStatus;
