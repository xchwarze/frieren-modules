/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useAtomValue } from 'jotai';

import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import { HANDSHAKES_GET_LOG_CONTENT } from '@module/feature/helpers/queryKeys.js';

/**
 * Drains the capture log while a run is active (airodump-ng repaints the live
 * TUI). Polling stops when the shared isRunning atom is false.
 */
const useGetLogContent = () => {
    const isRunning = useAtomValue(isRunningAtom);

    return useAuthenticatedQuery({
        queryKey: [HANDSHAKES_GET_LOG_CONTENT],
        queryFn: () => fetchPost({
            module: 'handshakes',
            action: 'getLogContent',
        }),
        staleTime: 0,
        refetchInterval: isRunning ? 1500 : false,
        // Before the first run there is no log yet — a 400 is expected, don't retry it.
        retry: false,
    });
};

export default useGetLogContent;
