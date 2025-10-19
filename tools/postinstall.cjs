/* Cross-platform postinstall: ensure public/ exists and copy geopackage assets if present */
const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (e) {
    // ignore if exists
  }
}

function copyIfExists(src, dest) {
  try {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${src} -> ${dest}`);
      return true;
    }
  } catch (e) {
    console.warn(`Could not copy ${src}: ${e.message}`);
  }
  return false;
}

(function main() {
  const projectRoot = process.cwd();
  const pub = path.join(projectRoot, 'public');
  ensureDir(pub);

  const gpkgDir = path.join(projectRoot, 'node_modules', '@ngageoint', 'geopackage', 'dist');
  const files = [
    { src: path.join(gpkgDir, 'sql-wasm.wasm'), dest: path.join(pub, 'sql-wasm.wasm') },
    { src: path.join(gpkgDir, 'geopackage.min.js'), dest: path.join(pub, 'geopackage.min.js') },
  ];

  let ok = true;
  for (const f of files) {
    const copied = copyIfExists(f.src, f.dest);
    ok = ok && copied;
  }
  if (!ok) {
    console.warn('One or more geopackage assets were not found. If you do not use geopackage features, this is safe to ignore.');
  }
})();
