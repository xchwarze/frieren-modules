# Frieren Modules Repository

## Description

This repository contains a collection of modules developed for the [Frieren ecosystem](https://github.com/xchwarze/frieren).

Modules in this repository are built using the `frieren-module-template`, designed to ensure seamless integration and consistent performance across the Frieren platform. These modules leverage modern technologies and are developed with the UMD (Universal Module Definition) standard, making them versatile for various deployment scenarios.

## Getting Started

To use a module from this repository, follow these steps:

### Installation

```bash
git clone https://github.com/xchwarze/frieren-modules
cd frieren-modules/<module-name>
yarn install
yarn build
```

Refer to the individual module directories for specific installation instructions.

### Usage

Each module comes with its own set of documentation. Please read through the `README.md` file in the respective module directory for detailed usage instructions.

## Contributing

Contributions are welcome! If you have developed a module using the `frieren-module-template` and wish to share it, please follow these steps:

1. Fork the repository.
2. Create a new module or improve existing modules.
3. Submit a pull request with a comprehensive description of changes.

### Module CI

Opt in by adding `<module-name>/ci/test.sh`. Use a top-level module name matching `[A-Za-z0-9][A-Za-z0-9_-]*`. The common `.github/workflows/module-tests.yml` workflow runs `sh ci/test.sh` once per selected module, with that module as the working directory. The script owns dependency installation and all module-specific checks; exit nonzero when any check fails. No workflow registry is needed.

Pull requests select changed modules using the base/head merge-base diff. Pushes to `master` use the before/after diff. Changes anywhere under `.github/`, manual workflow runs, and pushes with an all-zero before SHA select all opted-in modules. Renames and deletions include both affected paths, but only surviving modules with `ci/test.sh` run. Modules without that file are explicitly logged as skipped; an empty selection starts no module jobs. Selector tests always run in the detection job, including for an empty selection.

Each module job uses GitHub-hosted Ubuntu 24.04 with Node 22, PHP 8.2 (the framework minimum baseline), Python 3, ShellCheck, and Corepack. There is no PHP-version matrix. Framework source is checked out at the pinned commit in the sibling `frieren/frieren-front` directory; from a module directory, its source is `../../frieren/frieren-front/src`. Each module script manages any additional requirements.

CI uses `pull_request`, not `pull_request_target`, read-only repository permissions, no secrets, and checkouts without persisted credentials. Fork pull requests may require maintainer approval under GitHub's repository policy. Module scripts run only on ephemeral hosted runners; keep checks synthetic and never operate on real router devices. This workflow does not publish releases.

## License

All modules in this repository are distributed under the LGPL-3.0-only License, facilitating open-source collaboration and distribution.

## Acknowledgments

A special thanks to all contributors who have developed and maintained the modules in this repository, enhancing the capabilities of the Frieren ecosystem.
