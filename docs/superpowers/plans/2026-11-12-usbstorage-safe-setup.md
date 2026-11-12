# Safe External Storage Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace implicit first-device formatting with explicit, confirmed, guarded USB/SD setup and open a PR resolving issue #4.

**Architecture:** A shared POSIX shell library owns read-only inventory, canonical device identity, system-storage resolution, and authoritative safety validation. Both script entry points enforce it; PHP marshals the inventory and validates selection, while React renders the choices and destructive confirmation. Post-format configuration touches only the selected partitions.

**Tech Stack:** OpenWrt/BusyBox POSIX sh, PHP 8.2–8.4, React 18, React Bootstrap, Jotai, existing authenticated query/mutation hooks, Python standard-library shell-fixture tests, PHP CLI tests, and Vitest component tests.

**Spec:** `docs/superpowers/specs/2026-11-12-usbstorage-safe-setup-design.md`

## Global Constraints

- Work in `fix/usbstorage-safe-setup` in the current checkout, as approved; never push changes to master directly.
- Permit positively identified USB unless fixed/internal, including unknown connection location with a warning; permit removable SD; block all eMMC with no override.
- Reject unresolved system storage, unstable disk identity, mounted/swap/held/read-only devices, conflicting `/sd`, and unsafe or missing client inputs.
- Never pick another destination automatically. Never force-unmount unrelated storage. Keep 1 GiB swap plus ext4 and `/sd`.
- Preserve existing comments unless the requested behavior change requires updating their content.
- Tests must never create real block nodes, attach loop devices, mount filesystems, or run real destructive commands. Do not add production test bypasses.
- Do not change other modules, framework APIs, or release artifacts. Do not merge or publish a release. No coauthor or AI-attribution trailers.

## Review Focus

1. A disconnected USB disk reappears under the same `/dev` name: stale identity must be rejected, including immediately before writes (Tasks 1–3).
2. A root/overlay/boot filesystem uses aliases, PARTUUID, loop, or mapper storage: resolve physical backing disks or reject every target, never guess (Task 1).
3. A USB SSD reports `removable=0`: accept USB transport unless positively fixed, while an MMC card is always blocked and an unknown connection is visibly warned (Tasks 1 and 4).
4. A different disk already owns `/sd` in mounts or fstab: reject before destruction and preserve its configuration (Task 2).
5. An old browser calls `startAutoSetup` without arguments, or a script is invoked manually: reject before any destructive command and leave progress/output truthful (Tasks 2–4).

## File Structure and Contracts

- `usbstorage/public/bin/storage-common.sh`: source-only discovery, topology, identity, JSON output, and safety functions.
- `usbstorage/public/bin/storage-devices.sh`: read-only inventory CLI; outputs one JSON object.
- `usbstorage/public/bin/storage-format.sh`: source-only formatting functions used after authoritative validation.
- Existing `auto-setup.sh`, `format-device.sh`, `post-format.sh`: explicit-selection entry points and targeted setup/configuration.
- `usbstorage/public/StorageDeviceHelper.php`: inventory decoding and request validation; controller integrates it without framework changes.
- UI: existing SetupCard, a focused device-list component and confirmation component, one inventory hook, and updated start/status hooks/query keys.
- Tests: `usbstorage/tests-shell/test_storage.py`, `usbstorage/tests-php/storage_test.php`, `usbstorage/tests-js/SetupCard.test.jsx`, and module-local Vitest configuration.
- Delivery: module README, consistent package/manifest version, lockfile, and a focused GitHub Actions workflow.

Inventory contract: `{devices: Device[], error: string|null}`. Each Device has `id`, `path`, `model`, `sizeBytes`, `transport` (`usb`, `sd`, `mmc`, `unknown`), `connection` (`removable`, `fixed`, `unknown`), `identity`, `eligible`, `reason` (`string|null`), `warnings` (`string[]`), `partitions`, `mounts`, and `swaps`. Partition entries include at least canonical `path` and size. An unresolved global safety state sets `error` and makes every device ineligible.

Selection request: `{deviceId, identity, confirmation}`. `deviceId` is an enumerated canonical whole-disk basename; `confirmation` must equal that device's canonical `/dev/...` path. Script arguments are exactly `<device-id> <identity> <confirmation-path>`. No arbitrary path or fallback destination is accepted.

