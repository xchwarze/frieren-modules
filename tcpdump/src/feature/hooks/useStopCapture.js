import { useSetAtom } from 'jotai';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';

const useStopCapture = () => {
    const setIsRunning = useSetAtom(isRunningAtom);

    return useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'tcpdump',
            action: 'stopCapture',
        }),
        onSuccess: () => {
            setIsRunning(false);
        }
    });
};

export default useStopCapture;
