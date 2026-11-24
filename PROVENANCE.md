# Provenance and licensing

## Project material

The initial extension was written during an AI-assisted development session for a local Vivaldi installation. The release preparation retained the two-rule design, removed the local signing identity and deployment data, simplified the global matcher, and rewrote the tests and packaging for portable use.

The repository's source, tests and documentation are offered under MIT. The copyright notice uses **Untracked contributors** rather than a personal name or email. The project owner should retain the ability to review that licensing choice before public release.

## Rules

The rule list is a small, manually selected collection of parameter identifiers and an original DNR configuration. The initial selection was informed by commonly used tracking names and inspection of browser behavior. No filter-list file was imported, downloaded into the extension, or converted from uBlock Origin, AdGuard, ClearURLs, or Vivaldi.

API field names, parameter names and hostnames are used as functional identifiers. No ownership of those identifiers is claimed. This provenance review found no bundled third-party source or rules requiring a separate notice. It is a review of the available development record, not a guarantee about every possible similarity or jurisdiction.

## References consulted

- [Chromium DNR documentation](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest): API behavior, permissions, and request-stage evaluation.
- [Chromium extension installation documentation](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked): installation workflow.
- [Vivaldi blocker documentation](https://help.vivaldi.com/desktop/privacy/tracking-and-ad-blocking/) and [8.3 announcement](https://vivaldi.com/press/independent-european-browser-new-ad-blocker/): the original motivation and clipboard feature distinction.
- [Chromium source](https://chromium.googlesource.com/chromium/src/+/master/extensions/browser/extension_prefs.cc): the distinction between temporary DevTools installations and persistent browser installations. No source was copied.
- [Open Source Initiative's MIT license](https://opensource.org/license/mit): the standard license text.

Documentation examples were consulted as reference material; no documentation prose or sample implementation is vendored beyond the standard MIT license text.

## External tools and binaries

Node.js, Python, OpenSSL and the tested browsers are separately installed development tools. Chromium CI archives are downloaded from the official snapshot service, pinned by revision and SHA-256, and kept outside source control. Browser binaries, their dependencies, and their licenses are not redistributed in this project's release ZIP. Each tool retains its own license.

Official GitHub Actions are referenced at immutable commits. They are CI dependencies, not part of the extension. No npm or Python package dependency is required by this repository.

## AI-assisted development

OpenAI Codex/ChatGPT assisted with the initial code, rule selection, security/reliability review, tests and documentation. The project owner supplied requirements and authorized the work. Automated test results are recorded separately from human review; neither AI assistance nor passing tests is presented as an independent audit. Contributors should disclose substantial AI assistance in their pull requests and verify their changes themselves.
