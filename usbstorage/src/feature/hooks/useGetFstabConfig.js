/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { USB_STORAGE_GET_FSTAB_CONFIG } from '@module/feature/helpers/queryKeys.js';

const useGetFstabConfig = () => useAuthenticatedQuery({
    queryKey: [USB_STORAGE_GET_FSTAB_CONFIG],
    queryFn: () => fetchPost({
        module: 'usbstorage',
        action: 'getFstabConfig',
    }),
});

export default useGetFstabConfig;
