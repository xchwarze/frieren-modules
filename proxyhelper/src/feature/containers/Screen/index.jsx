/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Tab from 'react-bootstrap/Tab';

import PanelStack from '@common/components/PanelCard/PanelStack';
import PanelTabs from '@src/components/Tabs/PanelTabs';
import TabTitle from '@src/components/Tabs/TabTitle';
import ConditionalTabContent from '@src/components/Tabs/ConditionalTabContent';
import ProxyCard from '@module/feature/components/ProxyCard';
import PortsCard from '@module/feature/components/PortsCard';
import RulesCard from '@module/feature/components/RulesCard';
import BackupsCard from '@module/feature/components/BackupsCard';

const Screen = () => {
    return (
        <PanelTabs id={'proxyhelper'} defaultTab={'proxy'}>
            <Tab eventKey={'proxy'} title={<TabTitle title={'Proxy'} icon={'shuffle'} />}>
                <ConditionalTabContent id={'proxyhelper'} eventKey={'proxy'}>
                    <ProxyCard />
                </ConditionalTabContent>
            </Tab>
            <Tab eventKey={'routing'} title={<TabTitle title={'Routing'} icon={'list'} />}>
                <ConditionalTabContent id={'proxyhelper'} eventKey={'routing'}>
                    <PanelStack>
                        <PortsCard />
                        <RulesCard />
                    </PanelStack>
                </ConditionalTabContent>
            </Tab>
            <Tab eventKey={'backups'} title={<TabTitle title={'Backups'} icon={'save'} />}>
                <ConditionalTabContent id={'proxyhelper'} eventKey={'backups'}>
                    <BackupsCard />
                </ConditionalTabContent>
            </Tab>
        </PanelTabs>
    );
};

export default Screen;
