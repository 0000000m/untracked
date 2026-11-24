# Contributing

Keep Untracked small, predictable and easy to review. Its runtime is declarative JSON; new permissions, runtime scripts, automatic downloads and dependencies need a clear justification.

## Development

Use Node.js 22+, Python 3.11+ and OpenSSL. Clone the repository and run:

```sh
node --test tests/static.test.mjs tests/package.test.mjs
BROWSER_PATH="$(command -v vivaldi)" node tests/network.mjs
```

Use the macOS Chromium executable or another supported browser path as described in [TESTING.md](docs/TESTING.md). Tests create disposable profiles; do not point automation at a personal browser profile. There is no package-install step.

## Proposing a rule change

Explain what the parameter does, link to primary evidence when available, and provide a synthetic before/after URL. Consider whether the name has functional uses, whether the rule needs a domain restriction, and whether signed links could break. Add a real-network regression case for the change and a neighboring case whose functional parameters must remain intact.

Do not paste authentication URLs, tokens, user identifiers or browsing data into issues. Do not copy rules from another project without documenting their source and checking license compatibility. Keep the exact removal list reviewable.

## Pull requests

- Describe the problem and resulting behavior, with test results and browser/OS versions.
- Update relevant documentation and the Unreleased changelog entry.
- Use two-space JSON/JavaScript indentation and standard-library Python tooling.
- Include the source and license of any reused material. Disclose substantial AI assistance and check the result before submitting.
- Run the source/package tests and network suite. Explain any platform you could not test.

Contributions are submitted under the repository's MIT License. No contributor license agreement is required. Reviewers should evaluate permissions, URL semantics, performance costs, compatibility and tests, regardless of the contributor's tooling.

## Preparing a release

1. Update the manifest version, changelog, release notes and version-specific package-test expectations together.
2. Run source/package tests and the Vivaldi/Chromium network matrix.
3. Run `python3 scripts/package.py`. Inspect the ZIP: it must contain only the manifest, rules and license.
4. Review tracked files and commit metadata for secrets and private paths. Keep test profiles, signing keys and generated archives out of Git.
5. Tag the reviewed commit and prepare a draft release with the ZIP and `SHA256SUMS`.
6. Have the repository owner review the result before public publication. A private draft is not a published release.
