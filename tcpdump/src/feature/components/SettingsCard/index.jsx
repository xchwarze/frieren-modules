import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { useAtomValue } from 'jotai';
import * as yup from 'yup';
import PropTypes from 'prop-types';

import PanelCard from '@src/components/PanelCard';
import Button from '@src/components/Button';
import FormProvider from '@src/components/Form/FormProvider';
import SelectField from '@src/components/Form/SelectField';
import SwitchField from '@src/components/Form/SwitchField';
import SubmitButton from '@src/components/Form/SubmitButton';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import useStartCapture from '@module/feature/hooks/useStartCapture.js';
import useStopCapture from '@module/feature/hooks/useStopCapture.js';
import CommandInput from '@module/feature/components/CommandInput';
import FilterInput from '@module/feature/components/FilterInput';

const tcpDumpSettingsSchema = yup.object({
    command: yup.string().required('Command is mandatory'),
    interface: yup.string().required('Interface is mandatory'),
}).required();

const SettingsCard = ({ statusQuery }) => {
    const isRunning = useAtomValue(isRunningAtom);
    const { mutate: startCapture } = useStartCapture();
    const { mutate: stopCapture, isPending: stopCaptureRunning } = useStopCapture();
    const { interfaces } = statusQuery?.data ?? {};

    const defaultValues = {
        // commands
        command: '',
        interface: '',
        verbose: '',
        resolve: '',
        timestamp: '',

        // filters
        filter: '',
        filterType: '',
        filterDir: '',
        filterProtocol: '',
        filterLength: '',
        filterKind: '',
        filterOperator: '',

        // options
        dontPrintHostName: false,
        showHexAndASCII: false,
        printAbsoluteNumbers: false,
        getEthernetHeaders: false,
        lessProtocolInfo: false,
        monitorMode: false,
    };

    return (
        <PanelCard
            title={'Capture Settings'}
            query={statusQuery}
        >
            <FormProvider schema={tcpDumpSettingsSchema} onSubmit={startCapture} defaultValues={defaultValues}>
                <Row className={'g-4'}>
                    <Col md={4} className={'mt-4'}>
                        <p className={'fw-bold fs-5 mb-3'}>Basic Options</p>
                        <CommandInput
                            label={'Command'}
                            placeholder={'Enter TCPDump command'}
                        />
                        <Row className={'g-4'}>
                            <Col>
                                <SelectField
                                    name={'interface'}
                                    label={'Interface'}
                                    options={interfaces ?? []}
                                />
                            </Col>
                            <Col>
                                <SelectField
                                    name={'verbose'}
                                    label={'Verbose'}
                                    options={[
                                        {value: '', label: 'Select one...'},
                                        {value: '-v', label: 'Verbose'},
                                        {value: '-vv', label: 'Very verbose'},
                                        {value: '-vvv', label: 'Very very verbose'}
                                    ]}
                                />
                            </Col>
                        </Row>
                        <SelectField
                            name={'resolve'}
                            label={'Resolve'}
                            options={[
                                {value: '', label: 'Select one...'},
                                {value: '-n', label: 'Don\'t resolve hostnames'},
                                {value: '-nn', label: 'Don\'t resolve hostnames or port names'},
                            ]}
                        />
                        <SelectField
                            name={'timestamp'}
                            label={'Timestamp'}
                            options={[
                                {
                                    value: '',
                                    label: 'Select one...'
                                },
                                {
                                    value: '-t',
                                    label: 'Don\'t print a timestamp on each dump line'
                                },
                                {
                                    value: '-tt',
                                    label: 'Print an unformatted timestamp on each dump line'
                                },
                                {
                                    value: '-ttt',
                                    label: 'Print a delta (micro-second resolution) between current and previous line on each dump line'
                                },
                                {
                                    value: '-tttt',
                                    label: 'Print a timestamp in default format proceeded by date on each dump line'
                                },
                                {
                                    value: '-ttttt',
                                    label: 'Print a delta (micro-second resolution) between current and first line on each dump line'
                                },
                            ]}
                        />
                    </Col>

                    <Col md={4} className={'mt-4'}>
                        <p className={'fw-bold fs-5 mb-3'}>Filters</p>
                        <FilterInput
                            label={'Filter'}
                            placeholder={'Enter filter expression'}
                        />
                        <Row className={'g-4'}>
                            <Col>
                                <SelectField
                                    name={'filterType'}
                                    label={'Type'}
                                    options={[
                                        {value: '', label: 'Select one...'},
                                        {value: 'host', label: 'Host'},
                                        {value: 'net', label: 'Net'},
                                        {value: 'portrange', label: 'Port Range'},
                                        {value: 'port', label: 'Port'},
                                        {value: 'gateway', label: 'Gateway'},
                                        {value: 'mask', label: 'Mask'},
                                    ]}
                                />
                                <SelectField
                                    name={'filterProtocol'}
                                    label={'Protocol'}
                                    options={[
                                        {value: '', label: 'Select one...'},
                                        {value: 'ip', label: 'IP'},
                                        {value: 'icmp', label: 'ICMP'},
                                        {value: 'tcp', label: 'TCP'},
                                        {value: 'udp', label: 'UDP'},
                                        {value: 'arp', label: 'ARP'},
                                        {value: 'ether', label: 'Ethernet'},
                                        {value: 'http', label: 'HTTP'},
                                        {value: 'ftp', label: 'FTP'},
                                        {value: 'smtp', label: 'SMTP'},
                                    ]}
                                />
                                <SelectField
                                    name={'filterKind'}
                                    label={'Kind'}
                                    options={[
                                        {value: '', label: 'Select one...'},
                                        {value: 'broadcast', label: 'Broadcast'},
                                        {value: 'multicast', label: 'Multicast'},
                                    ]}
                                />
                            </Col>
                            <Col>
                                <SelectField
                                    name={'filterDir'}
                                    label={'Direction'}
                                    options={[
                                        {value: '', label: 'Select one...'},
                                        {value: 'src', label: 'Source'},
                                        {value: 'dst', label: 'Destination'},
                                        {value: 'src or dst', label: 'Source or Destination'},
                                        {value: 'src and dst', label: 'Source and Destination'},
                                    ]}
                                />
                                <SelectField
                                    name={'filterLength'}
                                    label={'Length'}
                                    options={[
                                        {value: '', label: 'Select one...'},
                                        {value: 'less', label: 'Less than'},
                                        {value: 'greater', label: 'Greater than'},
                                    ]}
                                />
                                <SelectField
                                    name={'filterOperator'}
                                    label={'Operator'}
                                    options={[
                                        {value: '', label: 'Select one...'},
                                        {value: 'not', label: 'NOT'},
                                        {value: 'and', label: 'AND'},
                                        {value: 'or', label: 'OR'},
                                        {value: '(', label: 'Open Parenthesis'},
                                        {value: ')', label: 'Close Parenthesis'},
                                    ]}
                                />
                            </Col>
                        </Row>
                    </Col>

                    <Col md={4} className={'mt-4'}>
                        <p className={'fw-bold fs-5 mb-3'}>Advanced</p>
                        <SwitchField
                            name={'dontPrintHostName'}
                            label={'Don\'t print domain name qualification of host names'}
                        />
                        <SwitchField
                            name={'showHexAndASCII'}
                            label={'Show the packet\'s contents in both hex and ASCII'}
                        />
                        <SwitchField
                            name={'printAbsoluteNumbers'}
                            label={'Print absolute sequence numbers'}
                        />
                        <SwitchField
                            name={'getEthernetHeaders'}
                            label={'Get the ethernet header as well'}
                        />
                        <SwitchField
                            name={'lessProtocolInfo'}
                            label={'Show less protocol information'}
                        />
                        <SwitchField
                            name={'monitorMode'}
                            label={'Monitor mode'}
                        />
                    </Col>
                </Row>

                <div className={'d-flex justify-content-end'}>
                    <SubmitButton
                        label={'Capture'}
                        icon={'play'}
                        loading={isRunning}
                    />
                    <Button
                        label={'Stop'}
                        icon={'square'}
                        variant={'danger'}
                        onClick={stopCapture}
                        loading={stopCaptureRunning}
                        disabled={!isRunning}
                        className={'ms-2'}
                    />
                </div>
            </FormProvider>
        </PanelCard>
    );
};

SettingsCard.propTypes = {
    statusQuery: PropTypes.object.isRequired,
}

export default SettingsCard;
