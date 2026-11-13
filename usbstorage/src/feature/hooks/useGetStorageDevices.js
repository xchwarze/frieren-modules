/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { USB_STORAGE_GET_STORAGE_DEVICES } from '@module/feature/helpers/queryKeys.js';

const useGetStorageDevices = () => useAuthenticatedQuery({
    queryKey: [USB_STORAGE_GET_STORAGE_DEVICES],
    queryFn: () => fetchPost({ module: 'usbstorage', action: 'getStorageDevices' }),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
    showGenericToast: false,
});

export default useGetStorageDevices;
