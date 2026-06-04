/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Table from 'react-bootstrap/Table';
import * as yup from 'yup';

import PanelCard from '@src/components/PanelCard';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import SelectField from '@src/components/Form/SelectField';
import SubmitButton from '@src/components/Form/SubmitButton';
import Button from '@src/components/Button';
import useCellSearch from '@module/feature/hooks/useCellSearch.js';

const searchSchema = yup.object({
    mcc: yup.string(),
    mnc: yup.string(),
    lac: yup.string(),
    cid: yup.string(),
    country: yup.string(),
    city: yup.string(),
    resultsPerPage: yup.string(),
}).required();

const defaultValues = {
    mcc: '',
    mnc: '',
    lac: '',
    cid: '',
    country: '',
    city: '',
    resultsPerPage: '10',
};

const CellCard = () => {
    const { mutate: search, data: searchData, variables: searchParams, isPending } = useCellSearch();

    const results = searchData?.results ?? [];
    const totalResults = searchData?.totalResults ?? 0;
    const searchAfter = searchData?.searchAfter ?? '';

    const handleLoadMore = () => {
        if (searchAfter && searchParams) {
            search({ ...searchParams, searchAfter });
        }
    };

    return (
        <PanelCard title={'Cell Tower Search'} subtitle={'Search GSM/CDMA/LTE/5G cell towers for rogue base station detection'} showRefresh={false}>
            <FormProvider schema={searchSchema} onSubmit={search} defaultValues={defaultValues}>
                <Row className={'g-3'}>
                    <Col md={3}>
                        <InputField name={'mcc'} label={'MCC'} placeholder={'Mobile Country Code'} />
                    </Col>
                    <Col md={3}>
                        <InputField name={'mnc'} label={'MNC'} placeholder={'Mobile Network Code'} />
                    </Col>
                    <Col md={3}>
                        <InputField name={'lac'} label={'LAC'} placeholder={'Location Area Code'} />
                    </Col>
                    <Col md={3}>
                        <InputField name={'cid'} label={'CID'} placeholder={'Cell ID'} />
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
                <div className={'d-flex justify-content-end mt-3'}>
                    <SubmitButton label={'Search'} icon={'search'} loading={isPending} />
                </div>
            </FormProvider>

            {results.length > 0 && (
                <>
                    <p className={'text-muted mt-3 mb-2'}>
                        Total results: {totalResults}
                    </p>
                    <Table striped hover responsive>
                        <thead>
                            <tr>
                                <th>Operator</th>
                                <th>MCC</th>
                                <th>MNC</th>
                                <th>LAC</th>
                                <th>CID</th>
                                <th>Type</th>
                                <th>Country</th>
                                <th>Coordinates</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((result, index) => (
                                <tr key={index}>
                                    <td>{result.operator}</td>
                                    <td>{result.mcc}</td>
                                    <td>{result.mnc}</td>
                                    <td>{result.lac}</td>
                                    <td>{result.cid}</td>
                                    <td>{result.type}</td>
                                    <td>{result.country}</td>
                                    <td>{result.trilat}, {result.trilong}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
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

export default CellCard;
