/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { HANDSHAKES_GET_CAPTURE_HISTORY } from '@module/feature/helpers/queryKeys.js';

/**
 * Captured files (with access points). staleTime 0 so re-entering the History tab
 * always shows newly captured files.
 */
const useGetCaptureHistory = () => (
    useAuthenticatedQuery({
        queryKey: [HANDSHAKES_GET_CAPTURE_HISTORY],
        queryFn: () => fetchPost({
            module: 'handshakes',
            action: 'getCaptureHistory',
        }),
        staleTime: 0,
    })
);

export default useGetCaptureHistory;
