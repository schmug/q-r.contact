# vendor/

Third-party libraries used by `/picture/`. Copied unmodified from the npm
tarballs; the site has no build step, so they are committed as plain files.
To upgrade: `npm pack <name>@<version>`, copy the `dist` file in under the new
versioned name, update `picture/index.html` and `sw.js`, bump the SW cache.

| File | Package | License | Source file in tarball | SHA-256 |
|---|---|---|---|---|
| `qrcode-generator-2.0.4.js` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4 | MIT — [`LICENSE-qrcode-generator`](LICENSE-qrcode-generator) | `dist/qrcode.js` | `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` |
| `jsqr-1.4.0.js` | [jsQR](https://github.com/cozmo/jsQR) 1.4.0 | Apache-2.0 — [`LICENSE-jsqr`](LICENSE-jsqr) | `dist/jsQR.js` | `bc40c8a15196236b2314db0856f72ca0b49980cd5413b8c852a7349f5fee0859` |
