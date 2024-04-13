import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

const useSendCap = () => (
    useAuthenticatedMutation({
        mutationFn: ({ capture }) => fetchPost({
            module: 'wpaonlinecrack',
            action: 'sendCap',
            capture,
        }),
    })
);

export default useSendCap;
