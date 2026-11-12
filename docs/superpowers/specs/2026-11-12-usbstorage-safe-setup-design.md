# Safe external storage setup

## Intent

Resolve xchwarze/frieren-modules#4 without retaining automatic formatting of the first matching device. Separate read-only discovery, explicit user selection, and guarded formatting. The same safety policy must protect the web workflow and direct script use.

## User-directed simplification

The user's latest instruction is to keep this generic and simple for OpenWrt, without overengineering. This section replaces the earlier process-wide namespace-coverage requirements and related review rulings.

- Target normal storage administration on the OpenWrt host. Do not build a general Linux container/chroot/namespace inspection system, enumerate processes or threads, prove namespace-root reachability, or add router-model exceptions.
- Use the host's current `/proc/self/mountinfo`, `/proc/swaps`, sysfs, and UCI configuration. Retain system-disk/eMMC protection, mounted/swap/held/read-only refusals, explicit selection/confirmation, identity rechecks, one operation lock, and selected-only fstab updates.
- Mounts hidden in other namespaces or chroots are outside this simpler contract. Document that limitation plainly; do not describe the old I1 issue as technically fixed or claim complete process-wide visibility. Run setup on the router host, not in a container or jail.
- Retain the existing working root/partition/USB policy where needed for ordinary OpenWrt. Do not expand virtual-storage or filesystem support. Keep unsupported or unresolved system backing fail-closed.
- Keep the UI/API and safe test contracts unchanged. Remove only tests and fixture machinery belonging to the explicitly dropped namespace feature; preserve the actual device-selection and destructive-boundary safety coverage.
- Make one focused simplification and one bounded review. Do not restart the completed implementation tasks or repeat a general-purpose Linux audit.

## Approved product decisions

- Allow positively identified USB storage unless the kernel marks its connection as fixed/internal, and allow positively identified removable SD cards. USB devices with unknown physical connection location remain eligible only after all other safety checks and explicit user confirmation; expose that uncertainty in the UI.
- Reject all internal eMMC, including eMMC that does not contain the running system. Do not provide a force override.
- Never select a device automatically, even when only one eligible device exists.
- Require explicit confirmation that every partition and all data on the selected device will be erased.
- Keep the existing 1 GiB swap plus ext4 layout, `/sd` mount point, and background progress display.
- Create a PR against `xchwarze/frieren-modules:master`; do not merge it or publish a release automatically. Do not add AI attribution or coauthor trailers.

## Approaches

1. Add root and mount exclusions to the current priority loop. This is a smaller patch, but preserves implicit selection and does not satisfy the requested user flow.
2. Share a read-only storage discovery and validation layer between the API and formatter. The UI explicitly selects and confirms one device. This is the selected approach.
3. Validate only in PHP or the browser. This leaves direct script execution unsafe and is rejected.

The user approved this design, including separating discovery from formatting, blocking all eMMC, and allowing USB connections of unknown physical location with an explicit warning. Implementation details below remain builder-owned engineering decisions within that approved policy.

## Scope and non-goals

Change the `usbstorage` module, its documentation, focused tests, and any module-specific test configuration needed to run those tests. Do not change the framework API, other modules, or the release repository.

This is not an internal-disk formatter, an extroot installer, a filesystem repair tool, or a multi-volume mount manager. Multiple devices can be listed, but a setup operation configures exactly one device at `/sd`.

## Discovery and safety policy

Provide a read-only discovery entry point backed by reusable POSIX shell functions. PHP consumes its structured output; formatting scripts invoke the same policy directly. This avoids depending on PHP CLI or on new OpenWrt tools solely for inventory.

Inventory whole disks from sysfs rather than a hardcoded `/dev` priority list. Report protected and unsupported devices as well as eligible devices, so the user can understand why a disk is unavailable. Do not treat `/dev/mmcblk*` as an external-storage classification: distinguish SD from MMC using device attributes. Identify USB ancestry positively rather than assuming every `/dev/sd*` disk is USB.

