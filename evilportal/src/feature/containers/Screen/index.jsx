/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Tab from 'react-bootstrap/Tab';

import PanelTabs from '@src/components/Tabs/PanelTabs';
import TabTitle from '@src/components/Tabs/TabTitle';
import ConditionalTabContent from '@src/components/Tabs/ConditionalTabContent';
import ControlCard from '@module/feature/components/ControlCard';
import PortalsCard from '@module/feature/components/PortalsCard';
import ClientsCard from '@module/feature/components/ClientsCard';
import LogsCard from '@module/feature/components/LogsCard';

const Screen = () => {
    return (
        <PanelTabs id={'evilportal'} defaultTab={'control'}>
            <Tab eventKey={'control'} title={<TabTitle title={'Control'} icon={'power'} />}>
                <ConditionalTabContent id={'evilportal'} eventKey={'control'}>
                    <ControlCard />
                </ConditionalTabContent>
            </Tab>
            <Tab eventKey={'portals'} title={<TabTitle title={'Portals'} icon={'layout'} />}>
                <ConditionalTabContent id={'evilportal'} eventKey={'portals'}>
                    <PortalsCard />
                </ConditionalTabContent>
            </Tab>
            <Tab eventKey={'clients'} title={<TabTitle title={'Clients'} icon={'users'} />}>
                <ConditionalTabContent id={'evilportal'} eventKey={'clients'}>
                    <ClientsCard />
                </ConditionalTabContent>
            </Tab>
            <Tab eventKey={'logs'} title={<TabTitle title={'Logs'} icon={'file-text'} />}>
                <ConditionalTabContent id={'evilportal'} eventKey={'logs'}>
                    <LogsCard />
                </ConditionalTabContent>
            </Tab>
        </PanelTabs>
    );
};

export default Screen;
