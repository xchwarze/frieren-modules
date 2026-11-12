#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2026 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later

# Source after storage-common.sh. No operation or lock is inherited from callers.
SF_LOCK=; SF_CONFIG_TEMP=
storage_lock_path() { printf '%s\n' /var/lock/usbstorage-setup.lock; }
storage_fstab_path() { printf '%s\n' /etc/config/fstab; }
storage_swap_writer() { /usr/sbin/mkswap "$@"; }
storage_format_error() { printf '[!] %s\n' "$*" >&2; return 1; }

storage_swap_preflight() (
    # OpenWrt swap-utils installs this util-linux writer in /usr/sbin, unlike
    # the stock UUID-less BusyBox applet in /sbin. These queries open no device.
    if ! { version=$(LC_ALL=C storage_swap_writer --version) &&
        help=$(LC_ALL=C storage_swap_writer --help); }; then
            storage_format_error 'UUID-capable /usr/sbin/mkswap is unavailable; install swap-utils.'; return 1;
    fi
    if ! { printf '%s\n' "$version" | LC_ALL=C awk '
        /^mkswap from util-linux [0-9][0-9.]*$/ {ok=1} END {exit !(ok && NR==1)}' &&
        printf '%s\n' "$help" | grep -E '^[[:space:]]*-U, --uuid[[:space:]]+UUID[[:space:]]' >/dev/null; }; then
            storage_format_error 'UUID-capable util-linux mkswap is required before partitioning; install swap-utils.'; return 1;
    fi
    # util-linux can advertise -U even when built without libuuid. With no
    # device operand, an invalid UUID must fail in UUID parsing before any open.
    # The no-libuuid build instead warns that it ignores -U; never accept that.
    if diagnostic=$(LC_ALL=C storage_swap_writer --uuid invalid 2>&1); then
        storage_format_error 'Swap writer did not reject an invalid UUID.'; return 1
    fi
    [ "$diagnostic" = 'mkswap: error: parsing UUID failed' ] || {
        storage_format_error 'Swap writer UUID support cannot be verified before partitioning.'; return 1;
    }
)

storage_unlock() {
    [ -z "$SF_CONFIG_TEMP" ] || rm -f "$SF_CONFIG_TEMP"
    if [ -n "$SF_LOCK" ]; then
        rm -f "$SF_LOCK/fstab.before"
        rmdir "$SF_LOCK" || printf '%s\n' '[!] Could not remove setup lock.' >&2
    fi
}
storage_lock() {
    sf_lock_path=$(storage_lock_path) || return 1
    umask 077
    if ! mkdir "$sf_lock_path" 2>/dev/null; then
        storage_format_error 'Setup lock is held or unavailable; no operation started.'
        return 1
    fi
    SF_LOCK=$sf_lock_path
    trap 'storage_unlock' 0
    trap 'exit 129' HUP
    trap 'exit 130' INT
    trap 'exit 143' TERM
}

# Partition numbers come from the kernel, not a guessed suffix or fdisk row order.
# Capture rdev, number, start and size so later writes reject replaced partitions.
storage_partition_snapshot() (
    node=$(storage_node_path "$1") || exit 1
    [ "$1" = "/dev/$node" ] && [ "$(storage_parent "$node")" = "$2" ] || exit 1
    number=$(storage_read_file "/sys/class/block/$node/partition") || exit 1
    start=$(storage_read_file "/sys/class/block/$node/start") || exit 1
    size=$(storage_read_file "/sys/class/block/$node/size") || exit 1
    mm=$(storage_block_mm "$1") || exit 1
    storage_uint "$number" && storage_uint "$start" && storage_uint "$size" &&
        [ "$number" -gt 0 ] && [ "$start" -gt 0 ] && [ "$size" -gt 0 ] || exit 1
    [ "$(storage_read_file "/sys/class/block/$node/ro")" = 0 ] || exit 1
    holders=$(storage_list_dir "/sys/class/block/$node/holders") || exit 1
    [ -z "$holders" ] || exit 1
    printf '%s:%s:%s:%s\n' "$mm" "$number" "$start" "$size"
)
storage_find_partitions() {
    STORAGE_SWAP_PART=; STORAGE_DATA_PART=
    while IFS= read -r sf_node; do
        [ -n "$sf_node" ] || continue
        storage_path_exists "/sys/class/block/$sf_node/partition" || continue
        [ "$(storage_parent "$sf_node")" = "$1" ] || continue
        sf_number=$(storage_read_file "/sys/class/block/$sf_node/partition") || return 1
        case "$sf_number" in
            1) [ -z "$STORAGE_SWAP_PART" ] || return 1; STORAGE_SWAP_PART=/dev/$sf_node;;
            2) [ -z "$STORAGE_DATA_PART" ] || return 1; STORAGE_DATA_PART=/dev/$sf_node;;
            *) return 1;;
        esac
    done <<EOF
