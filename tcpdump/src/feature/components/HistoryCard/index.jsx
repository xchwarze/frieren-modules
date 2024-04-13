import Table from 'react-bootstrap/Table';

import PanelCard from '@src/components/PanelCard';
import Button from '@src/components/Button';
import useGetCaptureHistory from '@module/feature/hooks/useGetCaptureHistory.js';
import useDeleteCapture from '@module/feature/hooks/useDeleteCapture.js';
import useDeleteAll from '@module/feature/hooks/useDeleteAll.js';
import useDownloadCaptureOutput from '@module/feature/hooks/useDownloadCaptureOutput.js';

const CaptureHistory = () => {
    const query = useGetCaptureHistory();
    const { mutate: deleteHistory, isPending: deleteHistoryRunning } = useDeleteCapture();
    const { mutate: deleteAll, isPending: deleteAllRunning } = useDeleteAll();
    const { mutate: downloadCapture, isPending: downloadCaptureRunning } = useDownloadCaptureOutput();
    const { data, isSuccess } = query;

    const handleDownloadClick = (item) => {
        console.log({item})
        downloadCapture({
            outputFile: item,
        });
    };

    const handleDeleteClick = (item) => {
        deleteHistory({
            filename: item,
        });
    };

    return (
        <PanelCard
            title={'History'}
            query={query}
        >
            {isSuccess && (
                <>
                    <Table striped hover responsive>
                        <thead>
                            <tr>
                                <th>Capture File</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.files.length > 0 ? (
                                data.files.map((item, index) => (
                                    <tr key={index}>
                                        <td>{item}</td>
                                        <td>
                                            <Button
                                                label={'Download'}
                                                icon={'download'}
                                                loading={downloadCaptureRunning}
                                                onClick={() => handleDownloadClick(item)}
                                            />
                                            <Button
                                                label={'Delete'}
                                                icon={'trash-2'}
                                                variant={'danger'}
                                                loading={deleteHistoryRunning}
                                                onClick={() => handleDeleteClick(item)}
                                                className={'ms-2'}
                                            />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={2}>No capture history to display.</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                    <div className={'d-flex justify-content-end gap-2'}>
                        <Button
                            label={'Delete History'}
                            icon={'trash-2'}
                            variant={'danger'}
                            loading={deleteAllRunning}
                            onClick={deleteAll}
                        />
                    </div>
                </>
            )}
        </PanelCard>
    );
};

export default CaptureHistory;
