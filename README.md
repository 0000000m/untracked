# Untracked

**Small, declarative URL cleanup for Chromium browsers.**

Untracked removes selected tracking parameters before HTTP(S) GET and HEAD requests are transmitted. It is an independent Manifest V3 extension: two JSON files, two static rules, and no runtime JavaScript or third-party dependencies.

```text
https://example.com/article?utm_source=chatgpt.com&lang=en
                            ↓
https://example.com/article?lang=en
```

This project is not affiliated with or endorsed by Vivaldi, Google, or the Chromium project. Its name describes URL cleanup, not a promise that browsing becomes untrackable.

## Motivation

Campaign tags and click identifiers often travel with otherwise useful links. Removing them after a page loads cannot undo the first request. Untracked uses the browser's declarative request engine to remove a small, explicit set of query parameters before transmission.

The project began as a local extension for Vivaldi on Linux. Vivaldi's [native blocker documentation](https://help.vivaldi.com/desktop/privacy/tracking-and-ad-blocking/) describes blocking requests; its [8.3 announcement](https://vivaldi.com/press/independent-european-browser-new-ad-blocker/) describes **Copy Sanitized Link** as a clipboard action. In a local test of Vivaldi 8.3, normal navigation retained `utm_source` and `fbclid` with the native configuration. This project addresses that observed gap; it does not claim that every native blocking configuration or future browser version has the same behavior.

The implementation is deliberately small enough for browser developers to inspect and discuss, with server-side tests that make its behavior observable.

## Features

- Removes 35 named campaign and click-ID parameters, including common `utm_` names, `fbclid`, `gclid`, `msclkid`, and `srsltid`.
- Removes YouTube's `si` sharing identifier from page and frame navigations on explicitly listed YouTube domains.
- Covers HTTP and HTTPS GET/HEAD requests, including navigations, frames, fetch/XHR, scripts, images and other selected resource types.
- Preserves unrelated query parameters, their order and encoding, and URL fragments.
- Leaves POST and other request methods unchanged.
- Uses local static rules. There are no background workers, content scripts, remote lists, analytics, custom settings, or automatic updates.

The exact list and domain scope are visible in [`extension/rules.json`](extension/rules.json). Parameter names are **case-sensitive and literal**, not a wildcard for every `utm_` name.

## Installation

Use the same unpacked-extension workflow in **Vivaldi on Linux** and **Chromium on macOS**. No command-line flags, signing keys, system policies, or native installers are required.