$ST_NODES
EOF
    [ -n "$STORAGE_SWAP_PART" ] && [ -n "$STORAGE_DATA_PART" ] || return 1
    sf_swap_snapshot=$(storage_partition_snapshot "$STORAGE_SWAP_PART" "$1") || return 1
    sf_data_snapshot=$(storage_partition_snapshot "$STORAGE_DATA_PART" "$1") || return 1
    sf_swap_start=$(storage_read_file "/sys/class/block/${STORAGE_SWAP_PART##*/}/start") || return 1
    sf_swap_size=$(storage_read_file "/sys/class/block/${STORAGE_SWAP_PART##*/}/size") || return 1
    sf_data_start=$(storage_read_file "/sys/class/block/${STORAGE_DATA_PART##*/}/start") || return 1
    sf_data_size=$(storage_read_file "/sys/class/block/${STORAGE_DATA_PART##*/}/size") || return 1
    sf_capacity=${2##*:}
    [ "$sf_swap_size" -eq 2097152 ] && [ "$sf_swap_start" -ge 2048 ] &&
        [ "$sf_data_size" -ge 32768 ] &&
        [ "$sf_data_start" -ge "$((sf_swap_start + sf_swap_size))" ] &&
        [ "$((sf_data_start + sf_data_size))" -le "$sf_capacity" ]
}
storage_same_partitions() (
    # Re-enumerate the entire child set without replacing the captured trust.
    ST_NODES=$(storage_list_dir /sys/class/block) || return 1
    sf_disk_holders=$(storage_list_dir "/sys/class/block/$1/holders") || return 1
    if [ -n "$sf_disk_holders" ] || [ "$(storage_read_file "/sys/class/block/$1/ro")" != 0 ]; then
        storage_format_error 'Selected disk became held or read-only.'; return 1
    fi
    if ! { [ "$(storage_identity "$1")" = "$2" ] &&
        storage_find_partitions "$1" "$2" &&
        [ "$STORAGE_SWAP_PART" = "$SF_SWAP" ] && [ "$STORAGE_DATA_PART" = "$SF_DATA" ] &&
        [ "$sf_swap_snapshot" = "$SF_SWAP_SNAPSHOT" ] && [ "$sf_data_snapshot" = "$SF_DATA_SNAPSHOT" ]; }; then
        storage_format_error 'Selected disk or partition topology/identity changed.'; return 1;
    fi
)
storage_guard_partitions() {
    storage_validate_target "$@" && storage_same_partitions "$1" "$2"
}
storage_capture_partitions() {
    storage_find_partitions "$1" "$2" || {
        storage_format_error 'Cannot verify the selected 1 GiB swap and ext4 partition layout.'; return 1;
    }
    SF_SWAP=$STORAGE_SWAP_PART; SF_DATA=$STORAGE_DATA_PART
    SF_SWAP_SNAPSHOT=$sf_swap_snapshot; SF_DATA_SNAPSHOT=$sf_data_snapshot
}

