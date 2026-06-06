// n8n loads this package via the `n8n` block in package.json, which
// points at compiled files in dist/. This file exists only because
// npm requires a `main` entry; it's never imported by n8n itself.
module.exports = {};
