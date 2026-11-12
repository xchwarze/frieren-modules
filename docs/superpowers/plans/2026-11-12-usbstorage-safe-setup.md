# Safe External Storage Setup Implementation Plan

> Tasks 1–4 are implemented. Execute only Task 5 in the existing feature checkout; do not restart earlier tasks.

**Goal:** Replace implicit first-device formatting with explicit, confirmed, guarded USB/SD setup and open a PR resolving issue #4.

**Architecture:** A shared POSIX shell library owns read-only inventory, canonical device identity, system-storage resolution, and authoritative safety validation. Both script entry points enforce it; PHP marshals the inventory and validates selection, while React renders the choices and destructive confirmation. Post-format configuration touches only the selected partitions.

**Tech Stack:** OpenWrt/BusyBox POSIX sh, PHP 8.2–8.4, React 18, React Bootstrap, Jotai, existing authenticated query/mutation hooks, Python standard-library shell-fixture tests, PHP CLI tests, and Vitest component tests.

**Spec:** `docs/superpowers/specs/2026-11-12-usbstorage-safe-setup-design.md`

## Current execution: user-directed OpenWrt simplification

The latest user request supersedes the earlier namespace-extension work: generic, simple OpenWrt host storage setup, without container/chroot coverage or model-specific handling. Earlier tasks are already implemented; do not restart them.

### Task 5: Remove namespace overengineering and deliver the existing feature

**Files:** `usbstorage/public/bin/storage-common.sh`, `storage-format.sh`, focused shell tests, README, and this design/plan's scope notes. PHP/UI contracts and other modules stay unchanged.

**Interfaces:** Preserve `storage_inventory`, `storage_validate_target DEVICE_ID IDENTITY CONFIRMATION`, `storage_mount_snapshot` and `ST_MOUNTS`, selected partition state, JSON shape, and the explicit three-argument scripts.

- [x] Add host-only behavioral coverage showing ordinary OpenWrt storage works without PID 2, process/thread traversal, namespace-root checks, or foreign-process mountinfo. Retain stale identity, eMMC/system, mount/swap/holders, lock, writer failures, and targeted-fstab tests.
- [x] Run that coverage before changing production code and record the expected failure of the overcomplicated implementation.
- [x] Replace namespace coverage with one validated current-host mountinfo read. Remove the process/thread/foreign-mount inspection code, its root-proof helpers, obsolete fixture machinery, and obsolete namespace-guarantee tests. Update activation to use the same simple fresh host snapshot.
- [x] Preserve working stock OpenWrt capabilities, USB/SD policy, UUID-capable swap writer, lock, selected partitions/configuration, and the 2 TiB DOS bound. Do not add another compatibility framework or virtual-storage feature.
- [x] Update README/spec/plan claims: host-only visibility, no protection claim for hidden container/chroot mounts, no complete-namespace guarantee. Old I1 is removed from scope, not falsely fixed.
- [x] Run the remaining complete shell suite, PHP/UI suites, syntax/bin ShellCheck, schema/YAML/version checks, and qualified headless build. Commit with DSR identity and no attribution.
- [ ] Obtain one scope-bounded review of the simplification and preservation of the core OpenWrt safety checks. Controller then pushes only the feature branch, opens the PR for #4, and checks hosted CI. No merge or release.

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
- Tests: `usbstorage/tests-shell/test_storage.py`, `usbstorage/tests-shell/test_formatting.py`, `usbstorage/tests-php/storage_test.php`, `usbstorage/tests-js/SetupCard.test.jsx`, and module-local Vitest configuration.
- Delivery: module README, consistent package/manifest version, lockfile, and a focused GitHub Actions workflow.

Inventory contract: `{devices: Device[], error: string|null}`. Each Device has `id`, `path`, `model`, `sizeBytes`, `transport` (`usb`, `sd`, `mmc`, `unknown`), `connection` (`removable`, `fixed`, `unknown`), `identity`, `eligible`, `reason` (`string|null`), `warnings` (`string[]`), `partitions`, `mounts`, and `swaps`. Partition entries include at least canonical `path` and size. An unresolved global safety state sets `error` and makes every device ineligible.

Selection request: `{deviceId, identity, confirmation}`. `deviceId` is an enumerated canonical whole-disk basename; `confirmation` must equal that device's canonical `/dev/...` path. Script arguments are exactly `<device-id> <identity> <confirmation-path>`. No arbitrary path or fallback destination is accepted.

Identity snapshot: boot ID, whole-disk major/minor, kernel disk sequence, and sector count. Use a strict, shell-safe representation. Require all fields and compare the fresh snapshot before destructive steps; client possession of an identity is never authorization to bypass eligibility.

## Completed implementation (Tasks 1–4)

- Task 1: Shared read-only sysfs/proc inventory, canonical identities, system backing resolution, USB/SD classification, and host mount/swap/holder/read-only refusals. Configured-loop ownership remains checked; hidden namespace/chroot mounts are outside scope, not technically fixed.
- Task 2: Both explicit-selection entry points share one lock and recheck identity/usage before writers. Verify selected partition topology, preflight the UUID-capable `swap-utils` writer, retain the 2 TiB DOS bound and stock numeric `ls`, preserve unrelated fstab, and activate only selected partitions using fresh host mount/loop evidence.
- Task 3: Authenticated inventory and strict setup selection/confirmation validation. PHP re-enumerates before launch; public JSON, API, progress behavior, and three-argument script contracts stay unchanged.
- Task 4: No-default device selection UI, exact-path confirmation, stale/pending/error handling, module-local fixture/PHP/UI tests, qualified headless build, and focused CI. Package/manifest versions remain `1.0.6`; physical OpenWrt and 32-bit verification remain outstanding.

## Plan Self-Review

- [x] Every spec section maps to a task, including manual entry points and selected-partition fstab updates.
- [x] API names, device identity fields, and selection payload are consistent across tasks.
- [x] The five review-focus cases have explicit tests in their owning tasks.
- [x] Tests exercise policy and execution boundaries with safe fixtures rather than source-text assertions or real disks.
- [x] Scope excludes other modules, framework changes, releases, and automatic PR merging.
