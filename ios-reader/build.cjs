// Builds the iOS reader from the Android reader's web bundle plus the native shell.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const dir = __dirname;
const version = require('./version.json');
const xcode = '/usr/bin/xcodebuild';

function run(command, args, cwd = root) {
  const result = cp.spawnSync(command, args, {cwd, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(path.basename(command) + ' exited ' + result.status);
}

function sdkList() {
  return cp.spawnSync(xcode, ['-showsdks'], {encoding: 'utf8'});
}

const sdks = sdkList();
const sdkText = (sdks.stdout || '') + (sdks.stderr || '');
if (sdks.status !== 0 || !sdkText.includes('iphoneos')) {
  console.error('iOS SDK not found. Install the full Xcode app, then run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer');
  console.error('Command Line Tools alone cannot compile or sign an iOS app. This machine cannot produce an installable IPA until Xcode is selected.');
  process.exit(1);
}

run(path.join(root, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'android-reader/tsconfig.json']);
run(path.join(root, 'node_modules/.bin/vite'), ['build', '--config', 'android-reader/vite.config.ts', '--outDir', '../ios-reader/build/web']);
const webIndex = path.join(dir, 'build/web/index.html');
if (!fs.existsSync(webIndex)) throw Error('Vite did not write ios-reader/build/web/index.html');

const derived = path.join(dir, 'build/DerivedData');
fs.rmSync(derived, {recursive: true, force: true});
run(xcode, [
  '-project', path.join(dir, 'LeaflightReader.xcodeproj'),
  '-scheme', 'LeaflightReader',
  '-configuration', 'Release',
  '-destination', 'generic/platform=iOS',
  '-derivedDataPath', derived,
  `MARKETING_VERSION=${version.version}`,
  `CURRENT_PROJECT_VERSION=${version.versionCode}`,
  'CODE_SIGNING_ALLOWED=NO',
  'CODE_SIGNING_REQUIRED=NO',
  'CODE_SIGN_IDENTITY=',
  'build'
]);

const app = path.join(derived, 'Build/Products/Release-iphoneos/LeaflightReader.app');
if (!fs.existsSync(path.join(app, 'Info.plist'))) throw Error('Xcode did not produce LeaflightReader.app');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'leaflight-ipa-'));
const payload = path.join(stage, 'Payload');
fs.mkdirSync(payload);
fs.cpSync(app, path.join(payload, 'LeaflightReader.app'), {recursive: true});
const filename = `Leaflight-Reader-${version.version}-ios-unsigned.ipa`;
const output = path.join(dir, 'build', filename);
const temporary = output + '.tmp';
fs.rmSync(temporary, {force: true});
run('/usr/bin/zip', ['-qr', temporary, 'Payload'], stage);
fs.renameSync(temporary, output);
const hash = crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
fs.writeFileSync(output + '.sha256', hash + '  ' + filename + '\n');
fs.rmSync(stage, {recursive: true, force: true});
const plist = cp.spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', path.join(app, 'Info.plist')], {encoding: 'utf8'});
if (plist.status !== 0 || plist.stdout.trim() !== version.version) throw Error('IPA version does not match ios-reader/version.json');
console.log(JSON.stringify({
  ipa: output,
  version: version.version,
  bundleId: version.bundleId,
  minSystem: version.minSystem,
  signing: 'unsigned; not installable on a device until an Apple Development or Developer ID identity signs it',
  sha256: hash
}, null, 2));