1. Download the `untracked-v1.0.0.zip` asset from [Releases](https://github.com/0000000m/untracked/releases), or clone this repository.
2. Extract the ZIP into a permanent folder. Keep that folder in place while the extension is installed.
3. Open `vivaldi://extensions` in Vivaldi, or `chrome://extensions` in Chromium.
4. Enable **Developer mode**, choose **Load unpacked**, and select the extracted `untracked` folder. From a source checkout, select the `extension` folder instead.
5. Confirm that **Untracked** is enabled and has the site access needed for your intended coverage.

The browser's generic extension icon is expected. There is no popup or toolbar action. The [Chromium installation guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) describes this workflow.

This is a source release, not a Chrome Web Store distribution. Keep only one URL-cleaner copy enabled when comparing behavior. An existing locally signed prototype can remain installed while this repository is reviewed; installing the release is a separate choice.

For updates, extract the new release into the same folder and click **Reload** in the extension manager. Disable or remove it there at any time. Private/incognito windows require a separate opt-in in the browser's extension settings.

## Technical implementation

The manifest registers one enabled static DNR ruleset. Both rules use `redirect.transform.queryTransform.removeParams`:

| Rule | Scope | Action |
| --- | --- | --- |
| Global cleanup, priority 1 | HTTP(S) GET/HEAD URLs containing a query marker | Remove the explicit list of 35 parameter names |
| YouTube sharing cleanup, priority 2 | Main/subframe GET/HEAD on `youtube.com`, `youtu.be`, `youtube-nocookie.com`, including subdomains | Remove `si` |

The higher-priority rule handles YouTube's sharing identifier first; subsequent evaluation can apply the global rule. The browser skips a redirect whose transformation does not change the URL. Unrelated query strings therefore remain unchanged without a redirect loop; the network suite checks this behavior.

These are request-stage rules, with no response-header condition. Chromium documents the distinction under [DNR rule evaluation](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#rule-evaluation). No script watches page loading, rewrites the address bar, or cancels a request after it has been sent.

The global rule uses a simple query-marker filter. Only the domain-scoped rule needs a short regular expression. There is no background process or JavaScript callback on each request. No quantified performance claim is made.

## Privacy and permissions

| Permission | Purpose |
| --- | --- |
| `declarativeNetRequestWithHostAccess` | Apply the declared URL transformations |
| `http://*/*`, `https://*/*` | Permit redirects across HTTP(S) destinations, including matching initiators |

Host access is required for this automatic coverage and can produce a broad browser permission warning. The shipped extension contains no executable script that reads pages, cookies, history, or request bodies. It has no storage, `tabs`, `webRequest`, scripting, clipboard, or debugging permission, and sends no telemetry. Restricting its site access in the browser can reduce its coverage.

The test harness uses temporary browser profiles and loopback servers. It is not part of the installed extension. Its debugging pipe and temporary TLS certificate exception exist only in those disposable test processes.

## Compatibility and verification

The manifest declares Chromium 101 as the API floor for the fields used. That is **not** a claim that every version since 101 was tested. Automated tests use newer browsers with the DevTools extension-loading API.

The release code has passed 32 network checks on Vivaldi 8.3.4191.47 (Chromium 156) and Google Chrome 158 on Linux. Vivaldi automation exercises its headless Chromium request engine; the desktop UI is outside that harness. macOS/Chromium results and exact versions are recorded in the [test matrix](docs/TESTING.md), with pending environments clearly identified.

Run the source/package checks:

```sh
node --test tests/static.test.mjs tests/package.test.mjs
```

Run real network tests against your chosen browser:

```sh
# Linux, using an existing Vivaldi installation
BROWSER_PATH="$(command -v vivaldi)" node tests/network.mjs

# macOS, using an existing Chromium installation
BROWSER_PATH="/Applications/Chromium.app/Contents/MacOS/Chromium" node tests/network.mjs
```

Development needs Node.js 22+, Python 3.10+ for packaging, and OpenSSL for the HTTPS fixture. There is no `npm install` step. See [TESTING.md](docs/TESTING.md) for the methodology, pinned CI browsers, evidence and test limitations.

## Known limitations

- This is an explicit removal list, not comprehensive tracking prevention. Cookies, fingerprinting, embedded tracking scripts and tracking in URL paths are outside its scope.
- Uppercase variants, percent-encoded parameter names, unknown parameter names and nested URLs in query values are preserved.
- Fragments, clipboard contents and links displayed on pages are not rewritten. A same-document history update without a network request is not cleaned.
- POST, PUT, PATCH, DELETE and other non-GET/HEAD methods are unchanged. The `si` rule applies only to navigations/frames on the named domains.
- Cleaning starts when an eligible request is made. It does not erase data already sent, cached content, browser history or synced history. DNR does not process responses served directly from a service worker's CacheStorage. Referrer headers are not rewritten by these rules.
- A selected name may have a functional use on an unusual site. Signed URLs can fail if a removed parameter was covered by their signature. Disable or restrict the extension for an affected site and report a minimal, redacted example.
- Other extensions, browser policies and native blocking can affect a request. The tests isolate this extension; behavior with every combination is not guaranteed.
- Unpacked installations require Developer mode and manual updates. Managed browsers may prohibit them. Browser automation does not substitute for manual testing of every desktop configuration.

## License and provenance

Licensed under the [MIT License](LICENSE), chosen to permit straightforward reuse in extensions, experiments, and browser implementations with the license notice retained.

The source and small rule list were authored for this project. No third-party filter list, browser source file or extension code is bundled. [`PROVENANCE.md`](PROVENANCE.md) records the review, external references, tooling boundaries and AI-assisted origin. It does not claim a comprehensive legal clearance or independent security audit.

## Development and review

The initial implementation, tests and documentation were developed with **OpenAI Codex/ChatGPT assistance**, directed by the project owner. That assistance is disclosed so reviewers can assess the work on the source, recorded tests and review evidence. Contributions receive the same review requirements regardless of how they were produced.

See [CONTRIBUTING.md](CONTRIBUTING.md), [the security review](docs/SECURITY_REVIEW.md), and [the changelog](CHANGELOG.md). Bug reports should describe the expected and actual URL behavior with synthetic values; never include login links, tokens, browsing histories or private browser profiles.
