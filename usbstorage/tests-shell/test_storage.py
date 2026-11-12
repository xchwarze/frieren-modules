"""Read-only storage policy tests. No host device or probe is ever used."""

import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest


MODULE = Path(__file__).resolve().parents[1]
COMMON = MODULE / "public/bin/storage-common.sh"
CLI = MODULE / "public/bin/storage-devices.sh"
BOOT = "12345678-1234-1234-1234-123456789abc"
SECTORS = 16777216
IDENTITY = f"v1:{BOOT}:8:0:12:{SECTORS}"


class StorageTests(unittest.TestCase):
    def setUp(self):
        temp_parent = Path("/tmp/opencode")
        self.temp = tempfile.TemporaryDirectory(prefix="storage-",
                                                dir=temp_parent if temp_parent.is_dir() else None)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.paths = {}
        for directory in ("sys/class/block", "sys/dev/block", "sys/bus/usb",
                          "dev", "metadata", "commands"):
            (self.root / directory).mkdir(parents=True)
        self.write("/proc/sys/kernel/random/boot_id", BOOT)
        self.write("/proc/cmdline", "console=ttyS0 root=ubi0:rootfs")
        self.write("/proc/swaps", "Filename\tType\tSize\tUsed\tPriority\n")
        self.write("/proc/mtd", 'dev: size erasesize name\nmtd4: 01000000 00020000 "ubi"\n')
        self.write("/sys/class/ubi/ubi0/mtd_num", "4")
        (self.root / "sys/class/mtd/mtd4").mkdir(parents=True)
        self.write("/etc/config/fstab", "")
        self.mounts = ["1 0 0:20 / / rw - ubifs ubi0:rootfs rw"]
        self.sync_mounts()
        self.disk("sda", "8:0")
        refusing = "#!/bin/sh\nprintf '%s\\n' \"$0 $*\" >> \"$REFUSAL_LOG\"\nexit 97\n"
        for name in ("fdisk", "sfdisk", "parted", "partprobe", "mkfs", "mkfs.ext4",
                     "mkswap", "mount", "umount", "swapon", "swapoff", "wipefs", "dd",
                     "block", "blkid", "uci", "format-device.sh", "auto-setup.sh"):
            path = self.root / "commands" / name
            path.write_text(refusing)
            path.chmod(0o755)
        self.env = dict(os.environ, FX=str(self.root),
                        REFUSAL_LOG=str(self.root / "refused"),
                        PATH=f"{self.root / 'commands'}:/usr/bin:/bin")
        # Only narrow I/O readers change. Policy and JSON serialization remain real.
        self.readers = r'''
storage_read_file() { cat "$FX$1"; }
storage_list_dir() {
    [ -d "$FX$1" ] || return 1
    for entry in "$FX$1"/*; do
        [ -e "$entry" ] || [ -L "$entry" ] || continue
        printf '%s\n' "${entry##*/}"
    done
}
storage_realpath() {
    result=$(readlink -f "$FX$1") || return 1
    case "$result" in "$FX"/*) printf '%s\n' "${result#"$FX"}";; *) return 1;; esac
}
storage_path_exists() { [ -e "$FX$1" ]; }
storage_is_block() { [ -f "$FX$1" ]; }
storage_block_mm() { cat "$FX/rdev/${1##*/}"; }
storage_read_fstab() { cat "$FX/etc/config/fstab"; }
storage_partition_value() {
    [ ! -e "$FX/metadata/fail" ] || return 1
    [ -f "$FX/metadata/${1##*/}.$2" ] || return 0
    cat "$FX/metadata/${1##*/}.$2"
}
'''

    def write(self, path, value):
        target = self.root / path.lstrip("/")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value)

    def link(self, path, target):
        link = self.root / path.lstrip("/")
        link.parent.mkdir(parents=True, exist_ok=True)
        link.symlink_to(os.path.relpath(self.root / target.lstrip("/"), link.parent))

    def disk(self, name, mm, transport="usb", removable="1", connection="removable"):
        if transport == "usb":
            ancestor = f"/sys/devices/platform/usb-{name}/1-1"
            self.link(f"{ancestor}/subsystem", "/sys/bus/usb")
            self.write(f"{ancestor}/uevent", "DEVTYPE=usb_device\n")
            self.write(f"{ancestor}/removable", connection)
            path = f"{ancestor}/host0/block/{name}"
        else:
            path = f"/sys/devices/platform/{name}/block/{name}"
        self.paths[name] = path
        for attribute, value in {"dev": mm, "size": str(SECTORS), "diskseq": "12",
                                 "ro": "0", "removable": removable,
                                 "device/model": "Test disk"}.items():
            self.write(f"{path}/{attribute}", value)
        if transport in ("sd", "mmc"):
            self.write(f"{path}/device/type", "SD" if transport == "sd" else "MMC")
        (self.root / path.lstrip("/") / "holders").mkdir()
        (self.root / path.lstrip("/") / "slaves").mkdir()
        self.link(f"/sys/class/block/{name}", path)
        self.link(f"/sys/dev/block/{mm}", path)
        self.write(f"/dev/{name}", "fixture block node marker")
        self.write(f"/rdev/{name}", mm)
        return path

    def partition(self, disk="sda", name="sda1", mm="8:1", label=None, uuid=None):
        path = f"{self.paths[disk]}/{name}"
        self.paths[name] = path
        for attribute, value in {"dev": mm, "size": "4194304", "partition": "1", "ro": "0"}.items():
            self.write(f"{path}/{attribute}", value)
        (self.root / path.lstrip("/") / "holders").mkdir()
        self.link(f"/sys/class/block/{name}", path)
        self.link(f"/sys/dev/block/{mm}", path)
        self.write(f"/dev/{name}", "fixture partition marker")
        self.write(f"/rdev/{name}", mm)
        for key, value in (("PARTLABEL", label), ("PARTUUID", uuid)):
            if value is not None:
                self.write(f"/metadata/{name}.{key}", value)

    def attr(self, name, attribute, value):
        self.write(f"{self.paths[name]}/{attribute}", value)

    def sync_mounts(self):
        self.write("/proc/self/mountinfo", "\n".join(self.mounts) + "\n")

    def run_shell(self, body, extra=""):
        result = subprocess.run(["sh", "-c", f". {shlex.quote(str(COMMON))}\n" +
                                 self.readers + extra + "\n" + body],
                                env=self.env, text=True, capture_output=True, timeout=20)
        self.assertFalse((self.root / "refused").exists(), "A forbidden host/probe command was attempted")
        return result

    def inventory(self):
        result = self.run_shell("storage_inventory")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")
        value = json.loads(result.stdout)
        self.assertEqual(set(value), {"devices", "error"})
        for device in value["devices"]:
            self.assertEqual(set(device), {"id", "path", "model", "sizeBytes", "transport",
                             "connection", "identity", "eligible", "reason", "warnings",
                             "partitions", "mounts", "swaps"})
        return value

    def device(self, name="sda"):
        inventory = self.inventory()
        self.assertIsNone(inventory["error"], inventory)
        return next(d for d in inventory["devices"] if d["id"] == name)

    def validate(self, args=("sda", IDENTITY, "/dev/sda"), extra=""):
        quoted = " ".join(shlex.quote(arg) for arg in args)
        result = self.run_shell(f"storage_validate_target {quoted}\nstatus=$?\n"
                                'printf "%s|%s|%s|%s\\n" "$status" "$STORAGE_TARGET_ID" '
                                '"$STORAGE_TARGET_PATH" "$STORAGE_TARGET_IDENTITY"', extra)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip().split("|"), result.stderr

    def assert_blocked(self, name="sda", reason=None):
        device = self.device(name)
        self.assertFalse(device["eligible"], device)
        self.assertTrue(device["reason"])
        if reason:
            self.assertIn(reason, device["reason"].lower())
        return device

    def assert_global_error(self):
        inventory = self.inventory()
        self.assertTrue(inventory["error"], inventory)
        self.assertTrue(all(not d["eligible"] for d in inventory["devices"]), inventory)
        state, _ = self.validate()
        self.assertNotEqual(state[0], "0")
        self.assertEqual(state[1:], ["", "", ""])

    def test_emmc_system_blocks_only_emmc_and_keeps_usb_eligible(self):
        self.disk("mmcblk0", "179:0", "mmc", "0")
        self.disk("mmcblk1", "179:8", "sd")
        self.partition("mmcblk0", "mmcblk0p2", "179:2")
        self.mounts = ["1 0 179:2 / / rw - ext4 /dev/root rw"]
        self.sync_mounts()
        self.write("/proc/cmdline", "root=/dev/mmcblk0p2")
        self.assert_blocked("mmcblk0")
        usb = self.device()
        self.assertTrue(usb["eligible"])
        self.assertEqual(usb["identity"], IDENTITY)
        self.assertEqual(usb["sizeBytes"], 8589934592)
        self.assertTrue(self.device("mmcblk1")["eligible"])

    def test_non_system_emmc_is_always_blocked(self):
        self.disk("mmcblk1", "179:8", "mmc", "1")
        self.assert_blocked("mmcblk1", "mmc")

    def test_removable_sd_is_eligible_but_nonremovable_sd_is_not(self):
        self.disk("mmcblk1", "179:8", "sd")
        self.assertTrue(self.device("mmcblk1")["eligible"])
        self.attr("mmcblk1", "removable", "0")
        self.assert_blocked("mmcblk1")

    def test_fixed_usb_connection_is_blocked(self):
        self.write("/sys/devices/platform/usb-sda/1-1/removable", "fixed")
        self.assert_blocked(reason="fixed")

    def test_hardwired_usb_port_overrides_removable_media(self):
        self.write("/sys/devices/platform/usb-sda/1-1/port/connect_type", "hardwired")
        self.assert_blocked(reason="fixed")

    def test_usb_ssd_unknown_location_is_eligible_with_warning(self):
        self.attr("sda", "removable", "0")
        self.write("/sys/devices/platform/usb-sda/1-1/removable", "unknown")
        device = self.device()
        self.assertTrue(device["eligible"])
        self.assertEqual(device["connection"], "unknown")
        self.assertTrue(device["warnings"])

    def test_fixed_root_hub_does_not_make_external_usb_ports_internal(self):
        self.link("/sys/devices/platform/usb-sda/subsystem", "/sys/bus/usb")
        self.write("/sys/devices/platform/usb-sda/devpath", "0")
        self.write("/sys/devices/platform/usb-sda/removable", "fixed")
        self.assertTrue(self.device()["eligible"])
        self.write("/sys/devices/platform/usb-sda/1-1/removable", "unknown")
        self.assertTrue(self.device()["eligible"])
        self.assertEqual(self.device()["connection"], "unknown")

    def test_sd_name_without_usb_ancestry_does_not_establish_transport(self):
        self.disk("sdb", "8:16", "unknown")
        self.assert_blocked("sdb", "transport")

    def test_multiple_eligible_disks_never_set_a_target(self):
        self.disk("sdb", "8:16")
        result = self.run_shell('storage_inventory; printf "\\n%s" "$STORAGE_TARGET_PATH"')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines()[-1], "")
        self.assertEqual(len(self.inventory()["devices"]), 2)

    def test_literal_partlabel_and_partuuid_protect_exact_physical_disk(self):
        self.disk("sdb", "8:16")
        self.partition(label="sys[1].*", uuid="abc-123")
        self.partition("sdb", "sdb1", "8:17", label="sys1anything", uuid="def-456")
        for reference in ("PARTLABEL=sys[1].*", "PARTUUID=abc-123"):
            with self.subTest(reference=reference):
                self.write("/proc/cmdline", f"root={reference}")
                self.assert_blocked(reason="system")
                self.assertTrue(self.device("sdb")["eligible"])

    def test_duplicate_literal_partlabel_is_global_error(self):
        self.disk("sdb", "8:16")
        self.partition(label="sys[1].*")
        self.partition("sdb", "sdb1", "8:17", label="sys[1].*")
        self.write("/proc/cmdline", "root=PARTLABEL=sys[1].*")
        self.assert_global_error()

    def test_partition_root_probe_requires_a_canonical_matching_node(self):
        self.disk("sdb", "8:16")
        self.partition(label="system")
        self.partition("sdb", "sdb1", "8:17", label="other")
        (self.root / "dev/sda1").unlink()
        self.link("/dev/sda1", "/dev/sdb1")
        self.write("/proc/cmdline", "root=PARTLABEL=system")
        self.assert_global_error()

    def test_unresolved_partition_metadata_is_global_error(self):
        self.partition()
        self.write("/proc/cmdline", "root=PARTUUID=missing")
        self.write("/metadata/fail", "1")
        self.assert_global_error()

    def test_root_alias_and_mount_major_minor_protect_disk(self):
        self.partition()
        self.link("/dev/root", "/dev/sda1")
        self.link("/dev/disk/by-id/system", "/dev/sda1")
        for root in ("/dev/root", "/dev/disk/by-id/system"):
            with self.subTest(root=root):
                self.mounts = ["1 0 8:1 / / rw - ext4 /dev/root rw"]
                self.sync_mounts()
                self.write("/proc/cmdline", f"root={root}")
                self.assert_blocked(reason="system")

    def test_unresolved_dev_root_alias_uses_mounted_block_identity(self):
        self.partition()
        self.mounts = ["1 0 8:1 / / rw - ext4 /dev/root rw"]
        self.sync_mounts()
        self.write("/proc/cmdline", "root=/dev/root")
        self.assert_blocked(reason="system")

    def test_overlay_extroot_protects_all_backing_disks(self):
        self.partition()
        self.disk("sdb", "8:16")
        self.partition("sdb", "sdb1", "8:17")
        self.mounts = ["1 0 8:1 / /rom ro - squashfs /dev/sda1 ro",
                       "2 0 8:17 / /overlay rw - ext4 /dev/sdb1 rw",
                       "3 0 0:30 / / rw - overlay overlay rw,lowerdir=/rom,upperdir=/overlay/upper,workdir=/overlay/work"]
        self.sync_mounts()
        self.write("/proc/cmdline", "root=/dev/sda1")
        self.assert_blocked(reason="system")
        self.assert_blocked("sdb", "system")

    def test_unresolved_overlay_backing_storage_blocks_globally(self):
        self.mounts = ["1 0 0:30 / / rw - overlay overlay rw,lowerdir=/missing,upperdir=/missing/u"]
        self.sync_mounts()
        self.assert_global_error()

    def test_mapper_root_protects_slave_physical_disk(self):
        self.partition()
        path = self.disk("dm-0", "253:0", "unknown")
        self.link(f"{path}/slaves/sda1", self.paths["sda1"])
        self.mounts = ["1 0 253:0 / / rw - ext4 /dev/mapper/root rw"]
        self.sync_mounts()
        self.link("/dev/mapper/root", "/dev/dm-0")
        self.write("/proc/cmdline", "root=/dev/mapper/root")
        self.assert_blocked(reason="system")

    def test_loop_root_protects_file_backing_disk(self):
        self.partition()
        self.disk("loop0", "7:0", "unknown")
        self.attr("loop0", "loop/backing_file", "/backing/root.img")
        self.mounts = ["1 0 8:1 / /backing rw - ext4 /dev/sda1 rw",
                       "2 0 7:0 / / ro - squashfs /dev/loop0 ro"]
        self.sync_mounts()
        self.write("/proc/cmdline", "root=/dev/loop0")
        self.assert_blocked(reason="system")

    def test_loop_file_with_spaces_resolves_encoded_mountpoint_literally(self):
        self.partition()
        self.disk("loop0", "7:0", "unknown")
        self.attr("loop0", "loop/backing_file", "/backing USB/root.img")
        self.mounts = ["1 0 8:1 / /backing\\040USB rw - ext4 /dev/sda1 rw",
                       "2 0 7:0 / / ro - squashfs /dev/loop0 ro"]
        self.sync_mounts()
        self.write("/proc/cmdline", "root=/dev/loop0")
        self.assert_blocked(reason="system")

    def test_mount_display_decodes_only_proc_escapes(self):
        self.mounts.append("2 1 8:0 / /media\\040%BACKSLASH%\\134disk rw - ext4 /dev/sda rw")
        self.sync_mounts()
        self.assertEqual(self.assert_blocked()["mounts"], ["/media %BACKSLASH%\\disk"])

    def test_unresolved_mapper_and_loop_roots_block_globally(self):
        for name, mm in (("dm-0", "253:0"), ("loop0", "7:0")):
            with self.subTest(name=name):
                self.disk(name, mm, "unknown")
                self.mounts = [f"1 0 {mm} / / rw - ext4 /dev/{name} rw"]
                self.sync_mounts()
                self.write("/proc/cmdline", f"root=/dev/{name}")
                self.assert_global_error()

    def test_known_ubi_and_mtd_roots_leave_external_disks_eligible(self):
        self.assertTrue(self.device()["eligible"])
        self.mounts = ["1 0 31:4 / / ro - squashfs /dev/mtdblock4 ro"]
        self.sync_mounts()
        self.write("/proc/cmdline", "root=/dev/mtdblock4")
        self.assertTrue(self.device()["eligible"])

    def test_unproven_flash_root_is_not_assumed_safe(self):
        (self.root / "sys/class/ubi/ubi0/mtd_num").unlink()
        self.assert_global_error()

    def test_unresolved_block_root_and_malformed_mountinfo_block_globally(self):
        for mount in ("1 0 8:99 / / rw - ext4 /dev/missing rw", "malformed"):
            with self.subTest(mount=mount):
                self.mounts = [mount]
                self.sync_mounts()
                self.assert_global_error()

    def test_mounted_whole_disk_or_partition_is_ineligible(self):
        self.partition()
        for mm, name in (("8:0", "sda"), ("8:1", "sda1")):
            with self.subTest(name=name):
                self.mounts = [self.mounts[0], f"2 1 {mm} / /media rw - ext4 /dev/{name} rw"]
                self.sync_mounts()
                device = self.assert_blocked(reason="mounted")
                self.assertIn("/media", device["mounts"])

    def test_swap_alias_and_swapfile_protect_physical_disk(self):
        self.partition()
        self.link("/dev/swap-alias", "/dev/sda1")
        self.write("/proc/swaps", "Filename Type Size Used Priority\n/dev/swap-alias partition 100 0 -2\n")
        device = self.assert_blocked(reason="swap")
        self.assertTrue(device["swaps"])
        self.mounts.append("2 1 8:1 / /data rw - ext4 /dev/sda1 rw")
        self.sync_mounts()
        self.write("/proc/swaps", "Filename Type Size Used Priority\n/data/swapfile file 100 0 -2\n")
        self.assertTrue(self.assert_blocked()["swaps"])

    def test_unknown_swap_backing_blocks_globally(self):
        self.write("/proc/swaps", "Filename Type Size Used Priority\n/dev/missing partition 100 0 -2\n")
        self.assert_global_error()

    def test_holders_on_disk_or_partition_are_blocked(self):
        self.partition()
        for name in ("sda", "sda1"):
            with self.subTest(name=name):
                self.attr(name, "holders/dm-1", "held")
                self.assert_blocked(reason="held")
                (self.root / self.paths[name].lstrip("/") / "holders/dm-1").unlink()

    def test_readonly_disk_or_partition_is_blocked(self):
        self.partition()
        for name in ("sda", "sda1"):
            with self.subTest(name=name):
                self.attr(name, "ro", "1")
                self.assert_blocked(reason="read-only")
                self.attr(name, "ro", "0")

    def test_malformed_missing_identity_and_capacity_metadata_are_rejected(self):
        for attribute, value in (("diskseq", ""), ("diskseq", "0"), ("diskseq", "1;id"),
                                 ("size", "bad"), ("dev", "8:x"), ("ro", ""),
                                 ("removable", "garbage")):
            with self.subTest(attribute=attribute, value=value):
                original = (self.root / self.paths["sda"].lstrip("/") / attribute).read_text()
                self.attr("sda", attribute, value)
                self.assert_blocked()
                state, _ = self.validate()
                self.assertNotEqual(state[0], "0")
                self.attr("sda", attribute, original)
        self.write("/proc/sys/kernel/random/boot_id", "not-a-boot-id")
        self.assert_blocked(reason="identity")

    def test_too_small_disk_cannot_fit_swap_and_ext4(self):
        self.attr("sda", "size", "2097152")
        self.assert_blocked(reason="small")

    def test_partition_metadata_is_shown_without_implying_empty_disk(self):
        self.partition()
        device = self.device()
        self.assertTrue(device["eligible"])
        self.assertEqual(device["partitions"][0]["path"], "/dev/sda1")
        self.assertEqual(device["partitions"][0]["sizeBytes"], 2147483648)

    def test_sd_mount_and_config_conflicts_block_every_device(self):
        self.mounts.append("2 1 0:21 / /sd rw - tmpfs tmpfs rw")
        self.sync_mounts()
        self.assert_global_error()
        self.mounts.pop()
        self.sync_mounts()
        self.write("/etc/config/fstab", "fstab.data=mount\nfstab.data.target='/sd'\n")
        self.assert_global_error()

    def test_json_escapes_untrusted_display_strings_without_evaluation(self):
        model = 'Disk "quoted"\\path\tline\n$(fdisk /dev/never)\x01'
        self.attr("sda", "device/model", model)
        self.assertEqual(self.device()["model"], model)

    def test_valid_selection_sets_only_canonical_target_state(self):
        state, stderr = self.validate()
        self.assertEqual(stderr, "")
        self.assertEqual(state, ["0", "sda", "/dev/sda", IDENTITY])

    def test_missing_forged_or_unsafe_selection_never_sets_target(self):
        for args in ((), ("sda",), ("sda", IDENTITY), ("sda", IDENTITY, "/dev/sda", "extra"),
                     ("../sda", IDENTITY, "/dev/sda"), ("/dev/sda", IDENTITY, "/dev/sda"),
                     ("sda1", IDENTITY, "/dev/sda1"), ("missing", IDENTITY, "/dev/missing"),
                     ("sda", "forged", "/dev/sda"), ("sda", IDENTITY, "/dev/sdb"),
                     ("sda", IDENTITY, ""), ("sda;id", IDENTITY, "/dev/sda")):
            with self.subTest(args=args):
                state, _ = self.validate(args, 'STORAGE_TARGET_ID=stale; STORAGE_TARGET_PATH=stale; STORAGE_TARGET_IDENTITY=stale')
                self.assertNotEqual(state[0], "0")
                self.assertEqual(state[1:], ["", "", ""])

    def test_identity_reuse_or_new_usage_cannot_reuse_old_selection(self):
        self.assertEqual(self.device()["identity"], IDENTITY)
        for attribute, value in (("diskseq", "13"), ("size", "16777217"), ("dev", "8:16")):
            with self.subTest(attribute=attribute):
                original = (self.root / self.paths["sda"].lstrip("/") / attribute).read_text()
                self.attr("sda", attribute, value)
                state, _ = self.validate()
                self.assertNotEqual(state[0], "0")
                self.assertEqual(state[1:], ["", "", ""])
                self.attr("sda", attribute, original)
        self.attr("sda", "ro", "1")
        self.assertNotEqual(self.validate()[0][0], "0")

    def test_identity_change_during_validation_is_rejected(self):
        extra = r'''
storage_read_file() {
    case "$1" in */sda/diskseq)
        if [ -e "$FX/sequence-read" ]; then printf '13'; else
            printf 'seen' > "$FX/sequence-read"; printf '12'
        fi;;
    *) cat "$FX$1";; esac
}
'''
        state, _ = self.validate(extra=extra)
        self.assertNotEqual(state[0], "0")
        self.assertEqual(state[1:], ["", "", ""])

    def test_canonical_target_node_must_match_sysfs_major_minor(self):
        self.write("/rdev/sda", "8:16")
        self.assert_blocked(reason="identity")
        self.assertNotEqual(self.validate()[0][0], "0")

    def test_target_device_path_cannot_alias_another_disk(self):
        self.disk("sdb", "8:16")
        (self.root / "dev/sda").unlink()
        self.link("/dev/sda", "/dev/sdb")
        self.assert_blocked(reason="identity")

    def test_inventory_rejects_identity_change_within_one_snapshot(self):
        extra = r'''
storage_read_file() {
    case "$1" in */sda/diskseq)
        if [ -e "$FX/sequence-read" ]; then printf '13'; else
            printf 'seen' > "$FX/sequence-read"; printf '12'
        fi;;
    *) cat "$FX$1";; esac
}
'''
        result = self.run_shell("storage_inventory", extra)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(json.loads(result.stdout)["devices"][0]["eligible"])

    def test_partition_number_metadata_cannot_be_malformed(self):
        self.partition()
        self.attr("sda1", "partition", "not-a-number")
        self.assert_blocked()

    def test_duplicate_partuuid_is_global_error(self):
        self.disk("sdb", "8:16")
        self.partition(uuid="abc-123")
        self.partition("sdb", "sdb1", "8:17", uuid="abc-123")
        self.write("/proc/cmdline", "root=PARTUUID=abc-123")
        self.assert_global_error()

    def test_ubi_volume_node_is_known_flash_only_with_mtd_evidence(self):
        self.write("/sys/class/ubi/ubi0_1/mtd_num", "4")
        self.mounts = ["1 0 0:20 / / rw - ubifs /dev/ubi0_1 rw"]
        self.sync_mounts()
        self.write("/proc/cmdline", "root=/dev/ubi0_1")
        self.assertTrue(self.device()["eligible"])

    def test_fstab_sd_subdirectory_conflicts_are_not_ignored(self):
        self.write("/etc/config/fstab", "fstab.data=mount\nfstab.data.target='/sd/existing'\n")
        self.assert_global_error()

    def test_real_partition_reader_uses_lowlevel_blkid_partition_tags_on_fixture_only(self):
        probe = self.root / "commands/blkid"
        probe.write_text('''#!/bin/sh
[ "$#" = 6 ] && [ "$1" = -p ] && [ "$2" = -s ] && [ "$4" = -o ] && [ "$5" = value ] || exit 96
[ "$6" = "$FX/dev/sda" ] || exit 96
case "$3" in PART_ENTRY_UUID) printf 'abc-123';; PART_ENTRY_NAME) printf 'sys[1].*';; *) exit 96;; esac
''')
        # Restore production readers, then call only the probe with a fixture file.
        result = self.run_shell('storage_partition_value "$FX/dev/sda" PARTUUID; printf "\\n"; '
                                'storage_partition_value "$FX/dev/sda" PARTLABEL',
                                f'. {shlex.quote(str(COMMON))}\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "abc-123\nsys[1].*")

    def test_nonzero_partition_probe_is_incomplete_evidence(self):
        probe = self.root / "commands/blkid"
        probe.write_text('''#!/bin/sh
[ "$#" = 6 ] && [ "$6" = "$FX/dev/sda" ] || exit 96
exit 2
''')
        result = self.run_shell('storage_partition_value "$FX/dev/sda" PARTUUID',
                                f'. {shlex.quote(str(COMMON))}\n')
        self.assertNotEqual(result.returncode, 0)

    def test_missing_proc_usage_evidence_blocks_globally(self):
        for path in ("proc/self/mountinfo", "proc/swaps", "proc/cmdline"):
            with self.subTest(path=path):
                target = self.root / path
                original = target.read_text()
                target.unlink()
                self.assert_global_error()
                target.write_text(original)

    def test_empty_or_ambiguous_root_references_are_not_ignored(self):
        for root in ("root=", "root=ubi0:rootfs root=ubi0:rootfs"):
            with self.subTest(root=root):
                self.write("/proc/cmdline", root)
                self.assert_global_error()

    def test_multiline_boot_identity_is_not_shell_safe(self):
        self.write("/proc/sys/kernel/random/boot_id", BOOT + "\ninjected")
        self.assert_blocked(reason="identity")
        self.assertNotEqual(self.validate()[0][0], "0")

    def test_missing_holders_and_partition_capacity_evidence_blocks_disk(self):
        holders = self.root / self.paths["sda"].lstrip("/") / "holders"
        holders.rmdir()
        self.assert_blocked()
        holders.mkdir()
        self.partition()
        self.attr("sda1", "size", "bad")
        self.assert_blocked()

    def test_busy_disk_cannot_use_an_otherwise_matching_identity(self):
        self.partition()
        for busy in ("mount", "swap", "holder"):
            with self.subTest(busy=busy):
                if busy == "mount":
                    self.mounts.append("2 1 8:1 / /media rw - ext4 /dev/sda1 rw")
                    self.sync_mounts()
                elif busy == "swap":
                    self.write("/proc/swaps", "Filename Type Size Used Priority\n/dev/sda1 partition 100 0 -2\n")
                else:
                    self.attr("sda", "holders/dm-1", "held")
                state, _ = self.validate()
                self.assertNotEqual(state[0], "0")
                self.assertEqual(state[1:], ["", "", ""])
                if busy == "mount":
                    self.mounts.pop()
                    self.sync_mounts()
                elif busy == "swap":
                    self.write("/proc/swaps", "Filename Type Size Used Priority\n")

    def test_orphan_partition_is_an_incomplete_global_topology(self):
        self.partition()
        link = self.root / "sys/class/block/sda1"
        link.unlink()
        self.write("/sys/devices/orphan/sda1/partition", "1")
        self.link("/sys/class/block/sda1", "/sys/devices/orphan/sda1")
        self.assert_global_error()

    def test_real_rdev_reader_parses_stat_hex_on_fixture_only(self):
        probe = self.root / "commands/stat"
        probe.write_text('''#!/bin/sh
[ "$#" = 4 ] && [ "$1" = -L ] && [ "$2" = -c ] && [ "$3" = '%t:%T' ] && [ "$4" = "$FX/dev/sda" ] || exit 96
printf '8:10'
''')
        probe.chmod(0o755)
        extra = f'. {shlex.quote(str(COMMON))}\n' + r'''
storage_is_block() { [ "$1" = "$FX/dev/sda" ]; }
'''
        result = self.run_shell('storage_block_mm "$FX/dev/sda"', extra)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "8:16\n")

    def test_inventory_with_no_devices_is_valid_and_cannot_select(self):
        (self.root / "sys/class/block/sda").unlink()
        self.assertEqual(self.inventory(), {"devices": [], "error": None})
        self.assertNotEqual(self.validate()[0][0], "0")

    def test_cli_defaults_to_readonly_inventory_and_rejects_arguments(self):
        # Install the unchanged entry point beside a fixture-only sourced adapter.
        entry = self.root / "cli/storage-devices.sh"
        entry.parent.mkdir()
        entry.write_bytes(CLI.read_bytes())
        adapter = entry.parent / "storage-common.sh"
        adapter.write_text(f". {shlex.quote(str(COMMON))}\n" + self.readers)
        result = subprocess.run(["sh", str(entry)], env=self.env, text=True,
                                capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)["devices"][0]["eligible"])
        for args in (("format",), ("--fixture", str(self.root)), ("sda", IDENTITY, "/dev/sda")):
            result = subprocess.run(["sh", str(entry), *args], env=self.env,
                                    text=True, capture_output=True, timeout=20)
            self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / "refused").exists())


if __name__ == "__main__":
    unittest.main()