Identity snapshot: boot ID, whole-disk major/minor, kernel disk sequence, and sector count. Use a strict, shell-safe representation. Require all fields and compare the fresh snapshot before destructive steps; client possession of an identity is never authorization to bypass eligibility.

### Task 1: Read-only inventory and shared safety policy

**Files:** Create `public/bin/storage-common.sh`, `public/bin/storage-devices.sh`, and `tests-shell/test_storage.py` under `usbstorage/`.

**Interfaces:** Produce `storage_inventory` (JSON stdout) and `storage_validate_target DEVICE_ID IDENTITY CONFIRMATION` (exit 0 only for a fresh eligible target; set validated canonical target variables). Read sysfs/proc through narrow shell helper functions that tests can replace after sourcing; installed entry points always use real paths and checks.

- [ ] Write fixture tests asserting: eMMC is blocked while USB is eligible; removable SD is eligible; internal/fixed USB is blocked; USB SSD `removable=0` with unknown connection is eligible with a warning; root and usage protections override transport eligibility.
- [ ] Add tests for PARTLABEL literal matching/duplicates, PARTUUID, `/dev/root` and symlink aliases, overlay/extroot/loop/mapper backing storage, known MTD/UBI roots, and unresolved backing storage. Assert the exact protected physical disk or a global blocking error.
- [ ] Add identity-reuse, active swap, mounted whole disks/partitions, holders, read-only, malformed metadata, and too-small-device cases. Assert changed identity and incomplete evidence are rejected.
- [ ] Run `python3 -m unittest discover -s usbstorage/tests-shell -p 'test_*.py' -v`; confirm failures are caused by missing implementation.
- [ ] Implement inventory and validation with canonical sysfs identities and `/proc/self/mountinfo` major/minor mapping. Use existing read-only OpenWrt tools where needed for partition metadata; no eval of device metadata. JSON-escape all display strings. Refuse ambiguity rather than claiming unsupported layouts are safe.
- [ ] Run the complete shell suite, `sh -n` on the new scripts, and ShellCheck. Confirm inventory never invokes write/unmount/swap commands using refusing command doubles.
- [ ] Commit the independently testable discovery layer without coauthor trailers.

### Task 2: Guarded formatting and selected-partition configuration

**Files:** Create `usbstorage/public/bin/storage-format.sh`; modify `auto-setup.sh`, `format-device.sh`, `post-format.sh`; extend `tests-shell/test_storage.py`.

**Interfaces:** Consume Task 1 validation. Both public entry points require all three selection arguments. Produce actual selected swap/data partition paths for post-format configuration. One atomic setup lock covers formatting and post-format work; direct formatting shares the same exclusion.

- [ ] Write failing tests proving both entry points reject missing/forged/stale/unsafe selections without invoking destructive stubs. Prove a device becoming mounted, swapped, held, replaced, or unavailable immediately before a write aborts without selecting a different disk.
- [ ] Add tests for overlapping operations, lock cleanup on failure, and insufficient capacity. Use fixtures and refusing command doubles only.
- [ ] Add targeted-fstab tests: configure only the selected UUIDs, preserve unrelated entries byte-for-byte where feasible, and reject an existing `/sd` owner before any partition-table write. Do not accept `block detect | uci import fstab` or positional mount/swap selection.
- [ ] Run the suite and confirm these tests fail for the existing unsafe behavior.
- [ ] Implement shared guarded formatting functions. Validate before each destructive stage, including after waits. Remove force-unmount/swapoff behavior, retain real failure propagation, and avoid success logs on failure. Serialize the complete setup transaction; do not expose a lock-bypass switch.
- [ ] Update the orchestrator to format only the supplied target and configure its actual partitions. Targeted configuration uses selected UUIDs and preserves unrelated fstab settings; clear configuration errors remain visible.
- [ ] Run all shell tests, syntax checks, and ShellCheck on every module shell script. Commit the guarded execution layer.

### Task 3: Authenticated inventory and explicit setup API

**Files:** Create `usbstorage/public/StorageDeviceHelper.php` and `usbstorage/tests-php/storage_test.php`; modify `public/UsbstorageController.php`.

