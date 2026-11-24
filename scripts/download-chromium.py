#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Download a pinned official Chromium snapshot for disposable compatibility tests."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import tempfile
import urllib.request
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('platform', choices=['Linux_x64', 'Mac_Arm'])
parser.add_argument('revision')
parser.add_argument('--sha256', help='Expected archive hash; required in CI.')
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--github-env', action='store_true', help='Export BROWSER_PATH to this Actions job.')
args = parser.parse_args()
if not args.revision.isdigit():
    parser.error('revision must contain digits only')
if os.environ.get('CI') and not args.sha256:
    parser.error('--sha256 is required in CI')
if args.output.exists():
    parser.error('output must not exist; use a fresh cache directory')
archive_name = 'chrome-linux.zip' if args.platform == 'Linux_x64' else 'chrome-mac.zip'
relative_binary = ('chrome-linux/chrome' if args.platform == 'Linux_x64'
                   else 'chrome-mac/Chromium.app/Contents/MacOS/Chromium')
url = f'https://commondatastorage.googleapis.com/chromium-browser-snapshots/{args.platform}/{args.revision}/{archive_name}'
args.output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='untracked-download-', dir=args.output.parent) as temporary:
    temporary = Path(temporary)
    archive = temporary / 'download.zip'
    with urllib.request.urlopen(url, timeout=90) as source, archive.open('wb') as target:
        shutil.copyfileobj(source, target)
    hasher = hashlib.sha256()
    with archive.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    if args.sha256 and digest != args.sha256:
        raise SystemExit('Chromium archive checksum mismatch')
    extracted = temporary / 'extracted'
    extracted.mkdir()
    base = extracted.resolve()
    with zipfile.ZipFile(archive) as bundle:
        for item in bundle.infolist():
            relative = PurePosixPath(item.filename)
            if relative.is_absolute() or '..' in relative.parts:
                raise SystemExit('Unsafe archive path')
            path = extracted / item.filename
            if not path.resolve().is_relative_to(base):
                raise SystemExit('Archive path escapes the extraction directory')
            mode = item.external_attr >> 16
            if item.is_dir():
                path.mkdir(parents=True, exist_ok=True)
            elif stat.S_ISLNK(mode):
                target = bundle.read(item).decode('utf-8')
                if Path(target).is_absolute() or not (path.parent / target).resolve().is_relative_to(base):
                    raise SystemExit('Unsafe archive symlink')
                path.parent.mkdir(parents=True, exist_ok=True)
                path.symlink_to(target)
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                with bundle.open(item) as source, path.open('wb') as target:
                    shutil.copyfileobj(source, target)
                path.chmod((mode & 0o777) or 0o644)
    if not (extracted / relative_binary).is_file():
        raise SystemExit('Expected Chromium executable is missing')
    (extracted / 'download.json').write_text(json.dumps({
        'platform': args.platform, 'revision': args.revision, 'url': url, 'sha256': digest,
    }, indent=2) + '\n')
    extracted.rename(args.output)
binary = (args.output / relative_binary).resolve()
if args.github_env:
    with open(os.environ['GITHUB_ENV'], 'a') as environment:
        environment.write(f'BROWSER_PATH={binary}\n')
print(json.dumps({'platform': args.platform, 'revision': args.revision, 'sha256': digest}))
