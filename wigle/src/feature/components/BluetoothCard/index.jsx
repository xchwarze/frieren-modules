/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import * as yup from 'yup';

import PanelCard from '@src/components/PanelCard';
import PanelTable from '@src/components/PanelTable';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import SelectField from '@src/components/Form/SelectField';
import SubmitButton from '@src/components/Form/SubmitButton';
import FormActions from '@src/components/FormActions';
import Button from '@src/components/Button';
import useBluetoothSearch from '@module/feature/hooks/useBluetoothSearch.js';

const searchSchema = yup.object({
    name: yup.string(),
    mac: yup.string(),
    country: yup.string(),
    city: yup.string(),
    resultsPerPage: yup.string(),
}).required();

const defaultValues = {
    name: '',
    mac: '',
    country: '',
    city: '',
    resultsPerPage: '10',
};

const BluetoothCard = () => {
    const { mutate: search, data: searchData, variables: searchParams, isPending, isSuccess } = useBluetoothSearch();

    const results = searchData?.results ?? [];
    const totalResults = searchData?.totalResults ?? 0;
    const searchAfter = searchData?.searchAfter ?? '';

    const handleLoadMore = () => {
        if (searchAfter && searchParams) {
            search({ ...searchParams, searchAfter });
        }
    };

    return (
        <PanelCard title={'Bluetooth / BLE Search'} showRefresh={false}>
            <FormProvider schema={searchSchema} onSubmit={search} defaultValues={defaultValues}>
                <Row className={'g-3'}>
                    <Col md={6}>
                        <InputField name={'name'} label={'Device Name'} placeholder={'BLE device name'} />
                    </Col>
                    <Col md={6}>
                        <InputField name={'mac'} label={'MAC Address'} placeholder={'AA:BB:CC:DD:EE:FF'} />
                    </Col>
                    <Col md={6}>
                        <InputField name={'country'} label={'Country Code'} placeholder={'US, DE, AR...'} />
                    </Col>
                    <Col md={6}>
                        <InputField name={'city'} label={'City'} placeholder={'City name'} />
                    </Col>
                    <Col md={6}>
                        <SelectField
                            name={'resultsPerPage'}
                            label={'Results per page'}
                            options={[
                                { value: '10', label: '10' },
                                { value: '25', label: '25' },
                                { value: '50', label: '50' },
                                { value: '100', label: '100' },
                            ]}
                        />
                    </Col>
                </Row>
                <FormActions>
                    <SubmitButton label={'Search'} icon={'search'} loading={isPending} />
                </FormActions>
            </FormProvider>

            {isSuccess && (
                <>
                    <p className={'text-body-secondary mt-3 mb-2'}>
                        Total results: {totalResults}
                    </p>
                    <PanelTable>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>MAC</th>
                                <th>Type</th>
                                <th>Country</th>
                                <th>City</th>
                                <th>Coordinates</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.length > 0 ? (
                                results.map((result) => (
                                    <tr key={result.netid}>
                                        <td>{result.name}</td>
                                        <td><code>{result.netid}</code></td>
                                        <td>{result.type}</td>
                                        <td>{result.country}</td>
                                        <td>{result.city}</td>
                                        <td>{result.trilat}, {result.trilong}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6}>No devices found</td>
                                </tr>
                            )}
                        </tbody>
                    </PanelTable>
                    {searchAfter && (
                        <div className={'d-flex justify-content-center mt-2'}>
                            <Button
                                label={'Load More'}
                                icon={'chevrons-down'}
                                variant={'outline-primary'}
                                onClick={handleLoadMore}
                                loading={isPending}
                            />
                        </div>
                    )}
                </>
            )}
        </PanelCard>
    );
};

export default BluetoothCard;
