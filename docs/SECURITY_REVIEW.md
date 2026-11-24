# Security, reliability and efficiency review

Scope: the v1.0.0 source and distributable package. This is a project review assisted by OpenAI Codex/ChatGPT, not an independent audit. Findings are bounded by the tested browser versions and cases.

| Area | Finding and treatment |
| --- | --- |
| Runtime attack surface | Two JSON files. No worker, page script, executable remote code, storage, telemetry or external fetch. |
| Permissions | DNR with host access plus HTTP(S) destinations is sufficient for these redirects. Cookies, tabs, history, scripting, webRequest, clipboard, native messaging and debugging permissions are absent. |
| Redirect destination | Rules only remove query keys. They do not change scheme, host, port, path, credentials or fragment, or introduce another server. Tests protect functional values and encoding. |
| Request timing | No response-header condition or page-load script. Local HTTP/HTTPS servers observe only the cleaned path for positive cases; a no-extension control observes the original tracking keys. |
| Request methods | GET and HEAD only. POST, PUT, PATCH and DELETE URL/body preservation is checked at the server. |
| Rule scope | Generic functional keys are not removed globally. The ambiguous `si` name is limited to YouTube page/frame requests. A lookalike domain is tested as a negative case. |
| Redirect loops | Unchanged URLs and overlapping YouTube/global cleanup are exercised with exact server request-count/path assertions and bounded browser calls. |
| Efficiency | One simple global query-marker matcher and one short regex, both evaluated by the browser. The broad global match can consider unrelated queries; the native no-op transform leaves them alone. No performance benchmark or zero-overhead claim is made. |
| Release identity | The prototype's signing identity, CRX, private key, profile names, installation receipts and session backups are excluded. The release ZIP uses an explicit three-file allowlist. |
| Test isolation | Fresh temporary profiles, private DevTools pipes, loopback-bound fixtures, and cleanup of owned test processes. The test-only certificate exception is pinned to an ephemeral public key and does not modify the OS trust store. |
| Test portability | Browser executable supplied through an environment variable. No personal profile path is accepted or copied. No production install/restart script is shipped. |
| Dependency surface | Extension: no dependencies. Tests: Node/Python standard libraries and OpenSSL. CI: official actions pinned by commit, browsers pinned by revision and archive SHA-256. |

## Accepted limitations

Selected names can have site-specific functional meaning. A signed query can become invalid when a covered parameter is removed. The project does not attempt arbitrary signature detection or URL decoding: doing so would expand both behavior and maintenance burden. Browser site-access controls and the extension toggle provide an escape hatch.

No completeness claim is made about tracking prevention. Headers, cookies, page content, fragments, history and requests already transmitted are outside the removal operation. Site service workers, cache behavior, browser policies and interactions with other extensions have not been exhaustively tested. Restricting host access or leaving private-window access disabled narrows coverage.

## Reporting concerns

Use a minimal synthetic URL, affected browser/OS version and reproducible steps. Avoid publishing live login links, cookies, tokens, browsing histories or profile files. For a sensitive vulnerability, use the repository's private vulnerability-reporting facility if the owner has enabled it; otherwise open a minimal issue requesting a private contact channel without including exploit details or confidential data.
