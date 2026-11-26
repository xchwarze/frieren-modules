/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import { HANDSHAKES_GET_CAPTURE_STATUS } from '@module/feature/helpers/queryKeys.js';

/**
 * Polls getCaptureStatus while a capture is running so an externally-ended run
 * (process died, wrapper flagged) flips the shared isRunning atom back to false.
 */
const useCaptureStatus = () => {
    const isRunning = useAtomValue(isRunningAtom);
    const setIsRunning = useSetAtom(isRunningAtom);

    const query = useAuthenticatedQuery({
        queryKey: [HANDSHAKES_GET_CAPTURE_STATUS],
        queryFn: () => fetchPost({
            module: 'handshakes',
            action: 'getCaptureStatus',
        }),
        enabled: isRunning,
        staleTime: 0,
        refetchInterval: isRunning ? 2000 : false,
    });

    useEffect(() => {
        if (query.isSuccess) {
            setIsRunning(query.data.isRunning === true);
        }
    }, [query.isSuccess, query.data, setIsRunning]);

    return query;
};

export default useCaptureStatus;
