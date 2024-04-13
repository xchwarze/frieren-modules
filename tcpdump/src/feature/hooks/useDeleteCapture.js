import { useQueryClient } from '@tanstack/react-query';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { TCP_DUMP_GET_CAPTURE_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useDeleteCapture = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ filename }) => fetchPost({
            module: 'tcpdump',
            action: 'deleteCapture',
            filename,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [TCP_DUMP_GET_CAPTURE_HISTORY]
            });
        },
    });
};

export default useDeleteCapture;
