/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { NMAP_GET_HISTORY_CONTENT } from '@module/feature/helpers/queryKeys.js';

const useGetHistoryContent = (filename) => (
    useAuthenticatedQuery({
        queryKey: [NMAP_GET_HISTORY_CONTENT, filename],
        queryFn: () => fetchPost({
            module: 'nmap',
            action: 'getHistoryContent',
            filename,
        }),
        enabled: !!filename,
    })
);

export default useGetHistoryContent;
