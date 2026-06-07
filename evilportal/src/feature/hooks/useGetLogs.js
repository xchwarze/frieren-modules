/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { EVIL_PORTAL_LOGS } from '@module/feature/helpers/queryKeys.js';

const useGetLogs = () => useAuthenticatedQuery({
    queryKey: [EVIL_PORTAL_LOGS],
    queryFn: () => fetchPost({
        module: 'evilportal',
        action: 'getLogs',
    }),
    refetchInterval: 5000,
});

export default useGetLogs;
