import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { DNS_SPOOF_GET_DATA } from '@module/feature/helpers/queryKeys.js';

const useAddHost = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ ip, domain }) => fetchPost({
            module: 'dnsspoof',
            action: 'addHost',
            ip,
            domain,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [DNS_SPOOF_GET_DATA]
            });
            toast.success('Host added successfully');
        },
    });
}

export default useAddHost;
