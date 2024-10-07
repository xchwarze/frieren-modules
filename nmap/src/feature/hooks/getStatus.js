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
 * Modifications: Modified functions to retrieve Nmap status and check module dependencies.
 */

import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@common/services/fetchService.js';
import { NMAP_GET_STATUS, NMAP_CHECK_MODULE_DEPENDENCIES } from '@module/feature/helpers/queryKeys.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import { useSetAtom } from 'jotai';

const useGetStatus = () => {
    const setIsRunning = useSetAtom(isRunningAtom);

    return useAuthenticatedQuery({
        queryKey: [NMAP_GET_STATUS, NMAP_CHECK_MODULE_DEPENDENCIES],
        queryFn: async () => {
            // Fetch both module status and dependencies concurrently
            const [moduleStatusResponse, checkDependenciesResponse] = await Promise.all([
                fetchPost({
                    module: 'nmap',
                    action: 'moduleStatus',
                }),
                fetchPost({
                    module: 'nmap',
                    action: 'checkModuleDependencies',
                }),
            ]);

            return {
                hasDependencies: checkDependenciesResponse.hasDependencies,
                message: checkDependenciesResponse.message || 'No message',  // Fallback message
                internalAvailable: checkDependenciesResponse.internalAvailable,
                SDAvailable: checkDependenciesResponse.SDAvailable,
                isRunning: moduleStatusResponse.nmap_running,
            };
        },
        onSuccess: (data) => {
            setIsRunning(data.isRunning);
        },
    });
};

export default useGetStatus;
