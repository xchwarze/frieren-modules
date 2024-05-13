/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Tab from 'react-bootstrap/Tab';

import DependenciesAlert from '@src/components/DependenciesAlert';
import PanelTabs from '@src/components/Tabs/PanelTabs';
import TabTitle from '@src/components/Tabs/TabTitle';
import ConditionalTabContent from '@src/components/Tabs/ConditionalTabContent';
import { USB_STORAGE_CHECK_MODULE_DEPENDENCIES } from '@module/feature/helpers/queryKeys.js';
import useCheckModuleDependencies from '@module/feature/hooks/useCheckModuleDependencies.js';
import ConfigCard from '@module/feature/components/ConfigCard';
import SetupCard from '@module/feature/components/SetupCard';

const Screen = () => {
    const statusQuery = useCheckModuleDependencies();
    const { hasDependencies, message, internalAvailable, SDAvailable } = statusQuery?.data ?? {};

    return (
        <>
            {typeof hasDependencies === 'boolean' && hasDependencies === false && (
                <DependenciesAlert
                    module={'usbstorage'}
                    dependenciesQueryKey={USB_STORAGE_CHECK_MODULE_DEPENDENCIES}
                    show={!hasDependencies}
                    message={message}
                    internalAvailable={internalAvailable}
                    SDAvailable={SDAvailable}
                />
            )}

            <PanelTabs id={'usbstorage'} defaultTab={'fstab'}>
                <Tab eventKey={'fstab'} title={<TabTitle title={'Configure'} icon={'file-text'} />}>
                    <ConditionalTabContent id={'usbstorage'} eventKey={'fstab'}>
                        <ConfigCard />
                    </ConditionalTabContent>
                </Tab>
                <Tab eventKey={'setup'} title={<TabTitle title={'Setup'} icon={'settings'} />}>
                    <ConditionalTabContent id={'usbstorage'} eventKey={'setup'}>
                        <SetupCard />
                    </ConditionalTabContent>
                </Tab>
            </PanelTabs>
        </>
    );
};

export default Screen;
