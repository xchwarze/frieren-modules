/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Accordion from 'react-bootstrap/Accordion';
import * as yup from 'yup';

import PanelCard from '@src/components/PanelCard';
import PanelTable from '@src/components/PanelTable';
import Icon from '@src/components/Icon';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import SelectField from '@src/components/Form/SelectField';
import SwitchField from '@src/components/Form/SwitchField';
import SubmitButton from '@src/components/Form/SubmitButton';
import FormActions from '@src/components/FormActions';
import Button from '@src/components/Button';
import useSearch from '@module/feature/hooks/useSearch.js';
import useNetworkDetail from '@module/feature/hooks/useNetworkDetail.js';
import NetworkDetailModal from '@module/feature/components/NetworkDetailModal';

const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const countryRegex = /^[A-Za-z]{2}$/;

const searchSchema = yup.object({
    ssid: yup.string(),
    ssidlike: yup.string(),
    mac: yup
        .string()
        .test(
            'mac-format',
            'MAC must be like AA:BB:CC:DD:EE:FF',
            (value) => !value || macRegex.test(value),
        ),
    country: yup
        .string()
        .test(
            'country-iso',
            'Country must be a 2-letter ISO code',
            (value) => !value || countryRegex.test(value),
        ),
    city: yup.string(),
    encryption: yup.string(),
    region: yup.string(),
    postalCode: yup.string(),
    channel: yup.string(),
    frequency: yup.string(),
    latrange1: yup.string(),
    latrange2: yup.string(),
    longrange1: yup.string(),
    longrange2: yup.string(),
    closestLat: yup.string(),
    closestLong: yup.string(),
    lastupdt: yup.string(),
    onlymine: yup.boolean(),
    freenet: yup.boolean(),
    paynet: yup.boolean(),
    resultsPerPage: yup.string(),
}).required();

const defaultValues = {
    ssid: '',
    ssidlike: '',
    mac: '',
    country: '',
    city: '',
    encryption: '',
    region: '',
    postalCode: '',
    channel: '',
    frequency: '',
    latrange1: '',
    latrange2: '',
    longrange1: '',
    longrange2: '',
    closestLat: '',
    closestLong: '',
    lastupdt: '',
    onlymine: false,
    freenet: false,
    paynet: false,
    resultsPerPage: '10',
};

const buildWigleSearchUrl = (params) => {
    const query = new URLSearchParams();
    if (params.ssid) query.set('ssid', params.ssid);
    if (params.ssidlike) query.set('ssidlike', params.ssidlike);
    if (params.mac) query.set('netid', params.mac);
    if (params.country) query.set('country', params.country);
    if (params.city) query.set('city', params.city);
    if (params.encryption) query.set('encryption', params.encryption);

    return `https://wigle.net/search#${query.toString()}`;
};

const buildWigleNetworkUrl = (netid) => {
    const query = new URLSearchParams();
    query.set('netid', netid);

    return `https://wigle.net/search#${query.toString()}`;
};

