import { toast } from 'react-toastify';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

const useCreateHostSnapshot = () => (
    useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'dnsspoof',
            action: 'createHostSnapshot',
        }),
        onSuccess: () => {
            toast.success('Backup successful');
        }
    })
);

export default useCreateHostSnapshot;
