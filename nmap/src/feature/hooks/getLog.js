/*
 * Project: Frieren Nmap Module
 * Based on Frieren Framework Template Module and other Frieren modules
 * Original Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * Modifications and new code by m5kro <m5kro@proton.me>, 2024
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 *
 * Original code from Frieren Framework is distributed under the terms of the
 * GNU Lesser General Public License (LGPL) version 3 or later. You should have received
 * a copy of the LGPL-3.0-or-later along with this project. If not, see <https://www.gnu.org/licenses>.
 * 
 * Modifications: Modified functions to retrieve Nmap log.
 */

import { useEffect } from 'react';
import { useAtom } from 'jotai';

import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import { NMAP_GET_LOG } from '@module/feature/helpers/queryKeys.js';

const useGetLogContent = () => {
    const [isRunning, setIsRunning] = useAtom(isRunningAtom);

    const query = useAuthenticatedQuery({
        queryKey: [NMAP_GET_LOG],
        queryFn: () => fetchPost({
            module: 'nmap',
            action: 'getLogContent',
        }),
        enabled: isRunning,
        staleTime: 0,
        refetchInterval: 2000,
    });

    useEffect(() => {
        if (query.isSuccess && query.data.isRunning === false) {
            setIsRunning(query.data.isRunning);
        }
    }, [query.data, query.isSuccess, query.dataUpdatedAt, setIsRunning]);

    return query;
};

export default useGetLogContent;
