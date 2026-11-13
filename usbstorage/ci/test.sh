#!/bin/sh
set -eu

# Run from the module directory, using the standard sibling framework checkout.
PHP_BIN=${PHP_BIN:-php}
export VITE_COMMON_ALIAS=../../frieren/frieren-front/src
export VITE_ANALYZER_ENABLE=false

printf '%s\n' 'Checking shell syntax and scoped static analysis'
for script in public/bin/*.sh public/files/20-sd-loader; do
    sh -n "$script"
done
# The unchanged hotplug loader has 14 pre-existing ShellCheck diagnostics.
# Analyze the scoped bin scripts without suppressing their diagnostics.
# Existing source directives include repository-relative paths.
(
    cd ..
    shellcheck -x -P usbstorage/public/bin usbstorage/public/bin/*.sh
)

printf '%s\n' 'Running synthetic storage fixtures (no hardware)'
python3 -m unittest discover -s tests-shell -p 'test_*.py' -v

printf '%s\n' 'Checking PHP syntax and request boundaries'
find public tests-php -name '*.php' -print0 | xargs -0 -n1 "$PHP_BIN" -n -l
"$PHP_BIN" -n tests-php/storage_test.php

printf '%s\n' 'Installing locked dependencies and running UI tests, headless build, and schema validation'
corepack yarn install --immutable
corepack yarn test
corepack yarn build
corepack yarn validate

printf '%s\n' 'Checking package and manifest versions match'
node --input-type=module -e "import fs from 'node:fs'; const read = p => JSON.parse(fs.readFileSync(p)); if (read('package.json').version !== read('public/manifest.json').version) process.exit(1);"
