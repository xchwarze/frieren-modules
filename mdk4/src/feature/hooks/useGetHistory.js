/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { MDK4_GET_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useGetHistory = () => (
    useAuthenticatedQuery({
        queryKey: [MDK4_GET_HISTORY],
        queryFn: () => fetchPost({
            module: 'mdk4',
            action: 'getHistory',
        }),
    })
);

export default useGetHistory;
