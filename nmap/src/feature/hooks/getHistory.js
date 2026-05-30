/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { NMAP_GET_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useGetHistory = () => (
    useAuthenticatedQuery({
        queryKey: [NMAP_GET_HISTORY],
        queryFn: () => fetchPost({
            module: 'nmap',
            action: 'getHistory',
        }),
    })
);

export default useGetHistory;
