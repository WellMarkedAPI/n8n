const { src, dest, parallel } = require('gulp');

// Copy node + credential icons (svg / png) from the source tree to dist/.
// n8n discovers icons via the `icon` field on the node description and
// resolves the path relative to the compiled .js file.
function copyNodeIcons() {
  return src('nodes/**/*.{svg,png}').pipe(dest('dist/nodes'));
}

function copyCredentialIcons() {
  return src('credentials/**/*.{svg,png}', { allowEmpty: true }).pipe(
    dest('dist/credentials'),
  );
}

exports['build:icons'] = parallel(copyNodeIcons, copyCredentialIcons);