const SearchCard = () => {
    const { mutate: search, data: searchData, variables: searchParams, isPending, isSuccess } = useSearch();
    const { mutate: fetchDetail, data: detailData, isPending: detailPending, reset: resetDetail } = useNetworkDetail();
    const [detailNetid, setDetailNetid] = useState(null);

    const results = searchData?.results ?? [];
    const totalResults = searchData?.totalResults ?? 0;
    const searchAfter = searchData?.searchAfter ?? '';

    const handleLoadMore = () => {
        if (searchAfter && searchParams) {
            search({ ...searchParams, searchAfter });
        }
    };

    const handleShowDetail = (netid) => {
        if (!netid) {
            return;
        }

        setDetailNetid(netid);
        fetchDetail({ netid });
    };

    const handleHideDetail = () => {
        setDetailNetid(null);
        resetDetail();
    };

    return (
        <PanelCard title={'WiGLE Lookup'} icon={'wifi'} showRefresh={false}>
            <FormProvider schema={searchSchema} onSubmit={search} defaultValues={defaultValues}>
                <Accordion defaultActiveKey={'criteria'} alwaysOpen={true}>
                    <Accordion.Item eventKey={'criteria'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'search'} /></span>Search Criteria</Accordion.Header>
                        <Accordion.Body>
                            <Row className={'g-3'}>
                                <Col md={6}>
                                    <InputField name={'ssid'} label={'SSID (exact)'} placeholder={'WiFi network name'} />
                                </Col>
                                <Col md={6}>
                                    <InputField name={'ssidlike'} label={'SSID (wildcard)'} placeholder={'% and _ wildcards'} />
                                </Col>
                                <Col md={6}>
                                    <InputField name={'mac'} label={'MAC Address'} placeholder={'AA:BB:CC:DD:EE:FF'} />
                                </Col>
                                <Col md={6}>
                                    <SelectField
                                        name={'encryption'}
                                        label={'Encryption'}
                                        options={[
                                            { value: '', label: 'Any' },
                                            { value: 'none', label: 'Open (none)' },
                                            { value: 'wep', label: 'WEP' },
                                            { value: 'wpa', label: 'WPA' },
                                            { value: 'wpa2', label: 'WPA2' },
                                            { value: 'wpa3', label: 'WPA3' },
                                        ]}
                                    />
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
                        </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey={'advanced'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'filter'} /></span>Advanced Filters</Accordion.Header>
                        <Accordion.Body>
                            <Row className={'g-3'}>
                                <Col md={6}>
                                    <InputField name={'region'} label={'Region (state/province)'} placeholder={'e.g. California'} />
                                </Col>
                                <Col md={6}>
                                    <InputField name={'postalCode'} label={'Postal Code'} placeholder={'ZIP / postal code'} />
                                </Col>
                                <Col md={6}>
                                    <InputField name={'channel'} label={'Channel'} type={'number'} placeholder={'e.g. 6'} />
                                </Col>
                                <Col md={6}>
                                    <InputField name={'frequency'} label={'Frequency (MHz)'} type={'number'} placeholder={'e.g. 2437'} />
                                </Col>
                                <Col md={3}>
                                    <InputField name={'latrange1'} label={'Lat range 1'} type={'number'} placeholder={'min latitude'} />
                                </Col>
                                <Col md={3}>
                                    <InputField name={'latrange2'} label={'Lat range 2'} type={'number'} placeholder={'max latitude'} />
                                </Col>
                                <Col md={3}>
                                    <InputField name={'longrange1'} label={'Long range 1'} type={'number'} placeholder={'min longitude'} />
                                </Col>
                                <Col md={3}>
                                    <InputField name={'longrange2'} label={'Long range 2'} type={'number'} placeholder={'max longitude'} />
                                </Col>
                                <Col md={6}>
                                    <InputField name={'closestLat'} label={'Closest Latitude'} type={'number'} placeholder={'order by proximity'} />
                                </Col>
                                <Col md={6}>
                                    <InputField name={'closestLong'} label={'Closest Longitude'} type={'number'} placeholder={'order by proximity'} />
                                </Col>
                                <Col md={6}>
                                    <InputField name={'lastupdt'} label={'Last Updated (yyyyMMdd)'} placeholder={'e.g. 20260101'} />
                                </Col>
                                <Col md={6} className={'d-flex flex-column justify-content-end'}>
                                    <SwitchField name={'onlymine'} label={'Only my observations'} />
                                    <SwitchField name={'freenet'} label={'Free network only'} />
                                    <SwitchField name={'paynet'} label={'Pay network only'} />
                                </Col>
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>
                </Accordion>

                <FormActions>
                    <SubmitButton label={'Search'} icon={'search'} loading={isPending} />
                </FormActions>
            </FormProvider>

            {isSuccess && (
                <div className={'mt-4'}>
                    <p className={'text-body-secondary mb-3'}>
                        Total results: {totalResults}
                        {' — '}
                        <a
                            href={buildWigleSearchUrl(searchParams)}
                            target={'_blank'}
                            rel={'noopener noreferrer'}
                        >
                            View on WiGLE.net
                        </a>
                    </p>
                    <PanelTable>
                        <thead>
                            <tr>
                                <th>SSID</th>
                                <th>MAC</th>
                                <th>Channel</th>
                                <th>Encryption</th>
                                <th>Country</th>
                                <th>City</th>
                                <th>Road</th>
                                <th>DHCP</th>
                                <th>Coordinates</th>
                                <th>Link</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.length > 0 ? (
                                results.map((result) => (
                                    <tr key={result.netid}>
                                        <td>{result.ssid}</td>
                                        <td>
                                            <Button
                                                variant={'link'}
                                                size={'sm'}
                                                className={'p-0 font-monospace'}
                                                onClick={() => handleShowDetail(result.netid)}
                                                label={result.netid}
                                            />
                                        </td>
                                        <td>{result.channel}</td>
                                        <td>{result.encryption}</td>
                                        <td>{result.country}</td>
                                        <td>{result.city}</td>
                                        <td>{result.road}</td>
                                        <td>{result.dhcp}</td>
                                        <td>{result.trilat}, {result.trilong}</td>
                                        <td>
                                            {result.netid && (
                                                <a
                                                    href={buildWigleNetworkUrl(result.netid)}
                                                    target={'_blank'}
                                                    rel={'noopener noreferrer'}
                                                >
                                                    WiGLE.net
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={10}>No networks found</td>
                                </tr>
                            )}
                        </tbody>
                    </PanelTable>
                    {searchAfter && (
                        <div className={'d-flex justify-content-center mt-3'}>
                            <Button
                                label={'Load More'}
                                icon={'chevrons-down'}
                                variant={'outline-primary'}
                                onClick={handleLoadMore}
                                loading={isPending}
                            />
                        </div>
                    )}
                </div>
            )}

            <NetworkDetailModal
                show={!!detailNetid}
                onHide={handleHideDetail}
                netid={detailNetid}
                data={detailData}
                loading={detailPending}
            />
        </PanelCard>
    );
};

export default SearchCard;
