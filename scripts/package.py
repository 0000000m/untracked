#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Build a deterministic, unsigned unpacked-extension ZIP from an explicit allowlist."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / 'extension/manifest.json').read_text())['version']
output = ROOT / 'dist'
output.mkdir(exist_ok=True)
archive = output / f'untracked-v{version}.zip'
files = {
    'untracked/LICENSE': ROOT / 'LICENSE',
    'untracked/manifest.json': ROOT / 'extension/manifest.json',
    'untracked/rules.json': ROOT / 'extension/rules.json',
}
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as target:
    for name, source in sorted(files.items()):
        item = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        item.create_system = 3
        item.external_attr = 0o100644 << 16
        target.writestr(item, source.read_bytes())
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / 'SHA256SUMS').write_text(f'{digest}  {archive.name}\n')
print(f'{archive.name}: {digest}')
