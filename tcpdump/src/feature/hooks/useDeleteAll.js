import { useQueryClient } from '@tanstack/react-query';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { TCP_DUMP_GET_CAPTURE_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useDeleteAll = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'tcpdump',
            action: 'deleteAll',
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [TCP_DUMP_GET_CAPTURE_HISTORY]
            });
        },
    })
};

export default useDeleteAll;