Do not equate a block disk's `removable=0` with a fixed/internal USB connection: many external USB SSDs report non-removable media. Reject positive fixed/hardwired USB-connection information. If USB transport is established but physical connection location is unknown, show an explicit warning and still require user selection and erasure confirmation. This is not proof that every such USB device is physically external; it is a documented usability tradeoff. Unknown system backing storage, disk identity, or transport is never accepted.

Each inventory result includes a canonical identifier, display path, model, capacity, transport, partition/mount/swap information, eligibility, and a human-readable blocking reason. It also includes an identity snapshot that distinguishes a removed device from a new disk reusing its path. Use kernel disk generation information where available; refuse formatting if identity cannot be established reliably.

Resolve aliases and compare block-device identities, not only path strings. Protect all resolved system backing disks, including boot, `/rom`, `/overlay`, extroot, and relevant device-mapper or loop backing devices. Support root references by device path, PARTUUID, and PARTLABEL with literal matching. A positively identified MTD/UBI-based system is distinct from an unresolved block root. If the system backing storage cannot be established safely, return a blocking error rather than offering a formatting target.

Reject a candidate when it is internal MMC, unsupported or ambiguous, read-only, mounted, used by active swap, held by another block device, or backing the system. A disk that is unmounted but already contains partitions is not empty: show that fact and require the same destructive confirmation.

Discovery never unmounts filesystems, changes swap, writes partition tables, updates fstab, or invokes formatting commands.

## API and execution

Add an authenticated inventory action to `UsbstorageController`. Extend `startAutoSetup` to require the selected device identifier, its discovery identity snapshot, and explicit erase confirmation. Missing arguments from old clients must return an error, not retain legacy automatic selection.

Treat all client-supplied values as untrusted. Re-enumerate and validate the selection server-side. Restrict identifiers to discovered whole disks and escape all shell arguments. Pass the explicit selection and identity to the background operation.

Retain `auto-setup.sh` only as a selected-device setup orchestrator. Without an explicit destination and confirmation it exits without changing anything. It must not fall back to another device when a selection is missing, disappears, changes identity, or becomes unsafe.

Enforce the same policy inside `format-device.sh`, including direct manual invocation. Validate identity and usage again immediately before destructive operations, including after waits. Refuse busy devices instead of force-unmounting them. Use an atomic operation lock with reliable cleanup to prevent overlapping setup operations. Do not claim that a userspace check alone makes arbitrary external hotplug or mounting races atomic; keep the destructive boundary narrow and abort on detected changes.

Preserve meaningful exit codes and failure output. Never report success after validation, partitioning, formatting, or configuration failed. There is no rollback promise for an already formatted disk.

## Post-format configuration

Pass the exact newly created swap and data partitions into post-format configuration. Resolve their UUIDs and update only their fstab entries. Do not regenerate the entire fstab or select `fstab.@mount[0]` / `fstab.@swap[0]` by position.

Preserve unrelated configuration. Refuse a conflicting `/sd` mount or configuration before destruction rather than unmounting or silently replacing another volume. Guard targeted configuration writes and make errors visible. Keep the existing hotplug installation and storage-path setup behavior where safe.

## User interface

Replace the single automatic setup button with discovery, selection, and confirmation states. Reuse existing React Bootstrap and framework component patterns; no redesign of unrelated module screens.

- Display model, size, path, transport, existing partitions, usage, and eligibility for each disk.
- Keep protected disks visible but unselectable, with a clear reason such as system disk, internal eMMC, active swap, mounted, or unknown identity.
- Do not preselect a disk. Disable formatting until an eligible selection exists.
- Offer an explicit refresh action and invalidate selection and confirmation when the inventory identity changes.
- Before starting, show the exact disk, model, capacity, partition layout to be created, and irreversible data-loss warning.
- Require the user to type the displayed canonical device path to confirm erasure. The backend also rejects missing or mismatched confirmation.
- Prevent duplicate submissions while a task is pending or running. Keep progress logs and refresh inventory after completion.
- Handle loading, empty inventory, discovery failures, stale selections, and rejected setup without hiding the reason or starting a different operation.

## Verification

