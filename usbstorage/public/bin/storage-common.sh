#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2026 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later

# Source this library; it performs no discovery until a public function is called.
# Readers are deliberately small. Installed callers use only these real paths.
storage_read_file() { cat "$1"; }
storage_realpath() { readlink -f "$1"; }
storage_path_exists() { [ -e "$1" ]; }
storage_is_block() { [ -b "$1" ]; }
storage_block_mm() (
    storage_is_block "$1" || return 1
    pair=$(stat -L -c '%t:%T' "$1") || return 1
    major=${pair%:*}; minor=${pair#*:}
    case "$major" in ''|*[!0-9a-fA-F]*) return 1;; esac
    case "$minor" in ''|*[!0-9a-fA-F]*) return 1;; esac
    [ "${#major}" -le 8 ] && [ "${#minor}" -le 8 ] || return 1
    printf '%d:%d\n' "0x$major" "0x$minor"
)
storage_list_dir() (
    [ -d "$1" ] && [ -r "$1" ] && [ -x "$1" ] || return 1
    for entry in "$1"/*; do
        [ -e "$entry" ] || [ -L "$entry" ] || continue
        printf '%s\n' "${entry##*/}"
    done
)
storage_read_fstab() {
    [ -e /etc/config/fstab ] || return 0
    uci -q show fstab
}
storage_partition_value() (
    # Full blkid supports partition tags. Unsupported BusyBox variants fail closed.
    # -p bypasses caches; no filesystem or partition-table writes are requested.
    case "$2" in PARTUUID) tag=PART_ENTRY_UUID;; PARTLABEL) tag=PART_ENTRY_NAME;; *) return 1;; esac
    # A nonzero probe can mean inaccessible or unreadable metadata, not no match.
    blkid -p -s "$tag" -o value "$1"
)

storage_name_valid() {
    case "$1" in ''|[!a-zA-Z0-9]*|*[!a-zA-Z0-9._-]*) return 1;; esac
}
storage_uint() {
    case "$1" in ''|*[!0-9]*|0[0-9]* ) return 1;; esac
    # Bounds keep shell arithmetic and JSON numbers exact on 64-bit ash.
    [ "${#1}" -le 14 ] && [ "$1" -le 17592186044415 ]
}
storage_mm_valid() (
    case "$1" in *:*) ;; *) return 1;; esac
    storage_uint "${1%:*}" && storage_uint "${1#*:}"
)
storage_contains() {
    printf '%s\n' "$1" | LC_ALL=C awk -v wanted="$2" '$0 == wanted { found=1 } END { exit !found }'
}
storage_json() {
    printf '%s' "$1" | LC_ALL=C awk '
        BEGIN { printf "\""; for (i=1;i<32;i++) escape[sprintf("%c",i)]=sprintf("\\u%04x",i) }
        NR>1 { printf "\\n" }
        { for (i=1;i<=length($0);i++) {
            c=substr($0,i,1)
            if (c == "\"") printf "\\\""
            else if (c == "\\") printf "\\\\"
            else if (c in escape) printf "%s",escape[c]
            else printf "%s",c
        }} END { printf "\"" }'
}
storage_unescape() {
    # Decode only procfs path escapes, never arbitrary shell escape sequences.
    printf '%s\n' "$1" | awk '
        BEGIN {decode["\\040"]=" ";decode["\\011"]="\t";decode["\\012"]="\n";decode["\\134"]="\\"}
        {for(i=1;i<=length($0);i++) {
            code=substr($0,i,4)
            if(code in decode) {printf "%s",decode[code];i+=3}
            else printf "%s",substr($0,i,1)
        }}'
}
storage_error() { [ -n "$ST_ERROR" ] || ST_ERROR=$1; }

