import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { DNS_SPOOF_GET_DATA } from '@module/feature/helpers/queryKeys.js';

const useRollbackHostsFromSnapshot = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'dnsspoof',
            action: 'rollbackHostsFromSnapshot',
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [DNS_SPOOF_GET_DATA]
            });
            toast.success('Hosts reset successfully');
        },
    });
};

export default useRollbackHostsFromSnapshot;
