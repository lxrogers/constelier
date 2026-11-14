"""Create an isolated local test app; never modify the working app/registry.
Usage: python3 scripts/rings/prepare-family-fixture.py /workspace/ring-family-fixture-app
Then run `npm run build` and `npm run start -- --port 3010` in that copy.
"""
import pathlib
import shutil
import sys

source = pathlib.Path(__file__).resolve().parents[2]
target = pathlib.Path(sys.argv[1]).resolve()
if target.exists():
    raise SystemExit('Choose a new destination; existing files are never replaced.')
if source == target or source in target.parents:
    raise SystemExit('Fixture app must be outside the source checkout.')
target.mkdir(parents=True)
for directory in ('src', 'modules', 'public', 'scripts/rings'):
    shutil.copytree(source / directory, target / directory)
for name in ('package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.js', 'postcss.config.js', 'empty-module.js', 'horoscope-bundle.js'):
    shutil.copy2(source / name, target / name)
(target / 'node_modules').symlink_to(source / 'node_modules', target_is_directory=True)
# Turbopack must resolve the shared, existing dependencies across both local dirs.
with (target / 'next.config.js').open('a') as config:
    config.write('\nmodule.exports.turbopack.root = ' + repr(str(pathlib.Path('/workspace'))) + ';\n')
registry = target / 'modules/rings/families.mjs'
text = registry.read_text()
text = "import { FIXTURE_FAMILY } from '../../scripts/rings/family-fixture.mjs';\n" + text
text = text.replace('export const RING_FAMILIES = createRingRegistry([', 'export const RING_FAMILIES = createRingRegistry([\n  FIXTURE_FAMILY,')
registry.write_text(text)
(target / 'LOCAL_TEST_FIXTURE.txt').write_text('Test-only adapter of the existing wave generator. Not a liquid or faceted implementation. Never deploy this directory.\n')
print(target)
