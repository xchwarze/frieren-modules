import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SetupCard from '@module/feature/components/SetupCard';

const disk = (overrides = {}) => ({
    id: 'sda', path: '/dev/sda', model: 'External SSD', sizeBytes: 8589934592,
    transport: 'usb', connection: 'removable', identity: 'v1:boot:8:0:12:16777216',
    eligible: true, reason: null, warnings: [],
    partitions: [{ path: '/dev/sda1', sizeBytes: 8588886016 }], mounts: [], swaps: [],
    ...overrides,
});
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

describe('selected-device setup', () => {
    let inventory, status, start, requests, client, user;

    beforeEach(() => {
        inventory = () => ({ devices: [disk()], error: null });
        status = () => ({ logContent: '', isRunning: false });
        start = () => ({ success: true });
        requests = [];
        user = userEvent.setup();
        client = new QueryClient({ defaultOptions: {
            queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
            mutations: { retry: false },
        } });
        // Only HTTP is doubled. Components, authenticated hooks, query state,
        // Jotai state, serialization and Bootstrap modals run normally.
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
            const body = JSON.parse(options.body);
            requests.push(body);
            const handler = {
                getStorageDevices: inventory,
                getAutoSetupStatus: status,
                startAutoSetup: start,
            }[body.action];
            if (!handler) throw new Error(`Unexpected action: ${body.action}`);
            const data = await handler(body);
            return {
                ok: !data.error,
                headers: { get: () => 'application/json' },
                json: async () => data,
            };
        }));
    });

    afterEach(() => client.clear());

    const mount = () => render(
        <QueryClientProvider client={client}><Provider><SetupCard /></Provider></QueryClientProvider>
    );
    const ready = async () => {
        await screen.findByRole('radio', { name: 'Select /dev/sda' });
        await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' }).disabled).toBe(false));
    };
    const review = async () => {
        await ready();
        await user.click(screen.getByRole('radio', { name: 'Select /dev/sda' }));
        await user.click(screen.getByRole('button', { name: 'Review erase' }));
        return screen.findByRole('dialog');
    };
    const confirm = async () => {
        await review();
        await user.type(screen.getByRole('textbox', { name: /type.*device path/i }), '/dev/sda');
        await user.click(screen.getByRole('button', { name: 'Erase device' }));
    };
    const starts = () => requests.filter(({ action }) => action === 'startAutoSetup');

    it.each([1, 2])('does not preselect with %i eligible devices', async (count) => {
        inventory = () => ({ error: null, devices: [disk(), ...(count === 2 ? [disk({
            id: 'mmcblk1', path: '/dev/mmcblk1', model: 'Removable SD', transport: 'sd',
            identity: 'v1:boot:179:8:2:16777216', partitions: [],
        })] : [])] });
        mount();
        await ready();
        expect(screen.getAllByRole('radio')).toHaveLength(count);
        expect(screen.getAllByRole('radio').every((radio) => !radio.checked)).toBe(true);
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
        expect(starts()).toEqual([]);
        expect(requests).toContainEqual({ module: 'usbstorage', action: 'getStorageDevices' });
    });

    it('shows protected MMC, usage, partitions and blocking reasons without allowing selection', async () => {
        inventory = () => ({ error: null, devices: [disk(), disk({
            id: 'mmcblk0', path: '/dev/mmcblk0', model: 'Internal eMMC', transport: 'mmc', connection: 'fixed',
            eligible: false, reason: 'Internal eMMC is not supported.',
            partitions: [{ path: '/dev/mmcblk0p1', sizeBytes: 1073741824 }],
            mounts: ['/rom'], swaps: ['/dev/mmcblk0p2'],
        })] });
        mount();
        await ready();
        expect(screen.getByRole('radio', { name: 'Select /dev/mmcblk0' }).disabled).toBe(true);
        for (const text of ['Internal eMMC is not supported.', '/dev/mmcblk0p1', '/rom', '/dev/mmcblk0p2']) {
            expect(screen.getByText(text, { exact: false })).toBeTruthy();
        }
        await user.click(screen.getByRole('radio', { name: 'Select /dev/mmcblk0' }));
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
    });

    it('shows unknown USB connection warning in both inventory and erase review', async () => {
        inventory = () => ({ error: null, devices: [disk({ connection: 'unknown',
            warnings: ['USB physical connection location is unknown.'],
        })] });
        mount();
        await ready();
        expect(screen.getByText('USB physical connection location is unknown.')).toBeTruthy();
        const modal = await review();
        expect(within(modal).getByText('USB physical connection location is unknown.')).toBeTruthy();
    });

    it('blocks action while inventory loads', async () => {
        const loading = deferred();
        inventory = () => loading.promise;
        mount();
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
        expect(screen.getByText(/loading storage devices/i)).toBeTruthy();
        expect(starts()).toEqual([]);
        await act(async () => loading.resolve({ devices: [], error: null }));
    });

    it('explains empty inventory', async () => {
        inventory = () => ({ devices: [], error: null });
        mount();
        expect(await screen.findByText(/no storage devices found/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
    });

    it('shows discovery failure and allows an explicit refresh', async () => {
        inventory = () => { throw new Error('Inventory unavailable'); };
        mount();
        expect(await screen.findByText(/Inventory unavailable/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
        inventory = () => ({ devices: [disk()], error: null });
        await user.click(screen.getByRole('button', { name: 'Refresh' }));
        await ready();
        expect(screen.getByRole('radio').checked).toBe(false);
    });

    it('blocks every device when inventory has a global safety error', async () => {
        // Inventory errors are valid response data, not necessarily HTTP errors.
        inventory = () => ({ devices: [disk()], error: 'System backing storage is unresolved.' });
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
            const body = JSON.parse(options.body);
            requests.push(body);
            const data = body.action === 'getStorageDevices' ? inventory() : status();
            return { ok: true, headers: { get: () => 'application/json' }, json: async () => data };
        }));
        mount();
        expect(await screen.findByText(/System backing storage is unresolved/)).toBeTruthy();
        expect(screen.getByRole('radio').disabled).toBe(true);
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
    });

    it.each(['/dev/sda', '/dev/sdb'])('names the erase dialog for the selected device %s', async (path) => {
        inventory = () => ({ error: null, devices: [disk(), disk({ id: 'sdb', path: '/dev/sdb',
            identity: 'v1:boot:8:16:44:16777216', partitions: [],
        })] });
        mount();
        await ready();
        await user.click(screen.getByRole('radio', { name: `Select ${path}` }));
        await user.click(screen.getByRole('button', { name: 'Review erase' }));
        expect(await screen.findByRole('dialog', { name: `Erase ${path}` })).toBeTruthy();
        expect(starts()).toEqual([]);
    });

    it('requires exact untrimmed path and sends only the selected identity and confirmation', async () => {
        mount();
        const modal = await review();
        expect(within(modal).getByText(/all partitions and all data.*irreversibly erased/i)).toBeTruthy();
        expect(within(modal).getByText(/1 GiB swap.*ext4.*\/sd/i)).toBeTruthy();
        expect(within(modal).getByText(/External SSD/)).toBeTruthy();
        expect(within(modal).getByText(/8 GiB/)).toBeTruthy();
        const input = within(modal).getByRole('textbox', { name: /type.*device path/i });
        const submit = within(modal).getByRole('button', { name: 'Erase device' });
        expect(submit.disabled).toBe(true);
        for (const invalid of ['/dev/sdb', ' /dev/sda', '/dev/sda ']) {
            await user.clear(input);
            await user.type(input, invalid);
            expect(submit.disabled).toBe(true);
        }
        expect(starts()).toEqual([]);
        await user.clear(input);
        await user.type(input, '/dev/sda');
        expect(submit.disabled).toBe(false);
        await user.click(submit);
        await waitFor(() => expect(starts()).toEqual([{
            module: 'usbstorage', action: 'startAutoSetup', deviceId: 'sda',
            identity: 'v1:boot:8:0:12:16777216', confirmation: '/dev/sda',
        }]));
    });

    it('sends the explicitly selected second device, never the first candidate', async () => {
        inventory = () => ({ error: null, devices: [disk(), disk({ id: 'sdb', path: '/dev/sdb',
            identity: 'v1:boot:8:16:44:16777216', partitions: [],
        })] });
        mount();
        await ready();
        await user.click(screen.getByRole('radio', { name: 'Select /dev/sdb' }));
        await user.click(screen.getByRole('button', { name: 'Review erase' }));
        await user.type(screen.getByRole('textbox', { name: /type.*device path/i }), '/dev/sdb');
        await user.click(screen.getByRole('button', { name: 'Erase device' }));
        await waitFor(() => expect(starts()).toEqual([{
            module: 'usbstorage', action: 'startAutoSetup', deviceId: 'sdb',
            identity: 'v1:boot:8:16:44:16777216', confirmation: '/dev/sdb',
        }]));
    });

    it('clears typed confirmation after cancel', async () => {
        mount();
        await review();
        await user.type(screen.getByRole('textbox', { name: /type.*device path/i }), '/dev/sda');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        await user.click(screen.getByRole('button', { name: 'Review erase' }));
        expect(screen.getByRole('textbox', { name: /type.*device path/i }).value).toBe('');
        expect(screen.getByRole('button', { name: 'Erase device' }).disabled).toBe(true);
    });

    it('rejects form submission without exact confirmation, not only button clicks', async () => {
        mount();
        const modal = await review();
        fireEvent.submit(modal.querySelector('form'));
        expect(starts()).toEqual([]);
    });

    it('prevents duplicate submission while the request is pending', async () => {
        const pending = deferred();
        start = () => pending.promise;
        mount();
        await review();
        await user.type(screen.getByRole('textbox', { name: /type.*device path/i }), '/dev/sda');
        await user.dblClick(screen.getByRole('button', { name: 'Erase device' }));
        expect(starts()).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Erase device' }).disabled).toBe(true);
        await act(async () => pending.resolve({ success: true }));
    });

    it('detects a job already running on page load and retains progress logs', async () => {
        status = () => ({ isRunning: true, logContent: 'Formatting selected device...' });
        mount();
        await ready();
        expect(await screen.findByDisplayValue('Formatting selected device...')).toBeTruthy();
        expect(screen.getByRole('radio').disabled).toBe(true);
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
        expect(screen.getByText(/setup is running/i)).toBeTruthy();
    });

    it('blocks setup until the initial task status is known', async () => {
        const checking = deferred();
        status = () => checking.promise;
        mount();
        await screen.findByRole('radio');
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
        expect(screen.getByText(/checking setup status/i)).toBeTruthy();
        await act(async () => checking.resolve({ isRunning: false, logContent: '' }));
    });

    it('blocks setup and shows status failures', async () => {
        status = () => { throw new Error('Status unavailable'); };
        mount();
        expect(await screen.findByText(/Status unavailable/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
    });

    it('blocks an already confirmed form while status is refreshing or unavailable', async () => {
        mount();
        const modal = await review();
        await user.type(screen.getByRole('textbox', { name: /type.*device path/i }), '/dev/sda');
        const checking = deferred();
        status = () => checking.promise;
        act(() => { void client.refetchQueries({ queryKey: ['usb-storage-get-auto-setup-status'] }); });
        await waitFor(() => expect(screen.getByRole('button', { name: 'Erase device' }).disabled).toBe(true));
        fireEvent.submit(modal.querySelector('form'));
        expect(starts()).toEqual([]);
        await act(async () => checking.reject(new Error('Status lost')));
        expect(screen.getByRole('button', { name: 'Erase device' }).disabled).toBe(true);
        fireEvent.submit(modal.querySelector('form'));
        expect(starts()).toEqual([]);
    });

    it('keeps setup disabled after acceptance while the server reports running', async () => {
        start = () => {
            status = () => ({ isRunning: true, logContent: 'Partitioning selected disk...' });
            return { success: true };
        };
        mount();
        await confirm();
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 2000 });
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
        expect(screen.getByRole('radio').disabled).toBe(true);
        expect(screen.getByDisplayValue('Partitioning selected disk...')).toBeTruthy();
        expect(starts()).toHaveLength(1);
    });

    it.each(['identity', 'eligibility', 'removed', 'global error'])('invalidates selection and confirmation after %s changes', async (change) => {
        mount();
        await review();
        await user.type(screen.getByRole('textbox', { name: /type.*device path/i }), '/dev/sda');
        inventory = () => ({
            devices: change === 'removed' ? [] : [disk(change === 'identity' ? { identity: 'new-generation' }
                : change === 'eligibility' ? { eligible: false, reason: 'Device is now mounted.' } : {})],
            error: change === 'global error' ? 'Cannot resolve system storage.' : null,
        });
        await act(async () => client.refetchQueries({ queryKey: ['usb-storage-get-storage-devices'] }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(screen.queryAllByRole('radio').every((radio) => !radio.checked)).toBe(true);
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
        expect(starts()).toEqual([]);
        inventory = () => ({ devices: [disk()], error: null });
        await user.click(screen.getByRole('button', { name: 'Refresh' }));
        await review();
        expect(screen.getByRole('textbox', { name: /type.*device path/i }).value).toBe('');
    });

    it('disables confirmation while a fresh inventory request is unresolved', async () => {
        mount();
        await review();
        await user.type(screen.getByRole('textbox', { name: /type.*device path/i }), '/dev/sda');
        const refreshing = deferred();
        inventory = () => refreshing.promise;
        act(() => { void client.refetchQueries({ queryKey: ['usb-storage-get-storage-devices'] }); });
        await waitFor(() => expect(screen.getByRole('button', { name: 'Erase device' }).disabled).toBe(true));
        expect(starts()).toEqual([]);
        await act(async () => refreshing.resolve({ devices: [disk()], error: null }));
    });

    it.each(['inventory fetch', 'status fetch', 'changed identity'])('rejects a submit racing with %s before React rerenders', async (change) => {
        mount();
        const modal = await review();
        await user.type(screen.getByRole('textbox', { name: /type.*device path/i }), '/dev/sda');
        const refreshing = deferred();
        await act(async () => {
            if (change === 'changed identity') {
                client.setQueryData(['usb-storage-get-storage-devices'], { devices: [disk({ identity: 'replacement' })], error: null });
            } else {
                const key = change === 'inventory fetch' ? 'usb-storage-get-storage-devices' : 'usb-storage-get-auto-setup-status';
                if (change === 'inventory fetch') inventory = () => refreshing.promise;
                else status = () => refreshing.promise;
                void client.refetchQueries({ queryKey: [key] });
            }
            fireEvent.submit(modal.querySelector('form'));
        });
        expect(starts()).toEqual([]);
        await act(async () => refreshing.resolve(change === 'inventory fetch'
            ? { devices: [disk()], error: null } : { isRunning: false, logContent: '' }));
    });

    it('shows backend rejection, clears selection and never retries another destination', async () => {
        start = () => ({ error: 'Selected device changed. Refresh inventory.' });
        mount();
        await confirm();
        expect(await screen.findByText(/Selected device changed. Refresh inventory./)).toBeTruthy();
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(screen.getByRole('radio').checked).toBe(false);
        expect(screen.getByRole('button', { name: 'Review erase' }).disabled).toBe(true);
        expect(starts()).toHaveLength(1);
    });

    it('refreshes inventory after running stops without inventing success or dropping logs', async () => {
        status = () => ({ isRunning: true, logContent: 'Formatting...' });
        mount();
        await ready();
        expect(await screen.findByDisplayValue('Formatting...')).toBeTruthy();
        const before = requests.filter(({ action }) => action === 'getStorageDevices').length;
        status = () => ({ isRunning: false, logContent: 'Failed: configuration could not be written.' });
        // Let the real hook's one-second poll detect completion, without a cache refetch double.
        await waitFor(() => expect(requests.filter(({ action }) => action === 'getStorageDevices').length).toBeGreaterThan(before), { timeout: 2500 });
        expect(screen.getByDisplayValue('Failed: configuration could not be written.')).toBeTruthy();
        expect(screen.getByText(/setup is not running.*review.*log/i)).toBeTruthy();
        expect(screen.queryByText(/setup successful|setup succeeded|successfully completed/i)).toBeNull();
        expect(screen.getByRole('radio').checked).toBe(false);
    });
});
