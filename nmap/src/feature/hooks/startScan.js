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
 * Modifications: Modified functions to start Nmap scans.
 */

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@common/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import { useSetAtom } from 'jotai';

const useStartScan = () => {
    const setIsRunning = useSetAtom(isRunningAtom);

    return useAuthenticatedMutation({
        mutationFn: (commandArray) => {
            const command = commandArray["command"];
            const requestBody = {
                module: 'nmap',
                action: 'startScan',
                command,
            };
            return fetchPost(requestBody);
        },
        onSuccess: () => {
            setIsRunning(true);
        },
        onError: () => {
            setIsRunning(false);
        },
    });
};

export default useStartScan;