storage_node_mm() (
    storage_mm_valid "$1" || return 1
    canonical=$(storage_realpath "/sys/dev/block/$1") || return 1
    node=${canonical##*/}
    storage_contains "$ST_NODES" "$node" || return 1
    [ "$(storage_realpath "/sys/class/block/$node")" = "$canonical" ] || return 1
    [ "$(storage_read_file "/sys/class/block/$node/dev")" = "$1" ] || return 1
    printf '%s\n' "$node"
)
storage_node_path() (
    canonical=$(storage_realpath "$1") || return 1
    node=${canonical#/dev/}
    storage_name_valid "$node" && [ "$canonical" = "/dev/$node" ] || return 1
    storage_contains "$ST_NODES" "$node" && storage_is_block "$canonical" || return 1
    mm=$(storage_read_file "/sys/class/block/$node/dev") || return 1
    [ "$(storage_block_mm "$canonical")" = "$mm" ] || return 1
    [ "$(storage_node_mm "$mm")" = "$node" ] || return 1
    printf '%s\n' "$node"
)
storage_parent() (
    canonical=$(storage_realpath "/sys/class/block/$1") || return 1
    parent=${canonical%/*}
    parent=${parent##*/}
    storage_contains "$ST_DISKS" "$parent" || return 1
    printf '%s\n' "$parent"
)
storage_flash() (
    case "$1" in
        /dev/mtdblock[0-9]*) number=${1#/dev/mtdblock};;
        ubi[0-9]*:*)
            ubi=${1%%:*}
            number=$(storage_read_file "/sys/class/ubi/$ubi/mtd_num") || return 1;;
        /dev/ubiblock[0-9]*_[0-9]*)
            ubi=ubi${1#/dev/ubiblock}
            number=$(storage_read_file "/sys/class/ubi/$ubi/mtd_num") || return 1;;
        /dev/ubi[0-9]*_[0-9]*)
            ubi=${1#/dev/}
            number=$(storage_read_file "/sys/class/ubi/$ubi/mtd_num") || return 1;;
        *) return 1;;
    esac
    storage_uint "$number" && storage_path_exists "/sys/class/mtd/mtd$number" || return 1
    storage_read_file /proc/mtd | awk -v key="mtd$number:" '$1 == key {found=1} END {exit !found}' || return 1
    printf '%s\n' flash
)

