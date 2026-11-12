"""Final-review boundary regressions. All kernel/tool evidence is synthetic."""

import json
import shlex

from test_storage import COMMON, IDENTITY, StorageFixture
import test_formatting as formatting


class FinalPolicyTests(StorageFixture):
    def namespace(self, rows, root="/", pid="4321", tid=None):
        tid = tid or pid
        base = f"/proc/{pid}/task/{tid}"
        self.write(base + "/ns/mnt", "mnt:[200]")
        (self.root / root.lstrip("/")).mkdir(parents=True, exist_ok=True)
        self.link(base + "/root", root)
        self.write(base + "/mountinfo", "\n".join(rows) + "\n")
        return base

    def test_foreign_mount_uses_rdev_not_foreign_source_spelling(self):
        self.partition()
        self.disk("sdb", "8:16")
        # In the other root /dev/sdb means sda1. Never resolve that spelling here.
        self.namespace(["1 0 8:1 / /private rw - ext4 /dev/sdb rw"])
        self.assertFalse(self.device()["eligible"])
        self.assertEqual(self.device()["mounts"], ["/private"])
        self.assertTrue(self.device("sdb")["eligible"])

    def test_unrelated_private_namespace_keeps_usb_and_sd_eligible(self):
        self.disk("sdb", "8:16")
        self.disk("mmcblk1", "179:8", "sd")
        self.namespace(["1 0 8:16 / /private rw - ext4 /not-in-host-root rw",
                        "2 1 0:22 / /tmp rw - tmpfs tmpfs rw"])
        self.assertTrue(self.device()["eligible"])
        self.assertTrue(self.device("mmcblk1")["eligible"])
        self.assertFalse(self.device("sdb")["eligible"])

    def test_foreign_thread_namespace_is_not_hidden_by_process_leader(self):
        self.namespace(["1 0 0:22 / / rw - tmpfs tmpfs rw"])
        base = self.namespace(["1 0 8:0 / /private rw - ext4 /in-jail rw"], tid="4322")
        self.write(base + "/ns/mnt", "mnt:[201]")
        self.assertFalse(self.device()["eligible"])

    def test_missing_foreign_mountinfo_or_uncovered_chroot_refuses(self):
        base = self.namespace(["1 0 0:22 / / rw - tmpfs tmpfs rw"])
        file = self.root / (base + "/mountinfo").lstrip("/")
        file.unlink()
        self.assert_global_error()
        file.write_text("1 0 0:22 / / rw - tmpfs tmpfs rw\n")
        (self.root / (base + "/root").lstrip("/")).unlink()
        (self.root / "jail").mkdir()
        self.link(base + "/root", "/jail")
        self.assert_global_error()

    def test_chroot_process_allowed_when_full_root_representative_covers_namespace(self):
        self.namespace(["1 0 0:22 / / rw - tmpfs tmpfs rw"], root="/jail")
        self.namespace(["1 0 0:22 / / rw - tmpfs tmpfs rw"], pid="4323")
        self.assertTrue(self.device()["eligible"])

    def test_restricted_proc_or_noninitial_pid_view_refuses(self):
        path = self.root / "proc/self/mountinfo"
        original = path.read_text()
        path.write_text(original.replace("- proc proc rw", "- proc proc rw,hidepid=2"))
        self.assert_global_error()
        path.write_text(original)
        self.write("/proc/2/status", "Name:\tworker\nPid:\t2\nKthread:\t0\n")
        self.assert_global_error()

    def test_self_root_spelling_is_not_host_root_identity_proof(self):
        # readlink of self/root is '/' even inside a chroot. Initial PID
        # visibility does not make that chroot the host's full-root view.
        (self.root / "proc/self/root").unlink()
        (self.root / "jail").mkdir()
        self.link("/proc/self/root", "/jail")
        extra = r'''
storage_readlink() {
    case "$1" in */root) printf '/';; *) cat "$FX$1";; esac
}
'''
        result = self.run_shell("storage_inventory", extra)
        self.assertTrue(json.loads(result.stdout)["error"])

    def test_namespace_change_during_coverage_refuses(self):
        base = self.namespace(["1 0 0:22 / / rw - tmpfs tmpfs rw"])
        extra = r'''
storage_readlink() {
    case "$1" in */4321/ns/mnt)
        if [ -e "$FX/ns-read" ]; then printf 'mnt:[201]'; else
            printf seen > "$FX/ns-read"; cat "$FX$1"
        fi;;
    *) cat "$FX$1";; esac
}
'''
        result = self.run_shell("storage_inventory", extra)
        self.assertTrue(json.loads(result.stdout)["error"], base)

    def test_new_namespace_in_second_scan_is_not_silently_ignored(self):
        extra = r'''
storage_list_dir() {
    if [ "$1" = /proc ]; then
        if [ -e "$FX/proc-scanned" ]; then
            printf '%s\n' 2 4321
        else printf seen > "$FX/proc-scanned"; printf '2\n'; fi
    else
        [ -d "$FX$1" ] || return 1
        for entry in "$FX$1"/*; do
            [ -e "$entry" ] || [ -L "$entry" ] || continue
            printf '%s\n' "${entry##*/}"
        done
    fi
}
'''
        self.namespace(["1 0 8:0 / /private rw - ext4 /in-jail rw"])
        result = self.run_shell("storage_inventory", extra)
        self.assertTrue(json.loads(result.stdout)["error"])

    def test_foreign_unknown_anonymous_backing_is_not_assumed_unrelated(self):
        self.namespace(["1 0 0:30 / / rw - overlay overlay rw,lowerdir=/hidden"])
        self.assert_global_error()

    def test_foreign_flash_source_path_is_not_host_character_identity_proof(self):
        # A jail may bind a different UBI character node at this spelling.
        # Unlike a block mount, anonymous UBIFS has no physical rdev in field 3.
        self.namespace(["1 0 0:80 / / rw - ubifs /dev/ubi0_1 rw"])
        self.assert_global_error()

    def test_foreign_proven_flash_superblock_keeps_external_storage_eligible(self):
        self.namespace(["1 0 0:20 / / rw - ubifs ubi0:rootfs rw"])
        self.assertTrue(self.device()["eligible"])

    def test_unreadable_live_thread_namespace_refuses_but_dead_tasks_do_not(self):
        base = self.namespace(["1 0 0:22 / / rw - tmpfs tmpfs rw"])
        (self.root / (base + "/ns/mnt").lstrip("/")).unlink()
        self.assert_global_error()
        self.write(base + "/status", "Pid:\t4321\nState:\tZ (zombie)\nKthread:\t0\n")
        self.assertTrue(self.device()["eligible"])

    def test_unmounted_configured_loop_marks_backing_disk_held(self):
        self.partition()
        self.disk("sdb", "8:16")
        self.disk("loop0", "7:0", "unknown", sysfs_path="/sys/devices/virtual/block/loop0")
        self.attr("loop0", "loop/backing_file", "/dev/sda1")
        self.assertFalse(self.device()["eligible"])
        self.assertNotEqual(self.validate()[0][0], "0")
        self.assertTrue(self.device("sdb")["eligible"])

    def test_unresolved_configured_loop_owner_refuses_globally(self):
        self.disk("loop0", "7:0", "unknown", sysfs_path="/sys/devices/virtual/block/loop0")
        self.attr("loop0", "loop/backing_file", "/not-visible/backing")
        self.assert_global_error()

    def test_apostrophe_alias_and_unsupported_uci_values_refuse(self):
        (self.root / "sd").mkdir()
        self.link("/owner'volume", "/sd")
        for value in ("'/owner'\\''volume'", "'/media' '/sd'", "'/media\n/sd'",
                      "'/media", "", "'/media'junk", "'/$(fdisk /dev/never)' '/sd'"):
            with self.subTest(value=value):
                self.write("/etc/config/fstab", f"fstab.owner=mount\nfstab.owner.target={value}\n")
                self.assert_global_error()

    def test_nested_hubs_use_only_storage_attachment_location(self):
        ancestor = "/sys/devices/platform/usb1/1-1/1-1.2"
        self.disk("sdb", "8:16", sysfs_path=ancestor + "/1-1.2:1.0/host0/block/sdb")
        for path, devpath in (("/sys/devices/platform/usb1", "0"),
                              ("/sys/devices/platform/usb1/1-1", "1"), (ancestor, "1.2")):
            self.link(path + "/subsystem", "/sys/bus/usb")
            self.write(path + "/devpath", devpath)
            self.write(path + "/uevent", "DEVTYPE=usb_device\n")
            self.write(path + "/removable", "fixed")
        self.link(ancestor + "/1-1.2:1.0/subsystem", "/sys/bus/usb")
        self.write(ancestor + "/1-1.2:1.0/uevent", "DEVTYPE=usb_interface\n")
        for location, eligible, warning in (("removable", True, False), ("unknown", True, True), ("fixed", False, False)):
            with self.subTest(location=location):
                self.write(ancestor + "/removable", location)
                device = self.device("sdb")
                self.assertEqual(device["eligible"], eligible)
                self.assertEqual(bool(device["warnings"]), warning)

    def test_dos_capacity_limit_includes_exact_2tib_but_not_larger_4kn(self):
        self.attr("sda", "size", "4294967296")
        self.assertTrue(self.device()["eligible"])
        self.attr("sda", "size", "4294967297")
        self.write(self.paths["sda"] + "/queue/logical_block_size", "4096")
        self.assertFalse(self.device()["eligible"])

    def test_stock_rdev_reader_uses_decimal_ls_without_stat(self):
        self.stock_ls()
        extra = f". {shlex.quote(str(COMMON))}\n" + r'''
storage_is_block() { [ "$1" = "$FX/dev/sda" ]; }
'''
        result = self.run_shell('storage_block_mm "$FX/dev/sda"', extra)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "8:16\n")

    def test_missing_stock_rdev_primitive_explains_inventory_refusal(self):
        path = self.root / "commands/ls"
        path.write_text("#!/bin/sh\nexit 127\n")
        device = self.device()
        self.assertFalse(device["eligible"])
        self.assertIn("ls -dnL", device["reason"])

    def stock_ls(self, response="brw------- 1 0 0 8, 16 Nov 12 00:00 device"):
        self.write("/ls-output", response)
        path = self.root / "commands/ls"
        path.write_text('''#!/bin/sh
[ "$#" = 2 ] && [ "$1" = -dnL ] && [ "$2" = "$FX/dev/sda" ] || exit 96
cat "$FX/ls-output"
''')
        path.chmod(0o755)
        path = self.root / "commands/stat"
        path.write_text("#!/bin/sh\nexit 127\n")
        path.chmod(0o755)

    def test_rdev_reader_refuses_missing_malformed_and_multiline_ls(self):
        self.stock_ls()
        for output in ("", "-rw------- 1 0 0 8, 16 Nov 12 00:00 device",
                       "brw------- 1 root root 8, 16 Nov 12 00:00 device",
                       "brw------- 1 0 0 8, zz Nov 12 00:00 device",
                       "brw------- 1 0 0 8, 16 Nov 12 00:00 device\nextra"):
            with self.subTest(output=output):
                self.write("/ls-output", output)
                result = self.run_shell('storage_rdev_mm "$FX/dev/sda"')
                self.assertNotEqual(result.returncode, 0)


