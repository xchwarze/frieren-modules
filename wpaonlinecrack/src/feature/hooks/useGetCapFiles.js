/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { WPA_ONLINE_CRACK_GET_CAP_FILES } from '@module/feature/helpers/queryKeys.js';

const useGetCapFiles = () => (
    useAuthenticatedQuery({
        queryKey: [WPA_ONLINE_CRACK_GET_CAP_FILES],
        queryFn: () => fetchPost({
            module: 'wpaonlinecrack',
            action: 'getCapFiles',
        }),
    })
);

export default useGetCapFiles;