# Topology resolvers run in subshells: recursion never overwrites caller state.
# A depth limit refuses cycles and layouts whose full backing cannot be proven.
storage_backing_node() (
    [ "$2" -lt 16 ] || return 1
    node=$1; depth=$(( $2 + 1 ))
    storage_contains "$ST_NODES" "$node" || return 1
    if storage_path_exists "/sys/class/block/$node/partition"; then
        parent=$(storage_parent "$node") || return 1
        storage_backing_node "$parent" "$depth"
        return $?
    fi
    slaves=$(storage_list_dir "/sys/class/block/$node/slaves") || return 1
    if [ -n "$slaves" ]; then
        while IFS= read -r slave; do
            storage_backing_node "$slave" "$depth" || return 1
        done <<EOF
$slaves
EOF
    elif storage_path_exists "/sys/class/block/$node/loop/backing_file"; then
        backing=$(storage_read_file "/sys/class/block/$node/loop/backing_file") || return 1
        storage_backing_path "$backing" "$depth"
    else
        case "$node" in dm-*|loop*|md*|zram*|ram*) return 1;; esac
        canonical=$(storage_realpath "/sys/class/block/$node") || return 1
        case "$canonical" in /sys/devices/virtual/*) return 1;; esac
        printf '%s\n' "$node"
    fi
)
storage_backing_path() (
    [ "$2" -lt 16 ] || return 1
    case "$1" in /*) ;; *) return 1;; esac
    case "$1" in *//*|*/./*|*/../*|*/.|*/..) return 1;; esac
    # Loop backing_file is literal; mountinfo, overlay, and swaps encode paths.
    # Shell literal comparisons avoid awk -v interpreting backslash escapes.
    record=; best=0
    while read -r mm point fs source options; do
        [ -n "$mm" ] || continue
        mountpoint=$(storage_unescape "$point")
        case "$1" in "$mountpoint"|"$mountpoint"/*) matches=1;; *) matches=0;; esac
        if [ "$mountpoint" = / ] || [ "$matches" -eq 1 ]; then
            if [ "${#mountpoint}" -gt "$best" ]; then
                best=${#mountpoint}; record="$mm $point $fs $source $options"
            fi
        fi
    done <<EOF
$ST_MOUNTS
EOF
    [ -n "$record" ] || return 1
    storage_backing_mount "$record" "$(( $2 + 1 ))"
)
storage_backing_mount() (
    [ "$2" -lt 16 ] || return 1
    depth=$(( $2 + 1 ))
    read -r mm _point fs source options <<EOF
$1
EOF
    if storage_flash "$source" 2>/dev/null; then return 0; fi
    case "$fs" in
        overlay|overlayfs)
            paths=$(printf '%s\n' "$options" | awk -F, '
                { for(i=1;i<=NF;i++) {
                    if ($i ~ /^lowerdir=/) {s=substr($i,10);n=split(s,a,":");for(j=1;j<=n;j++)print a[j]; lower=1}
                    if ($i ~ /^upperdir=/) print substr($i,10)
                }} END {if (!lower) exit 1}') || return 1
            [ -n "$paths" ] || return 1
            while IFS= read -r path; do
                storage_backing_path "$(storage_unescape "$path")" "$depth" || return 1
            done <<EOF
$paths
EOF
            ;;
        tmpfs|ramfs) printf '%s\n' memory;;
        *)
            node=$(storage_node_mm "$mm") || return 1
            storage_backing_node "$node" "$depth";;
    esac
)
storage_root_reference() (
    case "$1" in
        PARTUUID=*|PARTLABEL=*)
            key=${1%%=*}; wanted=${1#*=}; matches=
            [ -n "$wanted" ] || return 1
            while IFS= read -r node; do
                [ -n "$node" ] || continue
                storage_path_exists "/sys/class/block/$node/partition" || continue
                [ "$(storage_node_path "/dev/$node")" = "$node" ] || return 1
                value=$(storage_partition_value "/dev/$node" "$key") || return 1
                if [ "$value" = "$wanted" ]; then
                    [ -z "$matches" ] || return 1
                    matches=$node
                fi
            done <<EOF
$ST_NODES
EOF
            [ -n "$matches" ] || return 1
            storage_backing_node "$matches" 0;;
        *)
            if storage_flash "$1" 2>/dev/null; then return 0; fi
            node=$(storage_node_path "$1") || return 1
            storage_backing_node "$node" 0;;
    esac
)

storage_collect() {
    ST_ERROR=; ST_SYSTEM=; ST_USAGE=; ST_DISKS=; ST_NODES=; ST_MOUNTS=
    st_raw_nodes=$(storage_list_dir /sys/class/block 2>/dev/null) || storage_error 'Cannot enumerate block devices.'
    while IFS= read -r st_node; do
        [ -n "$st_node" ] || continue
        if ! storage_name_valid "$st_node"; then storage_error 'Malformed block identifier.'; continue; fi
        ST_NODES="${ST_NODES}${ST_NODES:+
}$st_node"
        if ! storage_path_exists "/sys/class/block/$st_node/partition"; then
            ST_DISKS="${ST_DISKS}${ST_DISKS:+
}$st_node"
        fi
    done <<EOF
$st_raw_nodes
EOF
    while IFS= read -r st_node; do
        [ -n "$st_node" ] || continue
        if storage_path_exists "/sys/class/block/$st_node/partition"; then
            storage_parent "$st_node" >/dev/null 2>&1 || storage_error 'Cannot resolve partition parent.'
        fi
    done <<EOF
$ST_NODES
EOF
    st_raw=$(storage_read_file /proc/self/mountinfo 2>/dev/null) || storage_error 'Cannot read mount usage.'
    ST_MOUNTS=$(printf '%s\n' "$st_raw" | awk '
        {sep=0;for(i=7;i<=NF;i++)if($i=="-"){sep=i;break}
         if(NF<10 || !sep || NF!=sep+3 || $3 !~ /^[0-9]+:[0-9]+$/ || $5 !~ /^\//) exit 1
         print $3,$5,$(sep+1),$(sep+2),$(sep+3)}') || storage_error 'Malformed mount information.'
    st_root_seen=; st_system_proven=
    while read -r st_mm st_point st_fs st_source st_options; do
        [ -n "$st_mm" ] || continue
        case "$st_point" in /sd|/sd/*) storage_error 'Conflicting /sd mount.';; esac
        st_critical=
        case "$st_point" in /|/rom|/overlay|/boot) st_critical=1;; esac
        [ "$st_point" != / ] || st_root_seen=1
        # Ignore ordinary pseudo-filesystems; critical mounts still need proof.
        case "$st_mm:$st_fs" in 0:*:*)
            case "$st_fs" in overlay|overlayfs|ubifs) ;; *) [ -n "$st_critical" ] || continue;; esac;;
        esac
        if ! st_backing=$(storage_backing_mount "$st_mm $st_point $st_fs $st_source $st_options" 0 2>/dev/null); then
            storage_error "Cannot resolve mounted backing storage: $st_point"; continue
        fi
        if [ -n "$st_critical" ]; then
            ST_SYSTEM="$ST_SYSTEM
$st_backing"
            case "$st_backing" in ''|memory) ;; *) st_system_proven=1;; esac
        fi
        while IFS= read -r st_disk; do
            case "$st_disk" in ''|flash|memory) continue;; esac
            ST_USAGE="$ST_USAGE
$st_disk mount $st_point"
        done <<EOF
$st_backing
EOF
    done <<EOF
$ST_MOUNTS
EOF
    if [ -z "$st_root_seen" ] || [ -z "$st_system_proven" ]; then storage_error 'System backing storage is unresolved.'; fi
    st_cmdline=$(storage_read_file /proc/cmdline 2>/dev/null) || storage_error 'Cannot read boot root reference.'
    st_roots=$(printf '%s\n' "$st_cmdline" | awk '{for(i=1;i<=NF;i++)if($i~/^root=/){
        if(length($i)==5)exit 1;print substr($i,6)}}') || storage_error 'Empty boot root reference.'
    st_root_count=0
    while IFS= read -r st_root; do
        [ -n "$st_root" ] || continue
        st_root_count=$((st_root_count + 1))
        # /dev/root is a kernel placeholder, not necessarily an actual alias.
        if [ "$st_root" = /dev/root ] && ! storage_is_block /dev/root; then continue; fi
        if ! st_backing=$(storage_root_reference "$st_root" 2>/dev/null); then storage_error 'Cannot resolve boot root reference.'
        else ST_SYSTEM="$ST_SYSTEM
$st_backing"; fi
    done <<EOF
$st_roots
EOF
    [ "$st_root_count" -le 1 ] || storage_error 'Ambiguous boot root references.'
    st_swaps=$(storage_read_file /proc/swaps 2>/dev/null) || storage_error 'Cannot read active swap.'
    st_swap_rows=$(printf '%s\n' "$st_swaps" | awk '
        NR==1 {if($1!="Filename" || $2!="Type" || NF!=5)exit 1;next}
        NF!=5 || ($2!="partition" && $2!="file") {exit 1}
        {print $1,$2} END {if(NR==0)exit 1}') || storage_error 'Malformed swap information.'
    while read -r st_swap st_type; do
        [ -n "$st_swap" ] || continue
        if ! st_backing=$(
            if [ "$st_type" = partition ]; then
                st_node=$(storage_node_path "$(storage_unescape "$st_swap")") || exit 1
                storage_backing_node "$st_node" 0
            else storage_backing_path "$(storage_unescape "$st_swap")" 0; fi
        ) 2>/dev/null; then storage_error 'Cannot resolve active swap backing storage.'; continue; fi
        while IFS= read -r st_disk; do
            case "$st_disk" in ''|flash|memory) continue;; esac
            ST_USAGE="$ST_USAGE
$st_disk swap $st_swap"
        done <<EOF
$st_backing
EOF
    done <<EOF
$st_swap_rows
EOF
    st_fstab=$(storage_read_fstab 2>/dev/null) || storage_error 'Cannot inspect fstab configuration.'
    if printf '%s\n' "$st_fstab" | awk -F= '
        $1 ~ /^fstab\.[^.]+\.target$/ {value=substr($0,index($0,"=")+1);gsub(/^\047|\047$/,"",value)
            if(value=="/sd" || index(value,"/sd/")==1)found=1}
        END {exit !found}'; then storage_error 'Conflicting /sd fstab configuration.'; fi
}

storage_identity() (
    boot=$(storage_read_file /proc/sys/kernel/random/boot_id) || return 1
    printf '%s\n' "$boot" | LC_ALL=C awk '
        /^[0-9a-fA-F-]+$/ {n=split($0,a,"-");if(n==5 && length(a[1])==8 && length(a[2])==4 && length(a[3])==4 && length(a[4])==4 && length(a[5])==12)ok=1}
        END {exit !(ok && NR==1)}' || return 1
    mm=$(storage_read_file "/sys/class/block/$1/dev") || return 1
    seq=$(storage_read_file "/sys/class/block/$1/diskseq") || return 1
    sectors=$(storage_read_file "/sys/class/block/$1/size") || return 1
    storage_mm_valid "$mm" && storage_uint "$seq" && [ "$seq" -gt 0 ] &&
        storage_uint "$sectors" && [ "$sectors" -gt 0 ] || return 1
    [ "$(storage_node_path "/dev/$1")" = "$1" ] || return 1
    printf 'v1:%s:%s:%s:%s\n' "$boot" "$mm" "$seq" "$sectors"
)
storage_classify() {
    ST_TRANSPORT=unknown; ST_CONNECTION=unknown; ST_WARNING=
    st_type=$(storage_read_file "/sys/class/block/$1/device/type" 2>/dev/null)
    case "$st_type" in
        MMC) ST_TRANSPORT=mmc; ST_CONNECTION=fixed; return;;
        SD) ST_TRANSPORT=sd
            [ "$(storage_read_file "/sys/class/block/$1/removable" 2>/dev/null)" != 1 ] || ST_CONNECTION=removable
            return;;
    esac
    st_ancestor=$(storage_realpath "/sys/class/block/$1" 2>/dev/null) || return
    while [ "$st_ancestor" != / ] && [ -n "$st_ancestor" ]; do
        st_subsystem=$(storage_realpath "$st_ancestor/subsystem" 2>/dev/null)
        if [ "${st_subsystem##*/}" = usb ]; then
            ST_TRANSPORT=usb
            # A root hub is fixed to its controller, not to its external ports.
            st_devpath=$(storage_read_file "$st_ancestor/devpath" 2>/dev/null)
            if [ "$st_devpath" != 0 ]; then
                st_location=$(storage_read_file "$st_ancestor/removable" 2>/dev/null)
                st_port=$(storage_read_file "$st_ancestor/port/connect_type" 2>/dev/null)
                case "$st_location:$st_port" in fixed:*|*:hardwired) ST_CONNECTION=fixed;;
                    removable:*|*:hotplug) [ "$ST_CONNECTION" = fixed ] || ST_CONNECTION=removable;; esac
            fi
        fi
        st_ancestor=${st_ancestor%/*}
    done
    if [ "$ST_TRANSPORT:$ST_CONNECTION" = usb:unknown ]; then
        ST_WARNING='USB connection location is unknown; verify this is external storage before erasing.'
    fi
}
storage_block_reason() { [ -n "$ST_REASON" ] || ST_REASON=$1; }
storage_evaluate() {
    ST_ID=$1; ST_REASON=$ST_ERROR; ST_PARTITIONS=; ST_SIZE=0
    ST_MODEL=$(storage_read_file "/sys/class/block/$1/device/model" 2>/dev/null)
    [ -n "$ST_MODEL" ] || ST_MODEL=$1
    ST_IDENTITY=$(storage_identity "$1" 2>/dev/null) || storage_block_reason 'Unknown or unstable disk identity.'
    st_sectors=$(storage_read_file "/sys/class/block/$1/size" 2>/dev/null)
    if storage_uint "$st_sectors"; then
        ST_SIZE=$(awk -v sectors="$st_sectors" 'BEGIN {printf "%.0f", sectors*512}')
        # 1 GiB swap, 16 MiB minimum data filesystem, 2 MiB alignment/table slack.
        [ "$st_sectors" -ge 2134016 ] || storage_block_reason 'Device is too small for 1 GiB swap and ext4.'
    else storage_block_reason 'Malformed device capacity.'; fi
    storage_classify "$1"
    if storage_contains "$ST_SYSTEM" "$1"; then storage_block_reason 'System backing disk.'; fi
    case "$ST_TRANSPORT:$ST_CONNECTION" in
        mmc:*) storage_block_reason 'Internal eMMC is not supported.';;
        usb:fixed) storage_block_reason 'Fixed/internal USB connection.';;
        usb:*|sd:removable) ;;
        *) storage_block_reason 'Unknown or unsupported transport/connection.';;
    esac
    st_removable=$(storage_read_file "/sys/class/block/$1/removable" 2>/dev/null)
    case "$st_removable" in 0|1) ;; *) storage_block_reason 'Incomplete removable-media metadata.';; esac
    while IFS= read -r st_child; do
        [ -n "$st_child" ] || continue
        if [ "$st_child" != "$ST_ID" ]; then
            storage_path_exists "/sys/class/block/$st_child/partition" || continue
            [ "$(storage_parent "$st_child" 2>/dev/null)" = "$ST_ID" ] || continue
            st_partnumber=$(storage_read_file "/sys/class/block/$st_child/partition" 2>/dev/null)
            if ! storage_uint "$st_partnumber" || [ "$st_partnumber" -eq 0 ]; then
                storage_block_reason 'Incomplete partition number metadata.'
            fi
            st_partsize=$(storage_read_file "/sys/class/block/$st_child/size" 2>/dev/null)
            if ! storage_uint "$st_partsize"; then storage_block_reason 'Incomplete partition metadata.'; st_partsize=0; fi
            st_bytes=$(awk -v sectors="$st_partsize" 'BEGIN {printf "%.0f", sectors*512}')
            ST_PARTITIONS="$ST_PARTITIONS${ST_PARTITIONS:+,}{\"path\":\"/dev/$st_child\",\"sizeBytes\":$st_bytes}"
            storage_node_path "/dev/$st_child" >/dev/null 2>&1 || storage_block_reason 'Incomplete partition identity.'
        fi
        st_ro=$(storage_read_file "/sys/class/block/$st_child/ro" 2>/dev/null)
        case "$st_ro" in 0) ;; 1) storage_block_reason 'Device or partition is read-only.';;
            *) storage_block_reason 'Incomplete read-only metadata.';; esac
        st_holders=$(storage_list_dir "/sys/class/block/$st_child/holders" 2>/dev/null) || storage_block_reason 'Cannot inspect block holders.'
        [ -z "$st_holders" ] || storage_block_reason 'Device or partition is held by another block device.'
    done <<EOF
$ST_NODES
EOF
    ST_MOUNT_PATHS=$(printf '%s\n' "$ST_USAGE" | awk -v id="$ST_ID" '$1==id && $2=="mount" {print $3}')
    ST_SWAP_PATHS=$(printf '%s\n' "$ST_USAGE" | awk -v id="$ST_ID" '$1==id && $2=="swap" {print $3}')
    [ -z "$ST_SWAP_PATHS" ] || storage_block_reason 'Device is used by active swap.'
    [ -z "$ST_MOUNT_PATHS" ] || storage_block_reason 'Device or partition is mounted.'
    [ "$ST_IDENTITY" = "$(storage_identity "$ST_ID" 2>/dev/null)" ] || storage_block_reason 'Disk identity changed during discovery.'
}
storage_json_paths() (
    separator=
    while IFS= read -r path; do
        [ -n "$path" ] || continue
        printf '%s' "$separator"
        storage_json "$(storage_unescape "$path")"
        separator=,
    done <<EOF
$1
EOF
)

# Public: JSON stdout, including a blocking error instead of hiding unsafe disks.
# Discovery is read-only. A successful JSON response is not authorization to erase.
storage_inventory() (
    LC_ALL=C; export LC_ALL
    storage_collect
    printf '{"devices":['
    st_separator=
    while IFS= read -r st_device; do
        [ -n "$st_device" ] || continue
        storage_evaluate "$st_device"
        printf '%s{"id":' "$st_separator"; storage_json "$ST_ID"
        printf ',"path":'; storage_json "/dev/$ST_ID"
        printf ',"model":'; storage_json "$ST_MODEL"
        printf ',"sizeBytes":%s,"transport":' "$ST_SIZE"; storage_json "$ST_TRANSPORT"
        printf ',"connection":'; storage_json "$ST_CONNECTION"
        printf ',"identity":'; storage_json "$ST_IDENTITY"
        if [ -n "$ST_REASON" ]; then printf ',"eligible":false,"reason":'; storage_json "$ST_REASON"
        else printf ',"eligible":true,"reason":null'; fi
        printf ',"warnings":['
        [ -z "$ST_WARNING" ] || storage_json "$ST_WARNING"
        printf '],"partitions":[%s],"mounts":[' "$ST_PARTITIONS"
        storage_json_paths "$ST_MOUNT_PATHS"
        printf '],"swaps":['; storage_json_paths "$ST_SWAP_PATHS"
        printf ']}'
        st_separator=,
    done <<EOF
$ST_DISKS
EOF
    printf '],"error":'
    if [ -n "$ST_ERROR" ]; then storage_json "$ST_ERROR"; else printf null; fi
    printf '}\n'
)

# Public: exactly DEVICE_ID IDENTITY CONFIRMATION. No path or automatic fallback.
# Call again immediately before every destructive boundary; hotplug is not atomic.
# On failure, canonical target variables are empty and diagnostics go to stderr.
# These public outputs are read by the sourcing formatter, not this library.
# shellcheck disable=SC2034
storage_validate_target() {
    STORAGE_TARGET_ID=; STORAGE_TARGET_PATH=; STORAGE_TARGET_IDENTITY=
    if [ "$#" -ne 3 ]; then printf '%s\n' 'Expected device ID, identity, and confirmation path.' >&2; return 1; fi
    if ! storage_name_valid "$1" || [ "$3" != "/dev/$1" ] || [ -z "$2" ]; then
        printf '%s\n' 'Invalid device selection or confirmation.' >&2; return 1
    fi
    storage_collect
    if ! storage_contains "$ST_DISKS" "$1"; then printf '%s\n' 'Selected whole disk is not present.' >&2; return 1; fi
    storage_evaluate "$1"
    if [ -n "$ST_REASON" ]; then printf '%s\n' "$ST_REASON" >&2; return 1; fi
    if [ "$2" != "$ST_IDENTITY" ] || [ "$2" != "$(storage_identity "$1" 2>/dev/null)" ]; then
        printf '%s\n' 'Disk identity changed; refresh inventory.' >&2; return 1
    fi
    STORAGE_TARGET_ID=$1; STORAGE_TARGET_PATH=/dev/$1; STORAGE_TARGET_IDENTITY=$ST_IDENTITY
}
