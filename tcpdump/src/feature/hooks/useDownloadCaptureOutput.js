/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPostDownload } from '@src/services/fetchService.js';

const useDownloadCaptureOutput = () => (
    useAuthenticatedMutation({
        mutationFn: ({ outputFile }) => fetchPostDownload({
            module: 'tcpdump',
            action: 'getCaptureOutput',
            outputFile,
        })
    })
);

export default useDownloadCaptureOutput;