# Format the device into a 1G swap partition + an ext4 data partition.
# Busy devices are refused, never unmounted or swap-disabled.
storage_format_selected() {
    storage_swap_preflight || return 1
    echo '[+] Writing partition table (1G swap + ext4)...'
    storage_validate_target "$@" || return 1
    # printf (not "echo -e") feeds the interactive fdisk prompts: it expands \n
    # reliably under busybox ash, where echo's -e handling is not guaranteed.
    # fdisk steps: o(new table) n p 1 <def> +1G  t 82(swap)  n p 2 <def> <def>  w
    if ! printf 'o\nn\np\n1\n\n+1G\nt\n82\nn\np\n2\n\n\nw\n' | fdisk "$STORAGE_TARGET_PATH"; then
        storage_format_error 'fdisk failed; the disk may already be partially changed.'; return 1
    fi
    sync || return 1
    sleep 2 || return 1

    # The kernel/hotplug re-creates partition nodes asynchronously. Bound the wait;
    # revalidate after every wait, including before either filesystem writer.
    sf_tries=0
    while :; do
        storage_validate_target "$@" || return 1
        if storage_find_partitions "$1" "$2"; then break; fi
        [ "$sf_tries" -lt 10 ] || {
            storage_format_error 'Partition device nodes/layout did not become ready.'; return 1;
        }
        sleep 1 || return 1
        sf_tries=$((sf_tries + 1))
    done
    storage_capture_partitions "$1" "$2" || return 1
    echo '[+] Formatting partitions...'
    storage_guard_partitions "$@" || return 1
    storage_swap_writer "$SF_SWAP" || { storage_format_error 'mkswap failed.'; return 1; }
    storage_guard_partitions "$@" || return 1
    mkfs.ext4 -F "$SF_DATA" || { storage_format_error 'mkfs.ext4 failed.'; return 1; }
    sync || return 1
    storage_guard_partitions "$@" || return 1
    printf '[+] Formatted swap %s and ext4 %s.\n' "$SF_SWAP" "$SF_DATA"
}

storage_filesystem_uuid() (
    # OpenWrt block info is already required by this module. Request only this
    # path's output; block refreshes its read-only probe cache internally.
    info=$(block info "$1") || exit 1
    printf '%s\n' "$info" | LC_ALL=C awk -v path="$1:" -v type="$2" '
        NR!=1 || $1!=path {bad=1}
        {for(i=2;i<=NF;i++) {
            if($i~/^UUID=/) {uuid=$i;uc++}
            if($i~/^TYPE=/) {kind=$i;tc++}
        }}
        END {
            if(bad || NR!=1 || uc!=1 || tc!=1 || kind!="TYPE=\"" type "\"")exit 1
            if(uuid!~/^UUID="[0-9a-fA-F-]+"$/)exit 1
            sub(/^UUID="/,"",uuid);sub(/"$/,"",uuid);n=split(uuid,a,"-")
            if(n!=5 || length(a[1])!=8 || length(a[2])!=4 || length(a[3])!=4 || length(a[4])!=4 || length(a[5])!=12)exit 1
            if(uuid=="00000000-0000-0000-0000-000000000000")exit 1
            print tolower(uuid)
        }'
)

# Once setup owns the fstab destination, it cannot reuse the eligibility API:
# that API correctly refuses even our own /sd entry. Activation never formats.
# Recheck identities, holders, read-only state and live usage before activation.
storage_activation_guard() {
    storage_same_partitions "$1" "$2" || return 1
    if storage_path_exists /sd || storage_is_symlink /sd; then
        if ! { [ "$(storage_realpath /sd)" = /sd ] && storage_list_dir /sd >/dev/null; }; then
            storage_format_error 'The /sd destination changed.'; return 1;
        fi
    fi
    storage_mount_snapshot || {
        storage_format_error 'Cannot establish complete process mount-namespace visibility.'; return 1;
    }
    ST_USAGE=
    if ! { storage_collect_foreign_usage && storage_collect_loop_usage; }; then
        storage_format_error 'Cannot resolve live foreign mounts or loop ownership.'; return 1;
    fi
    if printf '%s\n' "$ST_USAGE" | awk -v id="$1" '$1==id {busy=1} END {exit !busy}'; then
        storage_format_error 'Selected device acquired foreign mount or loop usage.'; return 1
    fi
    sf_disk_mm=$(storage_block_mm "/dev/$1") || return 1
    sf_swap_mm=$(storage_block_mm "$SF_SWAP") || return 1
    sf_data_mm=$(storage_block_mm "$SF_DATA") || return 1
    # Swapfile backing must use this validated snapshot, including our new /sd mount.
    # storage_backing_path in storage-common.sh consumes this caller-owned context.
    # shellcheck disable=SC2034
    printf '%s\n' "$ST_MOUNTS" | awk -v disk="$sf_disk_mm" -v swap="$sf_swap_mm" -v data="$sf_data_mm" -v mounted="$3" '
        $2=="/sd" && $1==data && mounted==1 && $3=="ext4" {owned++;next}
        $2=="/sd" || index($2,"/sd/")==1 || $1==disk || $1==swap || $1==data {bad=1}
        END {exit (bad || owned!=mounted)}' || {
        storage_format_error 'Selected device or /sd mount usage changed.'; return 1;
    }
    sf_live_swaps=$(storage_read_file /proc/swaps) || return 1
    sf_swap_paths=$(printf '%s\n' "$sf_live_swaps" | awk '
        NR==1 {if($1!="Filename" || $2!="Type" || NF!=5)exit 1;next}
        NF!=5 || ($2!="partition" && $2!="file") {exit 1}
        {print $1}') || return 1
    sf_owned_swap=0
    while IFS= read -r sf_active_swap; do
        [ -n "$sf_active_swap" ] || continue
        sf_backing=$(storage_backing_path "$(storage_unescape "$sf_active_swap")" 0) || return 1
        if storage_contains "$sf_backing" "$1"; then
            if [ "${4:-0}" -eq 1 ] && [ "$sf_active_swap" = "$SF_SWAP" ]; then
                sf_owned_swap=$((sf_owned_swap + 1))
            else
                storage_format_error 'Selected device acquired active swap.'; return 1
            fi
        fi
    done <<EOF
$sf_swap_paths
EOF
    [ "$sf_owned_swap" -eq "${4:-0}" ]
}

