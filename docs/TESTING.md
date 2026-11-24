# Testing and compatibility

Tests observe the HTTP request path received by a server, not merely a changed address bar. The no-extension control first proves that the original query reaches that server. The extension is then loaded into the same disposable browser, and positive cases assert the exact cleaned request while negative cases assert preservation.

## Requirements and commands

- Node.js 22 or newer.
- Python 3.11 or newer for release packaging and optional CI browser downloads.
- OpenSSL for a short-lived test certificate.
- A current Chromium-based browser supporting the DevTools `Extensions.loadUnpacked` command (Chromium 126+). This automation requirement is separate from the extension's declared API floor of 101.

```sh
node --test tests/static.test.mjs tests/package.test.mjs
BROWSER_PATH="$(command -v vivaldi)" node tests/network.mjs
# Or on macOS:
BROWSER_PATH="/Applications/Chromium.app/Contents/MacOS/Chromium" node tests/network.mjs
```

`BROWSER_PATH` names an executable, not an application bundle or a shell command with arguments. `OPENSSL_PATH` and `PYTHON_PATH` can override the corresponding test executables when necessary. No npm/Python packages are installed.

Vivaldi is detected from its version output and run with `--disable-vivaldi` **only in the disposable headless test process**. This exercises Vivaldi's Chromium request engine without its desktop UI. An existing browser session and installed extension are not touched.

## Coverage

The current suite has five source/package checks and 32 real-network checks, covering:

- A no-extension control, HTTP/HTTPS removal, and `utm_source=chatgpt.com`.
- Duplicate/bare keys, common campaign/click-ID families, and overlapping domain/global rules.
- Exact functional values, query order/encoding, fragments, nested URLs and similarly named keys.
- Known limits: case sensitivity, percent-encoded keys and unlisted names.
- Server redirects; GET fetch, HEAD, images, scripts and subframes.
- POST, PUT, PATCH and DELETE query/body preservation.
- YouTube domains and subdomains, a lookalike-domain negative case, and unrelated sites retaining `si`.
- Permission boundaries, absence of runtime code/signing identity, and byte-reproducible allowlisted release ZIPs.

All test traffic used for assertions terminates on loopback HTTP/HTTPS servers. YouTube hostnames are mapped to those local fixtures in the test process; the tests do not contact YouTube. The self-signed test certificate is trusted only by its temporary key fingerprint in that browser process. No system certificate is installed and no general certificate-validation bypass is used.

The DevTools installation is temporary by design. These tests do **not** establish that a DevTools-loaded extension persists after restart. The supported user installation is the normal **Load unpacked** UI workflow. Extension reload/update prompts, private windows, restricted site permissions, service-worker caches and third-party extension interactions are not fully covered.

## Recorded environments

| Environment | Version / mode | Status |
| --- | --- | --- |
| Vivaldi on Kubuntu 26.04.1, x86_64 | Vivaldi 8.3.4191.47; Chromium 156.0.8078.110; headless request engine; Node 24.22.3 | 32/32 network checks passed, 2026-11-24 |
| Google Chrome on Kubuntu 26.04.1, x86_64 | Chrome 158.0.8127.88; headless; Node 24.22.3 | 32/32 network checks passed, 2026-11-24 |
| Chromium on Kubuntu 26.04.1, x86_64 | Chromium 160.0.8183.0; snapshot 1753500; headless; Node 24.22.3 | 32/32 network checks passed, 2026-11-24 |
| Chromium on Ubuntu CI | Snapshot 1753500; exact CI result pending | Not yet recorded |
| Chromium on macOS, Apple Silicon | Pinned CI snapshot; exact result pending | Not yet recorded |
| Chromium on macOS, Intel | No execution environment used | Not tested |

The earlier local prototype was also exercised in ordinary Vivaldi desktop profiles on Linux, including restart persistence of its Linux-only signed installation. That evidence is background context, not a substitute for testing this separately named release or the macOS unpacked UI workflow. The project intentionally omits that machine-specific installation method.

## CI and reproducibility

The workflow runs source/package checks and network tests on Linux and macOS using official Chromium snapshots. Browser revisions and SHA-256 values are pinned in the workflow. Test reports contain versions and check names, with no account information or browser-profile paths. Generated reports live under ignored `test-results/` and are uploaded as CI artifacts.

The optional `scripts/download-chromium.py` fetches only from the official Chromium snapshot service, validates the configured hash and extracts into a new cache directory. It never installs or launches a browser in the normal desktop profile. See [Chromium's snapshot documentation](https://www.chromium.org/getting-involved/download-chromium/).

Run `python3 scripts/package.py` to generate the ZIP and `SHA256SUMS` in ignored `dist/`. Fixed entry ordering, timestamps, file permissions and stored ZIP entries make repeated archives byte-identical for identical source files. The package test verifies that property and its exact allowlist.
