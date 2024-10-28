/*
 * Project: Frieren Nmap Module
 * Based on Frieren Framework Template Module and other Frieren modules
 * Original Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * Modifications and new code by m5kro <m5kro@proton.me>, 2024
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 *
 * Original code from Frieren Framework is distributed under the terms of the
 * GNU Lesser General Public License (LGPL) version 3 or later. You should have received
 * a copy of the LGPL-3.0-or-later along with this project. If not, see <https://www.gnu.org/licenses>.
 * 
 * Modifications: Added options to manage Nmap scans, including Nmap related command options.
 */

import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { useAtomValue } from 'jotai';
import * as yup from 'yup';
import PropTypes from 'prop-types';

import PanelCard from '@src/components/PanelCard';
import Button from '@src/components/Button';
import FormProvider from '@src/components/Form/FormProvider';
import SwitchField from '@src/components/Form/SwitchField';
import SelectField from '@src/components/Form/SelectField';
import SubmitButton from '@src/components/Form/SubmitButton';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import useStartScan from '@module/feature/hooks/startScan.js';
import useStopScan from '@module/feature/hooks/stopScan.js';
import CommandInput from '@module/feature/components/CommandInput';
import InputField from '@src/components/Form/InputField';

const nmapSettingsSchema = yup.object({
    command: yup.string().required('Command is mandatory'),
    target: yup.string().required('Target is mandatory'),
}).required();

const OptionsCard = ({ statusQuery }) => {
    const isRunning = useAtomValue(isRunningAtom);
    const { mutate: startScan } = useStartScan();
    const { mutate: stopScan, isPending: stopScanRunning } = useStopScan();

    const defaultValues = {
        command: '',
        target: '',
        verbose: false,
        osDetection: false,
        serviceVersion: false,
        traceroute: false,
        timing: '',
    };

    return (
        <PanelCard
            title={'Scan Settings'}
            query={statusQuery}
        >
            <FormProvider schema={nmapSettingsSchema} onSubmit={startScan} defaultValues={defaultValues}>
                <Row className={'g-4'}>
                    <Col md={6} className={'mt-4'}>
                        <p className={'fw-bold fs-5 mb-3'}>Basic Options</p>
                        <CommandInput label={'Command'} placeholder={'Enter Nmap command'} />
                        <InputField name={'target'} label={'Target'} placeholder={'Enter target'} />
                        <SelectField
                            name={'timing'}
                            label={'Timing (-T value)'}
                            options={[
                                { value: '', label: 'Default' },
                                { value: '0', label: '-T0 (Paranoid)' },
                                { value: '1', label: '-T1 (Sneaky)' },
                                { value: '2', label: '-T2 (Polite)' },
                                { value: '3', label: '-T3 (Normal)' },
                                { value: '4', label: '-T4 (Aggressive)' },
                                { value: '5', label: '-T5 (Insane)' },
                            ]}
                        />
                    </Col>

                    <Col md={6} className={'mt-4'}>
                        <p className={'fw-bold fs-5 mb-3'}>Advanced Options</p>
                        <SwitchField name={'verbose'} label={'Verbose'} />
                        <SwitchField name={'osDetection'} label={'OS Detection'} />
                        <SwitchField name={'serviceVersion'} label={'Service Version'} />
                        <SwitchField name={'traceroute'} label={'Traceroute'} />
                    </Col>
                </Row>

                <div className={'d-flex justify-content-end'}>
                    <SubmitButton label={'Start Scan'} icon={'play'} loading={isRunning} />
                    <Button
                        label={'Stop Scan'}
                        icon={'square'}
                        variant={'danger'}
                        onClick={stopScan}
                        loading={stopScanRunning}
                        disabled={!isRunning}
                        className={'ms-2'}
                    />
                </div>
            </FormProvider>
        </PanelCard>
    );
};

OptionsCard.propTypes = {
    statusQuery: PropTypes.object.isRequired,
};

export default OptionsCard;
