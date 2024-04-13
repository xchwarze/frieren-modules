/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { WPA_ONLINE_CRACK_CHECK_MODULE_DEPENDENCIES } from '@module/feature/helpers/queryKeys.js';

const useCheckModuleDependencies = () => (
    useAuthenticatedQuery({
        queryKey: [WPA_ONLINE_CRACK_CHECK_MODULE_DEPENDENCIES],
        queryFn: () => fetchPost({
            module: 'wpaonlinecrack',
            action: 'checkModuleDependencies',
        }),
    })
);

export default useCheckModuleDependencies;
