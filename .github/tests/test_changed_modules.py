"""Exercise module selection through the CLI against ordinary Git repositories."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SELECTOR = Path(__file__).resolve().parents[1] / "scripts" / "changed_modules.py"
ZERO_SHA = "0" * 40


class ChangedModulesTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name)
        self.git("init", "-q", "-b", "master")
        self.git("config", "user.name", "Module CI tests")
        self.git("config", "user.email", "module-ci@example.invalid")
        self.write("README.md", "Modules\n")
        for module in ("alpha", "beta", "unchanged"):
            self.register(module)
        self.write("no-tests/source.txt", "No entrypoint\n")
        self.base = self.commit("Initial modules")

    def git(self, *args):
        return subprocess.run(
            ["git", *args], cwd=self.repo, check=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        ).stdout.strip()

    def write(self, path, content="Changed\n"):
        destination = self.repo / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content)

    def register(self, module):
        self.write(f"{module}/ci/test.sh", "#!/bin/sh\nexit 0\n")
        self.write(f"{module}/source.txt", f"{module}\n")

    def commit(self, message):
        self.git("add", "--all")
        self.git("commit", "-q", "--allow-empty", "-m", message)
        return self.git("rev-parse", "HEAD")

    def run_selector(self, event="pull_request", *, base=None, head=None,
                     before=None, output=False):
        args = [sys.executable, str(SELECTOR), "--event", event]
        for name, value in (("base", base), ("head", head), ("before", before)):
            if value is not None:
                args.extend([f"--{name}", value])
        environment = os.environ.copy()
        environment.pop("GITHUB_OUTPUT", None)
        if output:
            environment["GITHUB_OUTPUT"] = str(self.repo / "job-output")
        return subprocess.run(
            args, cwd=self.repo, env=environment, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )

    def select(self, **kwargs):
        result = self.run_selector(**kwargs)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout), result

    def changed(self, *paths):
        for path in paths:
            self.write(path)
        return self.commit("Change files")

    def test_one_changed_registered_module(self):
        head = self.changed("alpha/source.txt")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, ["alpha"])

    def test_two_changed_modules_are_sorted_and_unchanged_module_is_excluded(self):
        head = self.changed("beta/source.txt", "alpha/source.txt")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, ["alpha", "beta"])

    def test_module_without_entrypoint_is_explicitly_skipped(self):
        head = self.changed("no-tests/source.txt")
        selected, result = self.select(base=self.base, head=head)
        self.assertEqual(selected, [])
        self.assertIn("no-tests", result.stderr)
        self.assertIn("no ci/test.sh", result.stderr)

    def test_root_readme_only_selects_none(self):
        head = self.changed("README.md")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, [])

    def test_docs_only_selects_none(self):
        head = self.changed("docs/guide.md")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, [])

    def test_empty_diff_selects_none_and_logs_it(self):
        selected, result = self.select(base=self.base, head=self.base)
        self.assertEqual(selected, [])
        self.assertIn("No registered modules selected", result.stderr)

    def test_manual_run_selects_all_registered_modules(self):
        selected, result = self.select(event="workflow_dispatch")
        self.assertEqual(selected, ["alpha", "beta", "unchanged"])
        self.assertIn("no-tests", result.stderr)

    def test_zero_before_push_selects_all_registered_modules(self):
        selected, _ = self.select(event="push", before=ZERO_SHA, head=self.base)
        self.assertEqual(selected, ["alpha", "beta", "unchanged"])

    def test_any_github_change_selects_all_registered_modules(self):
        head = self.changed(".github/scripts/helper.py")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, ["alpha", "beta", "unchanged"])

    def test_deleted_github_file_selects_all_registered_modules(self):
        self.write(".github/old-config.yml")
        base = self.commit("Add shared CI file")
        (self.repo / ".github/old-config.yml").unlink()
        head = self.commit("Delete shared CI file")
        selected, _ = self.select(base=base, head=head)
        self.assertEqual(selected, ["alpha", "beta", "unchanged"])

    def test_pr_uses_merge_base_not_base_tip(self):
        self.git("checkout", "-q", "-b", "feature")
        head = self.changed("alpha/source.txt")
        self.git("checkout", "-q", "master")
        base_tip = self.changed("beta/source.txt")
        self.git("checkout", "-q", "feature")
        selected, _ = self.select(base=base_tip, head=head)
        self.assertEqual(selected, ["alpha"])

    def test_push_uses_before_after_not_merge_base(self):
        self.git("checkout", "-q", "-b", "replacement")
        after = self.changed("alpha/source.txt")
        self.git("checkout", "-q", "master")
        before = self.changed("beta/source.txt")
        self.git("checkout", "-q", "replacement")
        selected, _ = self.select(event="push", before=before, head=after)
        self.assertEqual(selected, ["alpha", "beta"])

    def test_nested_filename_with_newline_does_not_create_fake_module_paths(self):
        head = self.changed("alpha/line\nbeta/fake.txt")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, ["alpha"])

    def test_rename_between_surviving_modules_selects_both(self):
        self.git("mv", "alpha/source.txt", "beta/moved.txt")
        head = self.commit("Move between modules")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, ["alpha", "beta"])

    def test_module_directory_rename_selects_surviving_destination(self):
        self.git("mv", "alpha", "renamed")
        head = self.commit("Rename module")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, ["renamed"])

    def test_deleted_file_still_selects_surviving_module(self):
        (self.repo / "alpha/source.txt").unlink()
        head = self.commit("Delete module file")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, ["alpha"])

    def test_deleted_module_is_skipped(self):
        self.git("rm", "-r", "alpha")
        head = self.commit("Remove module")
        selected, result = self.select(base=self.base, head=head)
        self.assertEqual(selected, [])
        self.assertIn("alpha", result.stderr)
        self.assertIn("no ci/test.sh", result.stderr)

    def test_removing_entrypoint_opts_out(self):
        (self.repo / "alpha/ci/test.sh").unlink()
        head = self.commit("Opt out")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, [])

    def test_new_entrypoint_opts_in(self):
        self.write("no-tests/ci/test.sh", "#!/bin/sh\nexit 0\n")
        head = self.commit("Opt in")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, ["no-tests"])

    def test_directory_named_test_sh_does_not_opt_in(self):
        self.write("no-tests/ci/test.sh/not-a-script")
        head = self.commit("Not an entrypoint")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, [])

    def test_unsafe_module_names_are_never_matrix_values(self):
        for module in ("bad name", "bad;name", "$(touch PWNED)", "-option"):
            self.register(module)
        head = self.commit("Unsafe module names")
        selected, result = self.select(base=self.base, head=head)
        self.assertEqual(selected, [])
        self.assertIn("unsafe module name", result.stderr)
        self.assertFalse((self.repo / "PWNED").exists())
        selected, _ = self.select(event="workflow_dispatch")
        self.assertEqual(selected, ["alpha", "beta", "unchanged"])

    def test_safe_hyphen_underscore_and_digit_names(self):
        self.register("module-2_test")
        head = self.commit("Safe module name")
        selected, _ = self.select(base=self.base, head=head)
        self.assertEqual(selected, ["module-2_test"])

    def test_json_stdout_and_job_output_are_not_corrupted_by_skip_logs(self):
        head = self.changed("beta/source.txt", "no-tests/source.txt")
        selected, _ = self.select(base=self.base, head=head, output=True)
        self.assertEqual(selected, ["beta"])
        self.assertEqual((self.repo / "job-output").read_text(), 'modules=["beta"]\n')

    def test_invalid_or_missing_diff_inputs_fail_without_output(self):
        cases = [
            {"base": self.base},
            {"head": self.base},
            {"base": "--help", "head": self.base},
            {"base": "$(touch PWNED)", "head": self.base},
            {"base": "f" * 40, "head": self.base},
            {"base": self.base, "head": ZERO_SHA},
            {"event": "push", "head": self.base},
            {"event": "push", "before": "master", "head": self.base},
            {"event": "push", "before": ZERO_SHA, "head": "invalid"},
            {"event": "pull_request_target"},
        ]
        for kwargs in cases:
            with self.subTest(kwargs=kwargs):
                result = self.run_selector(**kwargs, output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "")
                self.assertFalse((self.repo / "job-output").exists())
                self.assertFalse((self.repo / "PWNED").exists())

    def test_unrelated_pr_histories_fail_instead_of_silently_skipping(self):
        self.git("checkout", "-q", "--orphan", "unrelated")
        self.write("alpha/source.txt", "Other history\n")
        head = self.commit("Unrelated root")
        result = self.run_selector(base=self.base, head=head)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
