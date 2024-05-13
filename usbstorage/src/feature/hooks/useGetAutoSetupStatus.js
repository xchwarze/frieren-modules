/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect } from 'react';
import { useAtom } from 'jotai';

import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningSetupAtom from '@module/feature/atoms/isRunningSetupAtom.js';
import { USB_STORAGE_GET_AUTO_SETUP_STATUS } from '@module/feature/helpers/queryKeys.js';

const useGetAutoSetupStatus = () => {
    const [isRunning, setIsRunning] = useAtom(isRunningSetupAtom);

    const query = useAuthenticatedQuery({
        queryKey: [USB_STORAGE_GET_AUTO_SETUP_STATUS],
        queryFn: () => fetchPost({
            module: 'usbstorage',
            action: 'getAutoSetupStatus',
        }),
        enabled: isRunning,
        staleTime: 0,
        refetchInterval: 1000,
    });

    useEffect(() => {
        if (query.isSuccess && query.data.isRunning === false) {
            setIsRunning(query.data.isRunning);
        }
    }, [query.data, query.isSuccess, query.dataUpdatedAt, setIsRunning]);

    return query
};

export default useGetAutoSetupStatus;
