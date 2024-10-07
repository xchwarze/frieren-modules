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
 * Modifications: Modified functions to delete Nmap scan history.
 */

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@common/services/fetchService.js';
import { useQueryClient } from '@tanstack/react-query';
import { NMAP_GET_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useDeleteHistory = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ filename }) => fetchPost({
            module: 'nmap',
            action: 'deleteHistory',
            filename,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries([NMAP_GET_HISTORY]);
            console.log(`File ${filename} deleted successfully.`);
        },
        onError: (error) => {
            console.error(`Error deleting file ${filename}:`, error);
        },
    });
};

export default useDeleteHistory;
