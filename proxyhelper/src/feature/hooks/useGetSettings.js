/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { PROXYHELPER_GET_SETTINGS } from '@module/feature/helpers/queryKeys.js';

const useGetSettings = () => (
    useAuthenticatedQuery({
        queryKey: [PROXYHELPER_GET_SETTINGS],
        queryFn: () => fetchPost({
            module: 'proxyhelper',
            action: 'getSettings',
        }),
    })
);

export default useGetSettings;
