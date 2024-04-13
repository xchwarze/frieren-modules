import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPostDownload } from '@src/services/fetchService.js';

const useDownloadCaptureOutput = () => (
    useAuthenticatedMutation({
        mutationFn: ({ outputFile }) => fetchPostDownload({
            module: 'tcpdump',
            action: 'getCaptureOutput',
            outputFile,
        })
    })
);

export default useDownloadCaptureOutput;
