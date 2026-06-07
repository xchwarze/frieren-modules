/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { useAtomValue } from 'jotai';
import * as yup from 'yup';
import PropTypes from 'prop-types';

import PanelCard from '@common/components/PanelCard';
import FormActions from '@common/components/FormActions';
import Button from '@common/components/Button';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import SelectField from '@src/components/Form/SelectField';
import SubmitButton from '@src/components/Form/SubmitButton';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import useStartAttack from '@module/feature/hooks/useStartAttack.js';
import useStopAttack from '@module/feature/hooks/useStopAttack.js';
import AttackModeOptions, { getAttackOptionsDefaults, buildAttackOptionsFlags } from './AttackModeOptions';

const mdk4SettingsSchema = yup.object({
    interface: yup.string().required('Interface is mandatory'),
    attackMode: yup.string().required('Attack mode is mandatory'),
}).required();

const ATTACK_MODE_OPTIONS = [
    { value: 'b', label: 'b - Beacon Flooding' },
    { value: 'd', label: 'd - Deauthentication' },
    { value: 'a', label: 'a - Authentication DoS' },
    { value: 'p', label: 'p - SSID Probing' },
    { value: 'e', label: 'e - EAPOL Injection' },
    { value: 'm', label: 'm - Michael Countermeasures' },
    { value: 's', label: 's - IEEE 802.11s Mesh' },
    { value: 'w', label: 'w - WIDS Confusion' },
    { value: 'f', label: 'f - Packet Fuzzer' },
];

const SettingsCard = ({ statusQuery }) => {
    const isRunning = useAtomValue(isRunningAtom);
    const { mutate: startAttack } = useStartAttack();
    const { mutate: stopAttack, isPending: stopAttackRunning } = useStopAttack();
    const { interfaces } = statusQuery?.data ?? {};

    const interfaceOptions = (interfaces ?? []).map((iface) => ({
        value: iface,
        label: iface,
    }));

    const defaultValues = {
        interface: '',
        outputInterface: '',
        ghost: '',
        frag: '',
        attackMode: '',
        ...getAttackOptionsDefaults(),
    };

    const handleSubmit = (data) => {
        const parts = [data.interface];
        if (data.outputInterface) {
            parts.push(data.outputInterface);
        }
        if (data.ghost) {
            parts.push(`--ghost ${data.ghost}`);
        }
        if (data.frag) {
            parts.push(`--frag ${data.frag}`);
        }
        parts.push(data.attackMode);

        const optionsFlags = buildAttackOptionsFlags(data, data.attackMode);
        if (optionsFlags) {
            parts.push(optionsFlags);
        }

        startAttack({
            command: parts.join(' '),
            inputInterface: data.interface,
            outputInterface: data.outputInterface,
        });
    };

    return (
        <PanelCard
            title={'Attack Settings'}
            refetch={statusQuery.refetch}
            isFetching={statusQuery.isFetching}
        >
            <FormProvider schema={mdk4SettingsSchema} onSubmit={handleSubmit} defaultValues={defaultValues}>
                <Row className={'g-3'}>
                    <Col md={6}>
                        <SelectField
                            name={'interface'}
                            label={'Input Interface'}
                            options={[
                                { value: '', label: 'Select one...' },
                                ...interfaceOptions,
                            ]}
                        />
                        <SelectField
                            name={'outputInterface'}
                            label={'Output Interface'}
                            options={[
                                { value: '', label: 'None (optional)' },
                                ...interfaceOptions,
                            ]}
                        />
                        <SelectField
                            name={'attackMode'}
                            label={'Attack Mode'}
                            options={[
                                { value: '', label: 'Select one...' },
                                ...ATTACK_MODE_OPTIONS,
                            ]}
                        />
                        <p className={'fw-bold fs-5 mb-3'}>Global Options</p>
                        <InputField
                            name={'ghost'}
                            label={'--ghost: IDS evasion (period,max_rate,min_txpower)'}
                            placeholder={'e.g. 500,54,20'}
                        />
                        <InputField
                            name={'frag'}
                            label={'--frag: IDS evasion (min_frags,max_frags,percent)'}
                            placeholder={'e.g. 2,4,50'}
                        />
                    </Col>
                    <Col md={6}>
                        <p className={'fw-bold fs-5 mb-3'}>Attack Options</p>
                        <AttackModeOptions />
                    </Col>
                </Row>

                <FormActions>
                    <SubmitButton
                        label={'Start'}
                        icon={'play'}
                        loading={isRunning}
                    />
                    <Button
                        label={'Stop'}
                        icon={'square'}
                        variant={'danger'}
                        onClick={stopAttack}
                        loading={stopAttackRunning}
                        disabled={!isRunning}
                    />
                </FormActions>
            </FormProvider>
        </PanelCard>
    );
};

SettingsCard.propTypes = {
    statusQuery: PropTypes.object.isRequired,
}

export default SettingsCard;
