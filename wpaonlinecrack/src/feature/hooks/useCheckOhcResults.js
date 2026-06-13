/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { WPA_ONLINE_CRACK_CHECK_OHC_RESULTS } from '@module/feature/helpers/queryKeys.js';

const useCheckOhcResults = () => (
    useAuthenticatedQuery({
        queryKey: [WPA_ONLINE_CRACK_CHECK_OHC_RESULTS],
        queryFn: () => fetchPost({
            module: 'wpaonlinecrack',
            action: 'checkOhcResults',
        }),
        enabled: false,
        staleTime: 0,
    })
);

export default useCheckOhcResults;
