/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { PROXYHELPER_GET_NAT_RULES } from '@module/feature/helpers/queryKeys.js';

const useGetNatRules = () => (
    useAuthenticatedQuery({
        queryKey: [PROXYHELPER_GET_NAT_RULES],
        queryFn: () => fetchPost({
            module: 'proxyhelper',
            action: 'getNatRules',
        }),
    })
);

export default useGetNatRules;
