import { toast } from 'react-toastify';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

const useRestartService = () => (
    useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'dnsspoof',
            action: 'restartService',
        }),
        onSuccess: () => {
            toast.success('DNS updated successfully');
        },
    })
);

export default useRestartService;
