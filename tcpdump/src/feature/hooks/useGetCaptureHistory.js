import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { TCP_DUMP_GET_CAPTURE_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useGetCaptureHistory = () => (
    useAuthenticatedQuery({
        queryKey: [TCP_DUMP_GET_CAPTURE_HISTORY],
        queryFn: () => fetchPost({
            module: 'tcpdump',
            action: 'getCaptureHistory',
        }),
    })
);

export default useGetCaptureHistory;
