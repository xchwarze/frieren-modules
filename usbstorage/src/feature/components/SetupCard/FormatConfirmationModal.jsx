/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useId } from 'react';
import { Alert, Form, Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import Button from '@src/components/Button';
import { formatSize } from './StorageDeviceList.jsx';

const FormatConfirmationModal = ({ device, confirmation, onChange, onHide, onConfirm, disabled, pending }) => {
    const inputId = useId();

    return (
        <Modal show onHide={pending ? undefined : onHide} backdrop={pending ? 'static' : true} keyboard={!pending} centered>
            <Form onSubmit={(event) => { event.preventDefault(); onConfirm(); }}>
                <Modal.Header closeButton={!pending}>
                    <Modal.Title>Erase {device.path}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>{device.model || 'Unknown model'} — {formatSize(device.sizeBytes)} — {device.path}</p>
                    <Alert variant={'danger'}>All partitions and all data on this device will be irreversibly erased. This cannot be undone.</Alert>
                    <p>New layout: 1 GiB swap + remaining space as ext4 mounted at /sd.</p>
                    {device.warnings.map((warning) => <Alert key={warning} variant={'warning'}>{warning}</Alert>)}
                    <Form.Group controlId={inputId}>
                        <Form.Label>Type the exact device path to confirm erasure: {device.path}</Form.Label>
                        <Form.Control
                            autoComplete={'off'}
                            spellCheck={false}
                            value={confirmation}
                            onChange={(event) => onChange(event.target.value)}
                            disabled={pending}
                            aria-describedby={`${inputId}-help`}
                        />
                        <Form.Text id={`${inputId}-help`}>Spaces and different paths are not accepted.</Form.Text>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button label={'Cancel'} variant={'secondary'} onClick={onHide} disabled={pending} />
                    <Button label={'Erase device'} variant={'danger'} type={'submit'} loading={pending}
                        disabled={disabled || confirmation !== device.path} />
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

FormatConfirmationModal.propTypes = {
    device: PropTypes.object.isRequired,
    confirmation: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    onHide: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    disabled: PropTypes.bool.isRequired,
    pending: PropTypes.bool.isRequired,
};

export default FormatConfirmationModal;