class FinalBoundaryTests(formatting.FormattingFixture):
    def test_all_new_prewrite_vetoes_protect_both_entrypoints(self):
        for mutation in ("foreign-mount", "configured-loop", "quoted-alias"):
            for entry in ("format-device.sh", "auto-setup.sh"):
                with self.subTest(mutation=mutation, entry=entry):
                    try:
                        self.write("/collect-mutation", mutation)
                        self.write("/collect-at", "1")
                        result = self.invoke(entry)
                        self.assert_failed(result)
                        self.assertEqual(self.writers(), [])
                    finally:
                        self.reset_final()

    def test_matching_identity_above_2tib_refuses_before_any_writer(self):
        self.attr("sda", "size", "4294967297")
        self.attr("sda", "queue/logical_block_size", "4096")
        identity = IDENTITY.rsplit(":", 1)[0] + ":4294967297"
        for entry in ("format-device.sh", "auto-setup.sh"):
            with self.subTest(entry=entry):
                result = self.invoke(entry, ("sda", identity, "/dev/sda"))
                self.assert_failed(result)
                self.assertIn("2 TiB", result.stderr)
                self.assertEqual(self.writers(), [])

    def test_missing_numeric_ls_refuses_both_entrypoints_before_fdisk(self):
        (self.root / "commands/ls").write_text("#!/bin/sh\nexit 127\n")
        for entry in ("format-device.sh", "auto-setup.sh"):
            with self.subTest(entry=entry):
                result = self.invoke(entry)
                self.assert_failed(result)
                self.assertIn("ls -dnL", result.stderr)
                self.assertEqual(self.writers(), [])

    def test_fixed_intermediate_hub_does_not_block_either_entrypoint(self):
        hub = "/sys/devices/platform/usb-sda"
        self.link(hub + "/subsystem", "/sys/bus/usb")
        self.write(hub + "/devpath", "1")
        self.write(hub + "/uevent", "DEVTYPE=usb_device\n")
        self.write(hub + "/removable", "fixed")
        for entry in ("format-device.sh", "auto-setup.sh"):
            with self.subTest(entry=entry):
                result = self.invoke(entry)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(self.writers()[:3], [["fdisk", "/dev/sda"], ["mkswap", "/dev/sda1"],
                                                    ["mkfs.ext4", "-F", "/dev/sda2"]])
                self.reset_final()

    def test_unrelated_foreign_namespace_does_not_block_either_entrypoint(self):
        base = "/proc/4321/task/4321"
        self.write(base + "/ns/mnt", "mnt:[200]")
        self.link(base + "/root", "/")
        self.write(base + "/mountinfo", "1 0 8:16 / /private rw - ext4 /jail-only-device rw\n")
        for entry in ("format-device.sh", "auto-setup.sh"):
            with self.subTest(entry=entry):
                result = self.invoke(entry)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(self.writers()[:3], [["fdisk", "/dev/sda"], ["mkswap", "/dev/sda1"],
                                                    ["mkfs.ext4", "-F", "/dev/sda2"]])
                self.reset_mutation()
                self.write("/config/fstab", "# unrelated\n")
                (self.root / "calls").unlink()

    def reset_final(self):
        self.reset_mutation()
        self.write("/config/fstab", "# unrelated\n")
        for path in ("proc/4321/task/4321/mountinfo", "proc/4321/task/4321/ns/mnt",
                     "proc/4321/task/4321/root", "sys/class/block/loop0",
                     "sys/dev/block/7:0", "owner'volume"):
            (self.root / path).unlink(missing_ok=True)
        # Remove only fixture directories created by the foreign-mount double.
        for path in ("proc/4321/task/4321/ns", "proc/4321/task/4321", "proc/4321/task", "proc/4321"):
            directory = self.root / path
            if directory.exists():
                directory.rmdir()
        (self.root / "calls").unlink(missing_ok=True)

    def test_new_namespace_or_loop_before_later_writers_stops_next_writer(self):
        for mutation in ("foreign-mount", "configured-loop"):
            for stage, expected in (("sleep", ["fdisk"]), ("mkswap", ["fdisk", "mkswap"])):
                for entry in ("format-device.sh", "auto-setup.sh"):
                    with self.subTest(mutation=mutation, stage=stage, entry=entry):
                        try:
                            self.write(f"/{stage}-mutation", mutation)
                            self.assert_failed(self.invoke(entry))
                            self.assertEqual([call[0] for call in self.writers()], expected)
                        finally:
                            self.reset_final()

    def test_fresh_namespace_and_loop_coverage_before_activation(self):
        for mutation in ("foreign-mount", "configured-loop"):
            with self.subTest(mutation=mutation):
                try:
                    self.write("/mv-mutation", mutation)
                    result = self.invoke("post-format.sh", ("sda", IDENTITY, "/dev/sda", "/dev/sda1", "/dev/sda2"))
                    self.assert_failed(result)
                    self.assertEqual(self.writers(), [])
                finally:
                    self.reset_final()
                    (self.root / "mv-mutation").unlink()
                    self.write("/config/fstab", "# unrelated\n")

    def test_busybox_missing_or_nonuuid_writer_refuses_before_fdisk(self):
        for mode in ("busybox", "missing", "no-uuid", "no-libuuid"):
            for entry in ("format-device.sh", "auto-setup.sh"):
                with self.subTest(mode=mode, entry=entry):
                    try:
                        self.write("/swap-writer-mode", mode)
                        self.assert_failed(self.invoke(entry))
                        self.assertEqual(self.writers(), [])
                    finally:
                        self.reset_final()

    def test_uuid_capable_explicit_writer_preflight_then_selected_write(self):
        result = self.invoke("format-device.sh")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.calls()
        self.assertIn(["mkswap-capability", "--version"], calls)
        preflight = calls.index(["mkswap-capability", "--version"])
        self.assertLess(preflight, calls.index(["fdisk", "/dev/sda"]))
        self.assertIn(["mkswap-capability", "--help"], calls[:calls.index(["fdisk", "/dev/sda"])])

    def test_zero_uuid_never_enters_selected_configuration(self):
        self.write("/bad-swap-probe", '/dev/sda1: UUID="00000000-0000-0000-0000-000000000000" TYPE="swap"')
        result = self.invoke("post-format.sh", ("sda", IDENTITY, "/dev/sda", "/dev/sda1", "/dev/sda2"))
        self.assert_failed(result)
        self.assertEqual(self.writers(), [])