The initial functional target is the project's documented OpenWrt 24.x environment, including the GL-MT6000 eMMC-root scenario and ordinary USB/removable-SD storage on MTD/UBI-based routers. Inventory and validation must use capability checks instead of silently assuming every OpenWrt release exposes the same sysfs data. Formatting requires reliable disk-generation information and a resolvable system-storage topology. Older or unusual kernels missing that evidence receive a clear unsupported/refusal reason, not a compatibility bypass. Fixture coverage must demonstrate eligible USB/SD devices in both eMMC-root and known MTD/UBI-root systems, so rejecting every device is not considered a working implementation. Validate PHP compatibility with the framework's PHP 8.2–8.4 range where practical.

Create focused automated coverage before implementation. Use synthetic sysfs/proc fixtures and refusing command doubles; tests must not create real block nodes, attach loop devices, mount filesystems, or execute real destructive commands.

Cover at least:

- Internal eMMC plus external USB, and a removable SD card whose name also starts with `mmcblk`.
- USB SSD media reporting `removable=0`, a positively fixed USB connection, and an unknown USB connection location with the required warning.
- Multiple eligible devices with no implicit selection; no eligible devices and inventory errors.
- Root identified by PARTLABEL, PARTUUID, aliases, `/dev/root`, overlay/extroot, and a known MTD/UBI root.
- Unresolvable system storage, duplicate labels, and labels containing regex metacharacters.
- Mounted partitions, active swap, block holders, read-only disks, and `/sd` conflicts.
- Device identity changes between discovery, request handling, and the destructive boundary.
- Missing, malformed, or forged selection and confirmation arguments; legacy requests without a destination.
- Both script entry points rejecting unsafe targets before any destructive command.
- Targeted fstab changes preserving unrelated mounts and swap entries.
- UI selection, blocked candidates, confirmation, errors, stale inventory, and duplicate submissions.

Run shell syntax/static checks, focused backend and UI tests, and the module production build. Document commands and outcomes in the PR. Physical OpenWrt verification remains outstanding unless a real device is explicitly supplied; do not imply simulated fixtures prove physical device behavior.

## Documentation and delivery

Update the module README and manual script instructions. Remove the claim that the first existing `mmcblk0` is necessarily external storage. Document external-only support, refusal conditions, explicit selection, and the irreversible nature of formatting.

Keep package and manifest versions consistent when preparing the module change. Include the design, implementation plan, tests, and limitations in the feature branch. The PR should reference issue #4 and explain how discovery, authoritative validation, and UI confirmation address it.

## Builder-owned decisions

The builder chooses helper names, exact structured inventory encoding, identity-token representation, and the smallest practical test tools consistent with this policy and existing module conventions. Do not add production safety bypasses to make tests easier. Escalate any inability to identify backing storage or device generations on supported OpenWrt versions rather than weakening the fail-closed policy silently.

## Retained OpenWrt capability requirements

- Validate one fresh host `/proc/self/mountinfo` snapshot for inventory and each destructive/activation recheck. Preserve that snapshot for swapfile backing resolution. Hidden namespace/chroot mounts remain outside scope; the old I1/R1 concern is not claimed fixed.
- Reverse-resolve all configured loops independently of mount/swap reachability and sysfs holders. Repeat loop ownership checks at destructive and activation boundaries.
- Keep canonical rdev checks with stock read-only numeric `ls -dnL`; do not add an inventory-only dependency. Refuse unsupported UCI target encodings without evaluating them.
- Declare formatter dependency `swap-utils` and explicitly invoke its OpenWrt 24.10 `/usr/sbin/mkswap`. Verify UUID capability before partition-table destruction, including the libuuid parser rather than help text alone. Keep nonzero, distinct, uniquely owned selected UUIDs mandatory.
- Use location evidence from the storage USB attachment, not an intermediate hub's own fixed attachment. Keep fixed storage refused and unknown-location warnings unchanged.
- Retain DOS partitioning and refuse capacities above 2 TiB before every writer. This conservative byte bound also refuses larger valid 4Kn media; GPT remains out of scope.