**Interfaces:** `StorageDeviceHelper::getInventory($modulePath)` returns the inventory contract; `StorageDeviceHelper::prepareSetup($modulePath, array $request)` returns an escaped command or throws a descriptive validation exception. Add authenticated action `getStorageDevices`; `startAutoSetup` consumes the selection contract and preserves the existing background task name/status route.

- [ ] Write PHP tests for valid inventory, malformed/error output, unknown IDs, blocked devices, stale identity, mismatched confirmation, injection strings, wrong value types, and legacy requests without a destination. Assert no background operation is started for rejected requests.
- [ ] Run `php usbstorage/tests-php/storage_test.php`; confirm expected failures before implementation.
- [ ] Implement inventory execution through the existing OpenWrtHelper and decode/validate its shape. Re-enumerate before preparing a command; only discovered canonical identifiers and strict identity/confirmation values enter the background command. Never pass model strings or raw client paths to a shell.
- [ ] Wire controller actions to the helper, retain concurrency/progress behavior, and surface validation errors through existing response methods. Review nested shell quoting in BackgroundTaskHelper; constrain arguments rather than changing the global helper.
- [ ] Run the complete PHP and shell suites and PHP syntax checks. Commit the API layer.

### Task 4: Explicit selection UI, documentation, and PR verification

**Files:** Modify `usbstorage/src/feature/components/SetupCard/index.jsx`, `hooks/useStartAutoSetup.js`, `hooks/useGetAutoSetupStatus.js`, and `helpers/queryKeys.js`; create `hooks/useGetStorageDevices.js`, `components/SetupCard/StorageDeviceList.jsx`, `components/SetupCard/FormatConfirmationModal.jsx`, `tests-js/SetupCard.test.jsx`, `vitest.config.js`, and test setup as needed. Update `README.md`, `package.json`, `public/manifest.json`, `yarn.lock`, and create `.github/workflows/usbstorage-tests.yml`.

**Interfaces:** The inventory hook calls `getStorageDevices`; the start mutation sends exactly `{module: 'usbstorage', action: 'startAutoSetup', deviceId, identity, confirmation}`. The UI consumes the stable inventory contract from Task 1 and never supplies a fallback selection.

- [ ] Add the smallest test dependencies needed for React 18/Vitest/Testing Library; use the shared framework source through `VITE_COMMON_ALIAS`, deduplicating React so component tests do not load two React instances. Preserve existing peer dependency contracts.
- [ ] Write failing UI tests: multiple devices/no preselection, one device/no preselection, protected MMC rows and reasons, unknown USB warning, loading/empty/error states, required exact-path confirmation, correct request payload, pending/running duplicate protection, and stale/changed inventory invalidating selection and confirmation.
- [ ] Run the focused UI suite and confirm failures are due to the missing selection/confirmation workflow.
- [ ] Implement the list and confirmation flow using existing component patterns. The dangerous submit button remains disabled until the exact confirmation matches. Handle backend rejections clearly and refresh inventory after a completed operation; preserve progress logs.
- [ ] Update manual commands and safety documentation, including unknown USB location, missing kernel capabilities, no force override, and no physical-device verification claim. Set package and manifest to the same next version (`1.0.6`).
- [ ] Add focused CI with Ubuntu 24.04, PHP 8.2–8.4 syntax/tests, shell fixtures/static checks, and Node 22 UI tests/build. Check out the framework as a sibling only where required for existing shared-source aliases; do not build or publish release tarballs.
- [ ] Run the full shell, PHP, and UI suites; build the module with `VITE_COMMON_ALIAS=../../frieren/frieren-front/src corepack yarn build`; validate manifest/schema and YAML. Review the entire branch against the spec and address safety findings before opening the PR.
- [ ] Commit, push only the feature branch, and open a PR to master referencing issue #4. Include verification commands, outcomes, and the outstanding physical OpenWrt checks. Do not merge it or add coauthor trailers.

## Plan Self-Review

- [x] Every spec section maps to a task, including manual entry points and selected-partition fstab updates.
- [x] API names, device identity fields, and selection payload are consistent across tasks.
- [x] The five review-focus cases have explicit tests in their owning tasks.
- [x] Tests exercise policy and execution boundaries with safe fixtures rather than source-text assertions or real disks.
- [x] Scope excludes other modules, framework changes, releases, and automatic PR merging.
