// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
test('release ZIP is deterministic and contains only approved distributable files', async () => {
  const python = process.env.PYTHON_PATH || 'python3';
  execFileSync(python, ['scripts/package.py'], { cwd: root });
  const first = await readFile(new URL('dist/untracked-v1.0.0.zip', root));
  execFileSync(python, ['scripts/package.py'], { cwd: root });
  const second = await readFile(new URL('dist/untracked-v1.0.0.zip', root));
  assert.deepEqual(first, second);
  execFileSync(python, ['-c', `
import json, zipfile
from pathlib import Path
with zipfile.ZipFile('dist/untracked-v1.0.0.zip') as z:
    assert z.namelist() == ['untracked/LICENSE','untracked/manifest.json','untracked/rules.json']
    for name, source in [('untracked/LICENSE','LICENSE'),('untracked/manifest.json','extension/manifest.json'),('untracked/rules.json','extension/rules.json')]:
        assert z.read(name) == Path(source).read_bytes()
    assert 'key' not in json.loads(z.read('untracked/manifest.json'))
`], { cwd: root });
});
