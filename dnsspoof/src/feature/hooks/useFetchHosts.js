/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { DNS_SPOOF_GET_DATA } from '@module/feature/helpers/queryKeys.js';

const useFetchHosts = () => useAuthenticatedQuery({
    queryKey: [DNS_SPOOF_GET_DATA],
    queryFn: () => fetchPost({
        module: 'dnsspoof',
        action: 'fetchHosts',
    }),
    // Refetch on mount so re-entering the section shows current entries.
    staleTime: 0,
});

export default useFetchHosts;
