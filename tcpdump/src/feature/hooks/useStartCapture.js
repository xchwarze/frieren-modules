import { useSetAtom } from 'jotai';

import { sleep } from '@src/helpers/actionsHelper.js';
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';

const useStartCapture = () => {
    const setIsRunning = useSetAtom(isRunningAtom);

    return useAuthenticatedMutation({
        mutationFn: ({ command }) => fetchPost({
            module: 'tcpdump',
            action: 'startCapture',
            command,
        }),
        onSuccess: async () => {
            await sleep(600);
            setIsRunning(true);
        },
    });
};

export default useStartCapture;
