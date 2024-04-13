import Table from 'react-bootstrap/Table';

import PanelCard from '@src/components/PanelCard';
import Button from '@src/components/Button';
import useGetCapFiles from '@module/feature/hooks/useGetCapFiles.js';
import useSendCap from '@module/feature/hooks/useSendCap.js';

const CapturesCard = () => {
    const query = useGetCapFiles();
    const { mutate: sendCapture, isPending: sendCaptureRunning } = useSendCap();
    const { data, isSuccess } = query;

    const handleSendClick = (item) => {
        sendCapture({
            capture: item,
        });
    };

    return (
        <PanelCard
            title={'Captures Resume'}
            subtitle={'The captures will be sent automatically to all the services that you have configured. The listed formats are: .cap .pcap .pcapng .hccapx'}
            query={query}
        >
            {isSuccess && (
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
                                        label={'Send to crackers'}
                                        icon={'upload'}
                                        loading={sendCaptureRunning}
                                        onClick={() => handleSendClick(item)}
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
            )}
        </PanelCard>
    );
};

export default CapturesCard;
