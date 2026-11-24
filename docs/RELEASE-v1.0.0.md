# Untracked v1.0.0

Initial source release, prepared as a draft for owner review.

Untracked removes selected URL tracking parameters before HTTP(S) GET/HEAD requests using two static Manifest V3 declarativeNetRequest rules. It removes 35 common parameter names and domain-scoped YouTube sharing IDs, with no runtime JavaScript, telemetry or package dependencies.

Download the ZIP, extract it to a permanent folder, then use **Load unpacked** in Vivaldi or Chromium's extension manager. Select the extracted `untracked` directory. `SHA256SUMS` contains the release ZIP digest.

Validation includes five source/package checks and 32 request-level integration checks per tested browser. See the [test matrix](TESTING.md) for exact environments, current macOS evidence, and untested areas.

This is an independent MIT-licensed project developed with OpenAI Codex/ChatGPT assistance. It is not affiliated with a browser vendor and does not claim comprehensive tracking protection. Literal parameter matching, GET/HEAD scope, signed-link behavior and other limits are documented in the README.

The repository remains private and this release remains a draft until the owner approves publication. Existing local installations are not replaced automatically.
