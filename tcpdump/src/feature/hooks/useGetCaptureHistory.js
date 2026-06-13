/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { TCP_DUMP_GET_CAPTURE_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useGetCaptureHistory = () => (
    useAuthenticatedQuery({
        queryKey: [TCP_DUMP_GET_CAPTURE_HISTORY],
        queryFn: () => fetchPost({
            module: 'tcpdump',
            action: 'getCaptureHistory',
        }),
        // Always refetch on mount so re-entering the History tab shows new captures
        // (the global 10-min staleTime would otherwise serve a stale cached list).
        staleTime: 0,
    })
);

export default useGetCaptureHistory;