storage_configure_selected() {
    storage_guard_partitions "$1" "$2" "$3" || return 1
    if [ "$4" != "$SF_SWAP" ] || [ "$5" != "$SF_DATA" ]; then
        storage_format_error 'Post-format partition paths do not match the selected disk.'; return 1;
    fi
    if ! { sf_swap_uuid=$(storage_filesystem_uuid "$SF_SWAP" swap) &&
        sf_data_uuid=$(storage_filesystem_uuid "$SF_DATA" ext4) &&
        [ "$sf_swap_uuid" != "$sf_data_uuid" ]; }; then
        storage_format_error 'Cannot resolve distinct selected swap/ext4 UUIDs.'; return 1;
    fi
    sf_fstab=$(storage_fstab_path) || return 1
    # Appending two new UUID-owned sections preserves all unrelated bytes, including
    # comments. A pre-existing UUID/section owner is ambiguous, not ours to replace.
    sf_existing=$(storage_read_fstab) || return 1
    sf_swap_section=usbstorage_swap_$(printf '%s' "$sf_swap_uuid" | tr -d '-')
    sf_data_section=usbstorage_data_$(printf '%s' "$sf_data_uuid" | tr -d '-')
    if printf '%s\n' "$sf_existing" | grep -Fi -e "$sf_swap_uuid" -e "$sf_data_uuid" -e "fstab.$sf_swap_section=" -e "fstab.$sf_data_section=" >/dev/null; then
        storage_format_error 'Selected UUID or section already has an fstab owner; refusing to replace it.'; return 1
    fi
    if [ ! -f "$sf_fstab" ] || [ -L "$sf_fstab" ]; then
        storage_format_error 'fstab must exist as a regular configuration file.'; return 1;
    fi
    cp -p "$sf_fstab" "$SF_LOCK/fstab.before" || return 1
    SF_CONFIG_TEMP=$(mktemp "${sf_fstab%/*}/.usbstorage-fstab.XXXXXX") || return 1
    cp -p "$SF_LOCK/fstab.before" "$SF_CONFIG_TEMP" || return 1
    printf '\nconfig swap '\''%s'\''\n\toption uuid '\''%s'\''\n\toption enabled '\''1'\''\n\nconfig mount '\''%s'\''\n\toption uuid '\''%s'\''\n\toption target '\''/sd'\''\n\toption fstype '\''ext4'\''\n\toption options '\''rw,sync'\''\n\toption enabled '\''1'\''\n' \
        "$sf_swap_section" "$sf_swap_uuid" "$sf_data_section" "$sf_data_uuid" >> "$SF_CONFIG_TEMP" || return 1
    storage_guard_partitions "$1" "$2" "$3" || return 1
    cmp -s "$SF_LOCK/fstab.before" "$sf_fstab" || {
        storage_format_error 'fstab changed during setup; no configuration replaced.'; return 1;
    }
    mv -f "$SF_CONFIG_TEMP" "$sf_fstab" || {
        storage_format_error 'Failed to install selected fstab entries.'; return 1;
    }
    SF_CONFIG_TEMP=
    # Perform only selected activation, never the global `block mount` operation.
    storage_activation_guard "$1" "$2" 0 || return 1
    mkdir -p /sd || return 1
    mount "$SF_DATA" /sd || { storage_format_error 'Selected data mount failed; fstab is already configured.'; return 1; }
    storage_activation_guard "$1" "$2" 1 || return 1
    swapon "$SF_SWAP" || { storage_format_error 'Selected swapon failed; data is mounted and fstab is configured.'; return 1; }
    storage_activation_guard "$1" "$2" 1 1 || return 1
    storage_install_environment "$SF_DATA" "$1" "$2" || return 1
    echo '[*] Setup completed successfully.'
}

