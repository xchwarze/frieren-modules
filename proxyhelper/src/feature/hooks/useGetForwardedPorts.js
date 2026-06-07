/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { PROXYHELPER_GET_FORWARDED_PORTS } from '@module/feature/helpers/queryKeys.js';

const useGetForwardedPorts = () => (
    useAuthenticatedQuery({
        queryKey: [PROXYHELPER_GET_FORWARDED_PORTS],
        queryFn: () => fetchPost({
            module: 'proxyhelper',
            action: 'getForwardedPorts',
        }),
    })
);

export default useGetForwardedPorts;
