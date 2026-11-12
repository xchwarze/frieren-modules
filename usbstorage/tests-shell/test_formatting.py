"""Guarded execution tests: ordinary fixture files and refusing command doubles only."""

import json
from pathlib import Path
import shlex
import subprocess
import sys
import time
import unittest

from test_storage import BOOT, COMMON, IDENTITY, MODULE, StorageFixture


class FormattingTests(StorageFixture):
    def setUp(self):
        super().setUp()
        self.disk("sdb", "8:16")
        self.entry = self.root / "cli"
        self.entry.mkdir()
        for name in ("auto-setup.sh", "format-device.sh", "post-format.sh"):
            (self.entry / name).write_bytes((MODULE / "public/bin" / name).read_bytes())
        (self.entry / "storage-common.sh").write_text(
            f". {shlex.quote(str(COMMON))}\n" + self.readers + r'''
storage_read_file() {
    [ "$1" != /proc/self/mountinfo ] || fx-collect /proc/self/mountinfo || return 1
    cat "$FX$1"
}
''')
        library = MODULE / "public/bin/storage-format.sh"
        if library.exists():
            (self.entry / "storage-format.sh").write_text(
                f". {shlex.quote(str(library))}\n" + r'''
storage_lock_path() { printf '%s\n' "$FX/setup.lock"; }
storage_fstab_path() { printf '%s\n' "$FX/config/fstab"; }
storage_install_environment() { fx-environment "$@"; }
''')
        self.partition(name="sda1")
        self.partition(name="sda2", mm="8:2", number=2)
        self.attr("sda1", "start", "2048")
        self.attr("sda1", "size", "2097152")
        self.attr("sda2", "start", "2099200")
        self.attr("sda2", "size", "14678016")
        self.write("/config/fstab", "# Keep this spacing and comment.\nconfig mount 'other'\n\toption target '/media'\n\toption uuid 'unrelated'\n\nconfig swap 'other_swap'\n\toption uuid 'unrelated-swap'\n\toption enabled '1'\n")
        (self.root / "media").mkdir()
        self.write("/etc/config/fstab", "fstab.other=mount\nfstab.other.target='/media'\nfstab.other.uuid='unrelated'\nfstab.other_swap=swap\nfstab.other_swap.uuid='unrelated-swap'\n")
        self.write("/allowed-devices", "sda\nsda1\nsda2\n")
        self.write("/selected-name", "sda")
        self.write("/disk-path", self.paths["sda"])
        self.write("/swap-name", "sda1")
        self.write("/data-name", "sda2")
        double = self.root / "commands/double"
        double.write_text(f"#!{sys.executable}\n" + DOUBLE)
        double.chmod(0o755)
        for name in ("fdisk", "mkswap", "mkfs.ext4", "mount", "swapon", "block",
                     "sleep", "sync", "fx-collect", "fx-environment", "mkdir", "rmdir",
                     "cp", "mv", "rm", "mktemp"):
            path = self.root / "commands" / name
            if path.exists():
                path.unlink()
            path.symlink_to("double")

    def invoke(self, entry="auto-setup.sh", args=None, background=False):
        if args is None:
            args = ("sda", IDENTITY, "/dev/sda")
        command = ["sh", str(self.entry / entry), *args]
        if background:
            return subprocess.Popen(command, env=self.env, text=True,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        result = subprocess.run(command, env=self.env, text=True, capture_output=True, timeout=25)
        self.assertFalse((self.root / "refused").exists(), result.stderr)
        return result

    def calls(self):
        log = self.root / "calls"
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    def writers(self):
        return [call for call in self.calls() if call[0] in ("fdisk", "mkswap", "mkfs.ext4", "mount", "swapon")]

    def assert_failed(self, result):
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertNotIn("completed successfully", result.stdout.lower())
        self.assertFalse((self.root / "setup.lock").exists(), result.stderr)

    def test_both_entrypoints_require_exact_explicit_selection(self):
        for entry in ("auto-setup.sh", "format-device.sh"):
            for args in ((), ("/dev/sda",), ("sda", IDENTITY),
                         ("sda", IDENTITY, "/dev/sda", "extra"),
                         ("../sda", IDENTITY, "/dev/sda"),
                         ("sda", "forged", "/dev/sda"),
                         ("sda", IDENTITY.replace(":12:", ":13:"), "/dev/sda"),
                         ("sda", IDENTITY, "/dev/sdb")):
                with self.subTest(entry=entry, args=args):
                    self.assert_failed(self.invoke(entry, args))
                    self.assertEqual(self.writers(), [])

    def test_direct_format_returns_only_selected_real_partitions_without_activation(self):
        result = self.invoke("format-device.sh")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual(self.writers(), [["fdisk", "/dev/sda"], ["mkswap", "/dev/sda1"],
                                         ["mkfs.ext4", "-F", "/dev/sda2"]])
        self.assertIn("/dev/sda1", result.stdout)
        self.assertIn("/dev/sda2", result.stdout)
        self.assertFalse((self.root / "setup.lock").exists())

    def test_setup_preserves_unrelated_fstab_bytes_and_uses_only_selected_uuids(self):
        original = (self.root / "config/fstab").read_bytes()
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        configured = (self.root / "config/fstab").read_bytes()
        self.assertTrue(configured.startswith(original))
        self.assertIn(b"11111111-1111-1111-1111-111111111111", configured)
        self.assertIn(b"22222222-2222-2222-2222-222222222222", configured)
        self.assertEqual(self.writers()[:3], [["fdisk", "/dev/sda"], ["mkswap", "/dev/sda1"],
                                            ["mkfs.ext4", "-F", "/dev/sda2"]])
        self.assertFalse((self.root / "setup.lock").exists())

    def test_unsafe_or_small_target_never_reaches_partition_writer(self):
        for mutation in ("mounted", "swapped", "held", "readonly", "replaced", "unavailable", "small", "sd-owner"):
            for entry in ("auto-setup.sh", "format-device.sh"):
                with self.subTest(entry=entry, mutation=mutation):
                    self.write("/collect-mutation", mutation)
                    self.write("/collect-at", "1")
                    self.assert_failed(self.invoke(entry))
                    self.assertEqual(self.writers(), [])
                    self.reset_mutation()

    def reset_mutation(self):
        for file in ("collect-count", "collect-mutation", "collect-at", "sleep-mutation",
                     "mkswap-mutation", "mkfs.ext4-mutation"):
            (self.root / file).unlink(missing_ok=True)
        self.attr("sda", "diskseq", "12")
        self.attr("sda", "ro", "0")
        self.attr("sda", "size", "16777216")
        (self.root / self.paths["sda"].lstrip("/") / "holders/dm-1").unlink(missing_ok=True)
        if not (self.root / "sys/class/block/sda").exists():
            self.link("/sys/class/block/sda", self.paths["sda"])
        self.write("/proc/swaps", "Filename Type Size Used Priority\n")
        self.sync_mounts()
        self.write("/etc/config/fstab", "fstab.other=mount\nfstab.other.target='/media'\n")

    def test_rechecks_usage_and_identity_at_each_destructive_boundary(self):
        for stage, expected in (("collect", []), ("sleep", ["fdisk"]),
                                ("mkswap", ["fdisk", "mkswap"]),
                                ("mkfs.ext4", ["fdisk", "mkswap", "mkfs.ext4"])):
            for mutation in ("mounted", "swapped", "held", "readonly", "replaced", "unavailable"):
                for entry in ("auto-setup.sh", "format-device.sh"):
                    with self.subTest(stage=stage, mutation=mutation, entry=entry):
                        (self.root / "calls").unlink(missing_ok=True)
                        self.write(f"/{stage}-mutation", mutation)
                        if stage == "collect":
                            self.write("/collect-at", "2")
                        self.assert_failed(self.invoke(entry))
                        self.assertEqual([call[0] for call in self.writers()], expected)
                        self.reset_mutation()

    def test_writer_failures_propagate_and_lock_is_reusable(self):
        for failed, expected in (("fdisk", ["fdisk"]), ("mkswap", ["fdisk", "mkswap"]),
                                 ("mkfs.ext4", ["fdisk", "mkswap", "mkfs.ext4"])):
            with self.subTest(failed=failed):
                (self.root / "calls").unlink(missing_ok=True)
                self.write("/fail", failed)
                self.assert_failed(self.invoke())
                self.assertEqual([call[0] for call in self.writers()], expected)
        (self.root / "fail").unlink()
        self.assertEqual(self.invoke("format-device.sh").returncode, 0)

    def test_selected_sd_uses_kernel_partition_numbers_not_first_disk_or_path_suffix(self):
        self.disk("mmcblk1", "179:8", "sd")
        self.partition("mmcblk1", "mmcblk1p1", "179:9", number=1)
        self.partition("mmcblk1", "mmcblk1p2", "179:10", number=2)
        for name, start, size in (("mmcblk1p1", "2048", "2097152"),
                                  ("mmcblk1p2", "2099200", "14678016")):
            self.attr(name, "start", start)
            self.attr(name, "size", size)
        self.write("/selected-name", "mmcblk1")
        self.write("/swap-name", "mmcblk1p1")
        self.write("/data-name", "mmcblk1p2")
        self.write("/allowed-devices", "mmcblk1\nmmcblk1p1\nmmcblk1p2\n")
        identity = f"v1:{BOOT}:179:8:12:16777216"
        result = self.invoke("format-device.sh", ("mmcblk1", identity, "/dev/mmcblk1"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.writers(), [["fdisk", "/dev/mmcblk1"], ["mkswap", "/dev/mmcblk1p1"],
                                         ["mkfs.ext4", "-F", "/dev/mmcblk1p2"]])

    def test_unready_or_wrong_partition_layout_aborts_without_filesystem_writes(self):
        for attribute, value in (("size", "2097151"), ("partition", "3"), ("start", "0")):
            with self.subTest(attribute=attribute):
                original = (self.root / self.paths["sda1"].lstrip("/") / attribute).read_text()
                self.attr("sda1", attribute, value)
                (self.root / "calls").unlink(missing_ok=True)
                self.assert_failed(self.invoke())
                self.assertEqual(self.writers(), [["fdisk", "/dev/sda"]])
                self.attr("sda1", attribute, original)

    def test_post_format_requires_exact_selected_partition_arguments(self):
        selection = ("sda", IDENTITY, "/dev/sda")
        for args in ((), selection, (*selection, "/dev/sda2", "/dev/sda1"),
                     (*selection, "/dev/sdb1", "/dev/sdb2"),
                     (*selection, "/dev/sda1", "/dev/sda2", "extra")):
            with self.subTest(args=args):
                self.assert_failed(self.invoke("post-format.sh", args))
                self.assertEqual(self.writers(), [])
        result = self.invoke("post-format.sh", (*selection, "/dev/sda1", "/dev/sda2"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.writers(), [["mount", "/dev/sda2", "/sd"], ["swapon", "/dev/sda1"]])

    def test_invalid_or_failed_filesystem_probes_leave_fstab_untouched(self):
        original = (self.root / "config/fstab").read_bytes()
        for response in ('/dev/sda1: UUID="not-a-uuid" TYPE="swap"',
                         '/dev/sda1: UUID="11111111-1111-1111-1111-111111111111" TYPE="ext4"',
                         '/dev/sdb1: UUID="11111111-1111-1111-1111-111111111111" TYPE="swap"',
                         '/dev/sda1: UUID="11111111-1111-1111-1111-111111111111" TYPE="swap"\nextra'):
            with self.subTest(response=response):
                self.write("/bad-probe", response)
                self.assert_failed(self.invoke("post-format.sh", ("sda", IDENTITY, "/dev/sda", "/dev/sda1", "/dev/sda2")))
                self.assertEqual((self.root / "config/fstab").read_bytes(), original)
                self.assertEqual(self.writers(), [])
        (self.root / "bad-probe").unlink()
        self.write("/fail", "block")
        self.assert_failed(self.invoke("post-format.sh", ("sda", IDENTITY, "/dev/sda", "/dev/sda1", "/dev/sda2")))
        self.assertEqual((self.root / "config/fstab").read_bytes(), original)

    def test_existing_uuid_owner_is_not_silently_replaced(self):
        self.write("/etc/config/fstab", "fstab.keep=swap\nfstab.keep.uuid='11111111-1111-1111-1111-111111111111'\n")
        original = (self.root / "config/fstab").read_bytes()
        result = self.invoke("post-format.sh", ("sda", IDENTITY, "/dev/sda", "/dev/sda1", "/dev/sda2"))
        self.assert_failed(result)
        self.assertIn("owner", result.stderr)
        self.assertEqual((self.root / "config/fstab").read_bytes(), original)
        self.assertEqual(self.writers(), [])

    def test_atomic_configuration_failure_reports_partial_setup_and_cleans_temp(self):
        original = (self.root / "config/fstab").read_bytes()
        self.write("/fail", "mv")
        result = self.invoke()
        self.assert_failed(result)
        self.assertIn("irreversible", result.stderr)
        self.assertEqual((self.root / "config/fstab").read_bytes(), original)
        self.assertEqual(list((self.root / "config").glob(".usbstorage-fstab.*")), [])
        self.assertEqual([call[0] for call in self.writers()], ["fdisk", "mkswap", "mkfs.ext4"])

    def test_activation_rechecks_disk_usage_identity_and_destination_after_config_write(self):
        original = (self.root / "config/fstab").read_bytes()
        for mutation in ("mounted", "swapped", "held", "readonly", "replaced", "unavailable", "sd-alias"):
            with self.subTest(mutation=mutation):
                try:
                    (self.root / "calls").unlink(missing_ok=True)
                    self.write("/mv-mutation", mutation)
                    result = self.invoke("post-format.sh", ("sda", IDENTITY, "/dev/sda", "/dev/sda1", "/dev/sda2"))
                    self.assert_failed(result)
                    self.assertEqual(self.writers(), [])
                finally:
                    self.reset_mutation()
                    (self.root / "mv-mutation").unlink(missing_ok=True)
                    destination = self.root / "sd"
                    if destination.is_symlink():
                        destination.unlink()
                    elif destination.exists():
                        destination.rmdir()
                    (self.root / "config/fstab").write_bytes(original)

    def test_replaced_device_after_swapon_never_receives_environment_writes(self):
        self.write("/swapon-mutation", "replaced")
        result = self.invoke()
        self.assert_failed(result)
        self.assertNotIn("fx-environment", [call[0] for call in self.calls()])

    def test_mount_swap_and_environment_failures_never_report_success(self):
        original = (self.root / "config/fstab").read_bytes()
        args = ("sda", IDENTITY, "/dev/sda", "/dev/sda1", "/dev/sda2")
        for failed, expected in (("mount", ["mount"]), ("swapon", ["mount", "swapon"]),
                                 ("fx-environment", ["mount", "swapon"])):
            with self.subTest(failed=failed):
                (self.root / "calls").unlink(missing_ok=True)
                self.write("/fail", failed)
                result = self.invoke("post-format.sh", args)
                self.assert_failed(result)
                self.assertIn("partial", result.stderr)
                self.assertEqual([call[0] for call in self.writers()], expected)
                self.reset_mutation()
                (self.root / "config/fstab").write_bytes(original)

    def test_term_holds_lock_until_running_writer_exits_then_cleans_up(self):
        self.write("/pause-fdisk", "pause")
        first = self.invoke(background=True)
        self.addCleanup(self.stop_process, first)
        self.wait_entered("fdisk")
        first.terminate()
        second = self.invoke("format-device.sh")
        self.assertNotEqual(second.returncode, 0)
        self.assertIn("lock", second.stderr)
        (self.root / "pause-fdisk").unlink()
        stdout, stderr = first.communicate(timeout=25)
        self.assertNotEqual(first.returncode, 0, stdout + stderr)
        self.assertFalse((self.root / "setup.lock").exists())
        self.assertEqual(self.writers(), [["fdisk", "/dev/sda"]])

    def wait_entered(self, stage):
        for _ in range(500):
            if (self.root / f"{stage}-entered").exists():
                return
            time.sleep(0.01)
        self.fail(f"Operation never entered {stage}")

    @staticmethod
    def stop_process(process):
        if process.poll() is None:
            process.kill()
        process.communicate()

    def test_shared_lock_covers_formatting_and_post_format_work(self):
        for stage in ("fdisk", "fx-environment"):
            with self.subTest(stage=stage):
                self.write(f"/pause-{stage}", "pause")
                first = self.invoke(background=True)
                self.addCleanup(self.stop_process, first)
                self.wait_entered(stage)
                before = self.writers()
                for entry, args in (("auto-setup.sh", None), ("format-device.sh", None),
                                    ("post-format.sh", ("sda", IDENTITY, "/dev/sda", "/dev/sda1", "/dev/sda2"))):
                    result = self.invoke(entry, args)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("lock", result.stderr.lower())
                    self.assertEqual(self.writers(), before)
                (self.root / f"pause-{stage}").unlink()
                stdout, stderr = first.communicate(timeout=25)
                self.assertEqual(first.returncode, 0, stderr + stdout)
                self.assertFalse((self.root / "setup.lock").exists())
                # Each iteration is a distinct freshly formatted setup fixture.
                self.write("/config/fstab", "# unrelated\n")
                self.reset_mutation()


DOUBLE = r'''
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time

root = Path(os.environ["FX"]).resolve()
assert root.parent in (Path("/tmp/opencode"), Path(tempfile.gettempdir()).resolve()) and root.name.startswith("storage-")
command, *args = [Path(sys.argv[0]).name, *sys.argv[1:]]

def refuse():
    with (root / "refused").open("a") as log:
        log.write(repr([command, *args]) + "\n")
    sys.exit(97)

def device(path):
    allowed = (root / "allowed-devices").read_text().splitlines()
    if path not in ["/dev/" + name for name in allowed]:
        refuse()
    name = path.removeprefix("/dev/")
    if not (root / "dev" / name).is_file() or not (root / "rdev" / name).is_file():
        refuse()

def mutate(mode):
    disk = root / (root / "disk-path").read_text().lstrip("/")
    if mode == "mounted":
        with (root / "proc/self/mountinfo").open("a") as file:
            file.write("2 1 8:0 / /media rw - ext4 /dev/sda rw\n")
    elif mode == "swapped":
        (root / "proc/swaps").write_text("Filename Type Size Used Priority\n/dev/sda partition 100 0 -2\n")
    elif mode == "held":
        (disk / "holders/dm-1").write_text("fixture holder")
    elif mode == "readonly":
        (disk / "ro").write_text("1")
    elif mode == "replaced":
        (disk / "diskseq").write_text("13")
    elif mode == "unavailable":
        (root / "sys/class/block/sda").unlink()
    elif mode == "small":
        (disk / "size").write_text("2097152")
    elif mode == "sd-owner":
        (root / "etc/config/fstab").write_text("fstab.owner=mount\nfstab.owner.target='/sd'\n")
    elif mode == "sd-alias":
        (root / "sd").symlink_to(root / "media")
    else:
        refuse()

swap = "/dev/" + (root / "swap-name").read_text()
data = "/dev/" + (root / "data-name").read_text()
selected = "/dev/" + (root / "selected-name").read_text()
action = lambda: None
if command == "fx-collect":
    if args != ["/proc/self/mountinfo"]:
        refuse()
    counter = root / "collect-count"
    count = int(counter.read_text()) + 1 if counter.exists() else 1
    counter.write_text(str(count))
    if (root / "collect-at").exists() and count == int((root / "collect-at").read_text()):
        mutate((root / "collect-mutation").read_text())
    sys.exit(0)
elif command == "fdisk":
    if args != [selected] or sys.stdin.read() != "o\nn\np\n1\n\n+1G\nt\n82\nn\np\n2\n\n\nw\n":
        refuse()
    device(args[0])
elif command == "mkswap":
    if args != [swap]:
        refuse()
    device(swap)
elif command == "mkfs.ext4":
    if args != ["-F", data]:
        refuse()
    device(data)
elif command == "block":
    if len(args) != 2 or args[0] != "info" or args[1] not in (swap, data):
        refuse()
    device(args[1])
    if (root / "bad-probe").exists():
        print((root / "bad-probe").read_text())
    else:
        uuid, kind = ("11111111-1111-1111-1111-111111111111", "swap") if args[1] == swap else ("22222222-2222-2222-2222-222222222222", "ext4")
        print(f'{args[1]}: UUID="{uuid}" TYPE="{kind}"')
elif command == "mount":
    if args != [data, "/sd"]:
        refuse()
    device(data)
elif command == "swapon":
    if args != [swap]:
        refuse()
    device(swap)
elif command == "sleep":
    if args not in (["1"], ["2"]):
        refuse()
elif command == "sync":
    if args:
        refuse()
elif command == "fx-environment":
    if args != [data, selected.removeprefix("/dev/"), "v1:12345678-1234-1234-1234-123456789abc:8:0:12:16777216"]:
        refuse()
    device(data)
elif command == "mkdir":
    if args == [str(root / "setup.lock")]:
        try:
            (root / "setup.lock").mkdir()
        except FileExistsError:
            sys.exit(1)
    elif args == ["-p", "/sd"]:
        (root / "sd").mkdir(exist_ok=True)
    else:
        refuse()
elif command == "rmdir":
    if args != [str(root / "setup.lock")]:
        refuse()
    (root / "setup.lock").rmdir()
elif command == "cp":
    if len(args) != 3 or args[0] != "-p":
        refuse()
    source, target = Path(args[1]), Path(args[2])
    if not ((source == root / "config/fstab" and target == root / "setup.lock/fstab.before") or
            (source == root / "setup.lock/fstab.before" and target.parent == root / "config" and target.name.startswith(".usbstorage-fstab."))):
        refuse()
    action = lambda: shutil.copy2(source, target)
elif command == "mv":
    if len(args) != 3 or args[0] != "-f":
        refuse()
    source, target = Path(args[1]), Path(args[2])
    if source.parent != root / "config" or not source.name.startswith(".usbstorage-fstab.") or target != root / "config/fstab":
        refuse()
    action = lambda: source.replace(target)
elif command == "rm":
    if len(args) != 2 or args[0] != "-f":
        refuse()
    target = Path(args[1])
    if target != root / "setup.lock/fstab.before" and not (target.parent == root / "config" and target.name.startswith(".usbstorage-fstab.")):
        refuse()
    target.unlink(missing_ok=True)
elif command == "mktemp":
    if args != [str(root / "config/.usbstorage-fstab.XXXXXX")]:
        refuse()
    fd, path = tempfile.mkstemp(prefix=".usbstorage-fstab.", dir=root / "config")
    os.close(fd)
    print(path)
else:
    refuse()
with (root / "calls").open("a") as log:
    log.write(json.dumps([command, *args]) + "\n")
if (root / "fail").exists() and (root / "fail").read_text() == command:
    sys.exit(19)
action()
if command == "mount":
    mm = (root / "rdev" / data.removeprefix("/dev/")).read_text()
    with (root / "proc/self/mountinfo").open("a") as file:
        file.write(f"9 1 {mm} / /sd rw - ext4 {data} rw\n")
if command == "swapon":
    with (root / "proc/swaps").open("a") as file:
        file.write(f"{swap} partition 100 0 -2\n")
pause = root / ("pause-" + command)
if pause.exists():
    (root / (command + "-entered")).write_text("entered")
    deadline = time.monotonic() + 15
    while pause.exists() and time.monotonic() < deadline:
        time.sleep(0.01)
    if pause.exists():
        sys.exit(98)
mutation = root / (command + "-mutation")
if mutation.exists():
    mutate(mutation.read_text())
'''


if __name__ == "__main__":
    unittest.main()