storage_install_environment() {
    # Enable fstab service
    echo '[+] Enabling fstab service...'
    /etc/init.d/fstab enable || return 1
    # Check if PATH updates already exist to prevent duplication
    if ! grep -q '/sd/bin' /etc/profile; then
        echo '[+] Added SD card paths to PATH'
        echo 'export PATH=/usr/sbin:/usr/bin:/sbin:/bin:/sd/bin:/sd/sbin:/sd/usr/bin:/sd/usr/sbin' >> /etc/profile || return 1
    fi
    # Check if LD_LIBRARY_PATH updates already exist to prevent duplication
    if ! grep -q '/sd/lib' /etc/profile; then
        echo '[+] Added SD card library paths to LD_LIBRARY_PATH'
        echo 'export LD_LIBRARY_PATH=/lib:/usr/lib:/sd/lib:/sd/usr/lib' >> /etc/profile || return 1
    fi
    # Link the /etc directory if it is not already linked
    storage_activation_guard "$2" "$3" 1 1 || return 1
    if [ ! -e /sd/etc ] && [ ! -L /sd/etc ]; then
        echo '[+] Linked /etc directory to /sd/etc'
        ln -s /etc/ /sd/etc || return 1
    fi
    # Copy the hotplug script
    sf_hotplug_source="$SCRIPT_DIR/../files/20-sd-loader"
    sf_hotplug_target=/etc/hotplug.d/block/20-sd-loader
    if [ ! -f "$sf_hotplug_target" ]; then
        cp "$sf_hotplug_source" "$sf_hotplug_target" || {
            storage_format_error 'Failed to copy 20-sd-loader hotplug script.'; return 1;
        }
        echo '[+] Copied 20-sd-loader to /etc/hotplug.d/block'
    fi
}

# Public entry points run in their script's shell so signals cannot orphan a worker.
# The EXIT trap releases the transaction lock. No lock token or bypass is public.
storage_format() {
    [ "$#" -eq 3 ] || { storage_format_error 'Expected device ID, identity and confirmation path.'; return 1; }
    storage_lock || return 1
    storage_validate_target "$@" || return 1
    storage_format_selected "$@"
}
storage_setup() {
    [ "$#" -eq 3 ] || { storage_format_error 'Expected device ID, identity and confirmation path.'; return 1; }
    storage_lock || return 1
    storage_validate_target "$@" || return 1
    storage_format_selected "$@" || return 1
    if ! storage_configure_selected "$1" "$2" "$3" "$SF_SWAP" "$SF_DATA"; then
        storage_format_error 'Post-format setup failed; formatting is irreversible and configuration/activation may be partial.'
        return 1
    fi
}
storage_post_format() {
    [ "$#" -eq 5 ] || { storage_format_error 'Expected device ID, identity, confirmation, swap path and data path.'; return 1; }
    storage_lock || return 1
    storage_validate_target "$1" "$2" "$3" || return 1
    storage_capture_partitions "$1" "$2" || return 1
    storage_configure_selected "$@" || {
        storage_format_error 'Post-format setup failed; configuration/activation may be partial.'; return 1;
    }
}
