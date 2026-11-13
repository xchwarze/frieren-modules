"""Select opted-in modules using Git paths, without executing module code."""

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys


ZERO_SHA = "0" * 40
MODULE_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*")


def git(*args):
    return subprocess.run(
        ["git", *args], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    ).stdout


def revision(value):
    if not re.fullmatch(r"[0-9a-fA-F]{40}", value) or value == ZERO_SHA:
        raise ValueError("Diff revisions must be nonzero, full Git commit SHAs")
    git("cat-file", "-e", f"{value}^{{commit}}")
    return value


def registered(names):
    modules = []
    for name in sorted(names):
        if not MODULE_NAME.fullmatch(name):
            print(f"Skipping unsafe module name: {name!r}", file=sys.stderr)
        elif not (Path(name) / "ci" / "test.sh").is_file():
            print(f"Skipping {name}: no ci/test.sh", file=sys.stderr)
        else:
            modules.append(name)
    return modules


def select_modules(args):
    all_modules = args.event == "workflow_dispatch"
    paths = []
    if not all_modules:
        head = revision(args.head)
        if args.event == "push" and args.before == ZERO_SHA:
            all_modules = True
        else:
            base = revision(args.base if args.event == "pull_request" else args.before)
            if args.event == "pull_request":
                base = git("merge-base", base, head).decode("ascii").strip()
            # Disable rename collapsing so both old and new module paths survive.
            paths = [os.fsdecode(path) for path in git(
                "diff", "--name-only", "--no-renames", "-z", base, head, "--",
            ).split(b"\0") if path]
            all_modules = any(path.startswith(".github/") for path in paths)

    if all_modules:
        print("Selecting all registered modules", file=sys.stderr)
        names = {path.name for path in Path(".").iterdir()
                 if path.is_dir() and not path.name.startswith(".")}
    else:
        names = {path.split("/", 1)[0] for path in paths if "/" in path}
    return registered(names)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event", required=True,
                        choices=("pull_request", "push", "workflow_dispatch"))
    parser.add_argument("--base", default="")
    parser.add_argument("--head", default="")
    parser.add_argument("--before", default="")
    args = parser.parse_args()
    try:
        modules = select_modules(args)
    except (ValueError, subprocess.CalledProcessError) as error:
        parser.error(f"Cannot select modules: {error}")

    result = json.dumps(modules, separators=(",", ":"))
    if not modules:
        print("No registered modules selected; skipping module tests", file=sys.stderr)
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(f"modules={result}\n")
    print(result)


if __name__ == "__main__":
    main()
