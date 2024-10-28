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
 * Modifications: Modified functions to read Nmap logs.
 */

import { useEffect, useRef } from 'react';
import Form from 'react-bootstrap/Form';

import PanelCard from '@src/components/PanelCard';
import useGetLog from '@module/feature/hooks/getLog.js';

const LogOutput = () => {
    const query = useGetLog();
    const logRef = useRef(null);

    // Scroll to bottom when log is updated
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [query.data]);

    let logContent = 'No log available';
    
    if (query.data?.logContent) {
            logContent = query.data.logContent;
    }

    return (
        <PanelCard 
                title="Nmap Scan Log"
                query={query}
        >
            <Form.Group>
                <Form.Label>Log Output</Form.Label>
                <Form.Control
                    as="textarea"
                    rows={10}
                    readOnly
                    value={query.isLoading ? 'Loading log...' : query.isError ? 'Error loading log' : logContent}
                    ref={logRef}
                    style={{ whiteSpace: 'pre-wrap', overflowY: 'auto' }}
                />
            </Form.Group>
        </PanelCard>
    );
};

export default LogOutput;
