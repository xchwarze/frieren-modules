/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Tab from 'react-bootstrap/Tab';

import DependenciesAlert from '@src/components/DependenciesAlert';
import PanelTabs from '@src/components/Tabs/PanelTabs';
import TabTitle from '@src/components/Tabs/TabTitle';
import ConditionalTabContent from '@src/components/Tabs/ConditionalTabContent';
import { WIGLE_CHECK_MODULE_DEPENDENCIES } from '@module/feature/helpers/queryKeys.js';
import useCheckModuleDependencies from '@module/feature/hooks/useCheckModuleDependencies.js';
import SearchCard from '@module/feature/components/SearchCard';
import BluetoothCard from '@module/feature/components/BluetoothCard';
import CellCard from '@module/feature/components/CellCard';
import StatsCard from '@module/feature/components/StatsCard';
import SettingsCard from '@module/feature/components/SettingsCard';

const Screen = () => {
    const statusQuery = useCheckModuleDependencies();
    const { hasDependencies, message, internalAvailable, SDAvailable } = statusQuery?.data ?? {};

    return (
        <>
            {typeof hasDependencies === 'boolean' && hasDependencies === false && (
                <DependenciesAlert
                    module={'wigle'}
                    dependenciesQueryKey={WIGLE_CHECK_MODULE_DEPENDENCIES}
                    show={!hasDependencies}
                    message={message}
                    internalAvailable={internalAvailable}
                    SDAvailable={SDAvailable}
                />
            )}

            <PanelTabs id={'wigle'} defaultTab={'search'}>
                <Tab eventKey={'search'} title={<TabTitle title={'WiFi'} icon={'wifi'} />}>
                    <ConditionalTabContent id={'wigle'} eventKey={'search'}>
                        <SearchCard />
                    </ConditionalTabContent>
                </Tab>
                <Tab eventKey={'bluetooth'} title={<TabTitle title={'Bluetooth'} icon={'bluetooth'} />}>
                    <ConditionalTabContent id={'wigle'} eventKey={'bluetooth'}>
                        <BluetoothCard />
                    </ConditionalTabContent>
                </Tab>
                <Tab eventKey={'cell'} title={<TabTitle title={'Cell'} icon={'radio'} />}>
                    <ConditionalTabContent id={'wigle'} eventKey={'cell'}>
                        <CellCard />
                    </ConditionalTabContent>
                </Tab>
                <Tab eventKey={'stats'} title={<TabTitle title={'Stats'} icon={'bar-chart-2'} />}>
                    <ConditionalTabContent id={'wigle'} eventKey={'stats'}>
                        <StatsCard />
                    </ConditionalTabContent>
                </Tab>
                <Tab eventKey={'settings'} title={<TabTitle title={'Settings'} icon={'settings'} />}>
                    <ConditionalTabContent id={'wigle'} eventKey={'settings'}>
                        <SettingsCard />
                    </ConditionalTabContent>
                </Tab>
            </PanelTabs>
        </>
    );
};

export default Screen;
