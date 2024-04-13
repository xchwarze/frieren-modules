import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { DNS_SPOOF_GET_DATA } from '@module/feature/helpers/queryKeys.js';

const useFetchHosts = () => useAuthenticatedQuery({
    queryKey: [DNS_SPOOF_GET_DATA],
    queryFn: () => fetchPost({
        module: 'dnsspoof',
        action: 'fetchHosts',
    }),
});

export default useFetchHosts;
