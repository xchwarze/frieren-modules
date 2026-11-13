#!/bin/sh
# Project: Frieren Framework
# Copyright (C) 2026 DSR! <xchwarze@gmail.com>
# SPDX-License-Identifier: LGPL-3.0-or-later

# Source this library; it performs no discovery until a public function is called.
# Readers are deliberately small. Installed callers use only these real paths.
storage_read_file() { cat "$1"; }
storage_realpath() { readlink -f "$1"; }
storage_path_exists() { [ -e "$1" ]; }
storage_is_symlink() { [ -L "$1" ]; }
storage_is_block() { [ -b "$1" ]; }
storage_block_mm() (
    storage_is_block "$1" || return 1
    storage_rdev_mm "$1"
)
storage_char_mm() (
    [ -c "$1" ] || return 1
    storage_rdev_mm "$1"
)
storage_rdev_mm() (
    # Stock OpenWrt enables ls -n/-d/-L, but not stat. Numeric long output
    # prints st_rdev (not st_dev) for block/character nodes. Never parse names.
    listing=$(LC_ALL=C ls -dnL "$1") || return 1
    pair=$(printf '%s\n' "$listing" | LC_ALL=C awk '
        NR!=1 || NF<7 || length($1)!=10 || $1!~/^[bc][-rwxStTs]+$/ ||
        $2!~/^[0-9]+$/ || $3!~/^[0-9]+$/ || $4!~/^[0-9]+$/ ||
        $5!~/^[0-9]+,$/ || $6!~/^[0-9]+$/ {bad=1}
        {major=$5;sub(/,$/,"",major);minor=$6}
        END {if(bad || NR!=1)exit 1;print major ":" minor}') || return 1
    storage_mm_valid "$pair" || return 1
    printf '%s\n' "$pair"
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
    [ "$#" -eq 2 ] || return 1
    node=$(storage_node_path "$1") || return 1
    parent=$(storage_parent "$node") || return 1
    partn=$(storage_read_file "/sys/class/block/$node/partition") || return 1
    seq=$(storage_read_file "/sys/class/block/$parent/diskseq") || return 1
    mm=$(storage_read_file "/sys/class/block/$node/dev") || return 1
    storage_uint "$partn" && [ "$partn" -gt 0 ] &&
        storage_uint "$seq" && [ "$seq" -gt 0 ] && storage_mm_valid "$mm" || return 1
    case "$2" in
        PARTLABEL)
            # The kernel's PARTNAME is also the name used for root=PARTLABEL.
            # Absence is valid only in a complete, identity-matching uevent.
            metadata=$(storage_read_file "/sys/class/block/$node/uevent") || return 1
            value=$(printf '%s\n' "$metadata" | LC_ALL=C awk -v node="$node" -v mm="$mm" -v partn="$partn" -v seq="$seq" '
                $0 !~ /^[A-Z][A-Z0-9_]*=/ || $0 ~ /[[:cntrl:]]/ {bad=1;next}
                {separator=index($0,"=");key=substr($0,1,separator-1)
                 if(seen[key]++)bad=1;field[key]=substr($0,separator+1)}
                END {
                    if(bad || (field["MAJOR"] ":" field["MINOR"])!=mm || field["DEVNAME"]!=node ||
                       field["DEVTYPE"]!="partition" || field["PARTN"]!=partn || field["DISKSEQ"]!=seq ||
                       (seen["PARTNAME"] && field["PARTNAME"]==""))exit 1
                    printf "%s",field["PARTNAME"]
                }') || return 1;;
        PARTUUID)
            # Optional full blkid only: BusyBox output is not partition UUID proof.
            # -p bypasses caches; no filesystem or partition-table writes are requested.
            # A nonzero probe can mean inaccessible or unreadable metadata, not no match.
            value=$(blkid -p -s PART_ENTRY_UUID -o value "$1") || return 1
            printf '%s\n' "$value" | LC_ALL=C awk '
                /^[0-9a-fA-F-]+$/ {
                    n=split($0,a,"-")
                    if((n==5 && length(a[1])==8 && length(a[2])==4 && length(a[3])==4 && length(a[4])==4 && length(a[5])==12) ||
                       (n==2 && length(a[1])==8 && length(a[2])==2))ok=1
                } END {exit !(ok && NR==1)}' || return 1;;
        *) return 1;;
    esac
    [ "$(storage_node_path "$1")" = "$node" ] &&
        [ "$(storage_read_file "/sys/class/block/$node/partition")" = "$partn" ] &&
        [ "$(storage_read_file "/sys/class/block/$parent/diskseq")" = "$seq" ] || return 1
    printf '%s\n' "$value"
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
storage_physical_mtd() (
    storage_uint "$1" || return 1
    mtd=$(storage_realpath "/sys/class/mtd/mtd$1") || return 1
    case "$mtd" in /sys/devices/virtual/*) return 1;; /sys/devices/*) ;; *) return 1;; esac
    [ "${mtd##*/}" = "mtd$1" ] || return 1
    type=$(storage_read_file "$mtd/type") || return 1
    # MTD registration alone also admits block2mtd, RAM, and simulated storage.
    case "$type" in nor|nand|mlc-nand|dataflash) ;; *) return 1;; esac
    name=$(storage_read_file "$mtd/name") || return 1
    case "$name" in ''|block2mtd:*) return 1;; esac
    proc_name=$(storage_read_file /proc/mtd | awk -v key="mtd$1:" '
        $1==key {line=$0;sub(/^[^"]*"/,"",line);sub(/"$/,"",line);name=line;count++}
        END {if(count!=1)exit 1;print name}') || return 1
    [ "$proc_name" = "$name" ] || return 1
    printf '%s\n' flash
)
storage_ubi_volume() (
    storage_uint "$1" && storage_uint "$2" || return 1
    parent=$(storage_realpath "/sys/class/ubi/ubi$1") || return 1
    volume=$(storage_realpath "/sys/class/ubi/ubi${1}_$2") || return 1
    [ "${parent##*/}" = "ubi$1" ] && [ "${volume##*/}" = "ubi${1}_$2" ] || return 1
    [ "${volume%/*}" = "$parent" ] || return 1
    number=$(storage_read_file "$parent/mtd_num") || return 1
    storage_uint "$number" || return 1
    [ "${parent%/*}" = "$(storage_realpath "/sys/class/mtd/mtd$number")" ] || return 1
    printf '%s\n' "$volume"
)
storage_flash() (
    case "$1" in
        /dev/*)
            canonical=$(storage_realpath "$1") || return 1
            case "$canonical" in
                /dev/mtdblock*)
                    number=${canonical#/dev/mtdblock}
                    storage_uint "$number" || return 1
                    [ "$(storage_node_path "$canonical")" = "mtdblock$number" ] || return 1
                    block=$(storage_realpath "/sys/class/block/mtdblock$number") || return 1
                    [ "${block%/*}" = "$(storage_realpath "/sys/class/mtd/mtd$number")" ] || return 1;;
                /dev/ubiblock*|/dev/ubi*_*)
                    name=${canonical#/dev/ubi}; name=${name#block}
                    ubi=${name%_*}; index=${name#*_}
                    volume=$(storage_ubi_volume "$ubi" "$index") || return 1
                    case "$canonical" in /dev/ubiblock*)
                        [ "$(storage_node_path "$canonical")" = "${canonical#/dev/}" ] || return 1
                        block=$(storage_realpath "/sys/class/block/${canonical#/dev/}") || return 1
                        [ "${block%/*}" = "$volume" ] || return 1;;
                    *)
                        dev=$(storage_read_file "$volume/dev") || return 1
                        storage_mm_valid "$dev" && [ "$(storage_char_mm "$canonical")" = "$dev" ] || return 1;;
                    esac
                    number=$(storage_read_file "${volume%/*}/mtd_num") || return 1;;
                *) return 1;;
            esac;;
        ubi[0-9]*:*)
            ubi=${1%%:*}; ubi=${ubi#ubi}; wanted=${1#*:}; match=
            storage_uint "$ubi" && [ -n "$wanted" ] || return 1
            entries=$(storage_list_dir "/sys/class/ubi/ubi$ubi") || return 1
            while IFS= read -r entry; do
                case "$entry" in "ubi${ubi}_"*) ;; *) continue;; esac
                volume=$(storage_ubi_volume "$ubi" "${entry#"ubi${ubi}_"}") || return 1
                if [ "$(storage_read_file "$volume/name")" = "$wanted" ]; then
                    [ -z "$match" ] || return 1
                    match=$volume
                fi
            done <<EOF
$entries
EOF
            [ -n "$match" ] || return 1
            number=$(storage_read_file "${match%/*}/mtd_num") || return 1;;
        *) return 1;;
    esac
    storage_physical_mtd "$number"
)

# Topology resolvers run in subshells: recursion never overwrites caller state.
# A depth limit refuses cycles and layouts whose full backing cannot be proven.
storage_backing_node() (
    [ "$2" -lt 16 ] || return 1
    node=$1; depth=$(( $2 + 1 ))
    storage_contains "$ST_NODES" "$node" || return 1
    case "$node" in mtdblock*|ubiblock*) storage_flash "/dev/$node"; return $?;; esac
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
    storage_path_exists "$1" || return 1
    canonical_path=$(storage_realpath "$1") || return 1
    # A loop can hold a block device open; /dev's filesystem is not its backing.
    if storage_is_block "$1"; then
        node=$(storage_node_path "$1") || return 1
        storage_backing_node "$node" "$(( $2 + 1 ))"
        return $?
    fi
    case "$canonical_path" in /dev/*) return 1;; esac
    # Loop backing_file is literal; mountinfo, overlay, and swaps encode paths.
    # Shell literal comparisons avoid awk -v interpreting backslash escapes.
    record=; best=0
    while read -r mm point fs source options; do
        [ -n "$mm" ] || continue
        mountpoint=$(storage_unescape "$point")
        case "$canonical_path" in "$mountpoint"|"$mountpoint"/*) matches=1;; *) matches=0;; esac
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
    # Anonymous Btrfs superblocks may span disks absent from the source path.
    [ "$fs" != btrfs ] || return 1
    # mountinfo identity takes precedence over a flash-looking source spelling.
    case "$mm" in 0:*) ;; *)
        node=$(storage_node_mm "$mm") || return 1
        case "$source" in /dev/*)
            if storage_path_exists "$source" || storage_is_symlink "$source"; then
                [ "$(storage_node_path "$source")" = "$node" ] || return 1
            fi;;
        esac
        storage_backing_node "$node" "$depth"
        return $?;;
    esac
    case "$fs" in
        ubifs|jffs2) storage_flash "$source";;
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
            if storage_is_block "$1"; then
                node=$(storage_node_path "$1") || return 1
                storage_backing_node "$node" 0
            else storage_flash "$1"; fi;;
    esac
)

storage_parse_mounts() {
    LC_ALL=C awk '
        {sep=0;for(i=7;i<=NF;i++)if($i=="-"){sep=i;break}
         if(NF<10 || !sep || NF!=sep+3 || $1!~/^[0-9]+$/ || $2!~/^[0-9]+$/ ||
            $3!~/^[0-9]+:[0-9]+$/ || $4!~/^\// || $5!~/^\//)exit 1
         print $3,$5,$(sep+1),$(sep+2),$(sep+3)}
        END {if(NR==0)exit 1}'
}
storage_mount_snapshot() {
    # Host-only usage: run on the router, not inside a container or chroot.
    ST_MOUNTS=
    st_raw=$(storage_read_file /proc/self/mountinfo) || return 1
    ST_MOUNTS=$(printf '%s\n' "$st_raw" | storage_parse_mounts) || return 1
}
storage_collect_loop_usage() {
    # Configured loops need not appear in the backing device's sysfs holders.
    st_loop_nodes=$(storage_list_dir /sys/class/block) || return 1
    while IFS= read -r st_loop; do
        [ -n "$st_loop" ] || continue
        storage_path_exists "/sys/class/block/$st_loop/loop" || continue
        st_backing_file=$(storage_read_file "/sys/class/block/$st_loop/loop/backing_file") || return 1
        [ -n "$st_backing_file" ] || return 1
        st_backing=$(storage_backing_node "$st_loop" 0) || return 1
        [ "$(storage_read_file "/sys/class/block/$st_loop/loop/backing_file")" = "$st_backing_file" ] || return 1
        while IFS= read -r st_disk; do
            case "$st_disk" in ''|flash|memory) continue;; esac
            ST_USAGE="$ST_USAGE
$st_disk held $st_loop"
        done <<EOF
$st_backing
EOF
    done <<EOF
$st_loop_nodes
EOF
}

storage_collect() {
    ST_ERROR=; ST_SYSTEM=; ST_USAGE=; ST_DISKS=; ST_NODES=; ST_MOUNTS=
    # Do not erase a disk before discovering that /sd aliases an occupied path.
    if storage_path_exists /sd || storage_is_symlink /sd; then
        st_destination=$(storage_realpath /sd 2>/dev/null) || storage_error 'Cannot resolve /sd destination.'
        [ "$st_destination" = /sd ] || storage_error 'Aliased /sd destination is not supported.'
        storage_list_dir /sd >/dev/null 2>&1 || storage_error 'Conflicting or unreadable /sd destination.'
    fi
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
    storage_mount_snapshot 2>/dev/null || storage_error 'Cannot read or validate host mount information.'
    storage_collect_loop_usage 2>/dev/null || storage_error 'Cannot resolve configured loop ownership.'
    st_root_seen=; st_system_proven=
    while read -r st_mm st_point st_fs st_source st_options; do
        [ -n "$st_mm" ] || continue
        case "$st_point" in /sd|/sd/*) storage_error 'Conflicting /sd mount.';; esac
        st_critical=
        case "$st_point" in /|/rom|/overlay|/boot) st_critical=1;; esac
        [ "$st_point" != / ] || st_root_seen=1
        # Ignore ordinary pseudo-filesystems; critical mounts still need proof.
        case "$st_mm" in 0:*)
            case "$st_fs" in
                proc|sysfs|tmpfs|ramfs|devtmpfs|devpts|cgroup|cgroup2|debugfs|tracefs|securityfs|configfs|pstore|bpf|mqueue|hugetlbfs|fusectl|binfmt_misc|nsfs)
                    [ -n "$st_critical" ] || continue;;
            esac;;
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
    # UCI show uses shell quoting, including '\'' for embedded apostrophes.
    # Support only single, single-line scalar targets; refuse other encodings.
    # This deliberately does not eval or partially strip producer quoting.
    st_targets=$(printf '%s\n' "$st_fstab" | LC_ALL=C awk -F= '
        /^$/ {next}
        $0!~/^fstab\.[^. =]+(\.[^. =]+)?=/ {bad=1;next}
        $1 ~ /^fstab\.[^.]+\.target$/ {
            value=substr($0,index($0,"=")+1)
            if(value!~/^\047[^\047]*\047$/ || value~/[[:cntrl:]]/) {bad=1;next}
            value=substr(value,2,length(value)-2)
            if(value=="")bad=1;else print value
        } END {exit bad}') || storage_error 'Unsupported or malformed fstab target encoding.'
    while IFS= read -r st_target; do
        [ -n "$st_target" ] || continue
        case "$st_target" in /sd|/sd/*) storage_error 'Conflicting /sd fstab configuration.'; continue;;
            /*) ;; *) storage_error 'Cannot resolve fstab destination.'; continue;; esac
        if ! st_resolved=$(storage_realpath "$st_target" 2>/dev/null); then
            storage_error 'Cannot resolve fstab destination.'; continue
        fi
        case "$st_resolved" in /sd|/sd/*) storage_error 'Conflicting /sd fstab configuration.';; esac
    done <<EOF
$st_targets
EOF
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
            # The first USB device (not interface) is the storage attachment.
            # Its upstream hubs describe their own attachment, not this disk.
            st_devpath=$(storage_read_file "$st_ancestor/devpath" 2>/dev/null)
            st_usb_type=$(storage_read_file "$st_ancestor/uevent" 2>/dev/null | awk -F= '$1=="DEVTYPE" {print $2}')
            if [ "$st_usb_type" = usb_device ] && [ "$st_devpath" != 0 ]; then
                st_location=$(storage_read_file "$st_ancestor/removable" 2>/dev/null)
                st_port=$(storage_read_file "$st_ancestor/port/connect_type" 2>/dev/null)
                case "$st_location:$st_port" in fixed:*|*:hardwired) ST_CONNECTION=fixed;;
                    removable:*|*:hotplug) ST_CONNECTION=removable;; esac
                break
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
    storage_block_mm "/dev/$1" >/dev/null 2>&1 || storage_block_reason 'Cannot read canonical device numbers (requires numeric ls -dnL).'
    ST_IDENTITY=$(storage_identity "$1" 2>/dev/null) || storage_block_reason 'Unknown or unstable disk identity.'
    st_sectors=$(storage_read_file "/sys/class/block/$1/size" 2>/dev/null)
    if storage_uint "$st_sectors"; then
        ST_SIZE=$(awk -v sectors="$st_sectors" 'BEGIN {printf "%.0f", sectors*512}')
        # 1 GiB swap, 16 MiB minimum data filesystem, 2 MiB alignment/table slack.
        [ "$st_sectors" -ge 2134016 ] || storage_block_reason 'Device is too small for 1 GiB swap and ext4.'
        # sysfs size always counts 512-byte sectors, also on 4Kn media.
        [ "$st_sectors" -le 4294967296 ] || storage_block_reason 'Device exceeds the retained DOS layout limit of 2 TiB (including 4Kn media).'
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
    if printf '%s\n' "$ST_USAGE" | awk -v id="$ST_ID" '$1==id && $2=="held" {held=1} END {exit !held}'; then
        storage_block_reason 'Device or partition is held by a configured loop.'
    fi
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
