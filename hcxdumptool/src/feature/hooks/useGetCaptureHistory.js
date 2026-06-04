/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { HCXDUMPTOOL_GET_CAPTURE_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useGetCaptureHistory = () => (
    useAuthenticatedQuery({
        queryKey: [HCXDUMPTOOL_GET_CAPTURE_HISTORY],
        queryFn: () => fetchPost({
            module: 'hcxdumptool',
            action: 'getCaptureHistory',
        }),
    })
);

export default useGetCaptureHistory;
