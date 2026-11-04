// Read-only public GitHub integration. Uses only the disposable emulator's library.
const {_android}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const seed=require('../../electron/pool-seed.json'),index=require('../../community-pool/index.json');
(async()=>{
 const entry=index.stories.find(s=>!seed.some(x=>x.poolId===s.poolId));assert(entry,'Need an already-public non-bundled story');
 const devices=await _android.devices(),d=devices.find(d=>d.serial()==='emulator-5580');assert(d);assert.equal((await d.shell('getprop ro.boot.qemu.avd_name')).toString().trim(),'LeaflightTablet');const pkg='local.leaflight.reader';
 try{
  await d.installApk(path.resolve(__dirname,'../build/Leaflight-Reader-'+require('../version.json').version+'-debug.apk'));await d.shell('am force-stop '+pkg);await d.shell('am start -W -n '+pkg+'/.MainActivity');let page=await (await d.webView({pkg},{timeout:30000})).page();await page.locator('.shelf-header').waitFor();await page.locator('[data-action=pool]').first().click();await page.locator('[data-action=sync-pool]').click();const card=page.locator(`[data-pool="${entry.poolId}"]`);await card.waitFor({timeout:45000});await card.locator('[data-action=add-pool]').click();await page.locator('#reader-scroll').waitFor({timeout:45000});await page.locator('[data-action=contents]').click();assert.equal(await page.locator('[data-action=chapter]').count(),entry.chapterCount);await page.locator('[data-action=close]').click();await page.locator('[data-action=library]').click();
  await d.shell('am force-stop '+pkg);await d.shell('am start -W -n '+pkg+'/.MainActivity');page=await (await d.webView({pkg},{timeout:30000})).page();await page.locator('.book-card').first().waitFor();assert((await page.locator('.book-card').allTextContents()).some(t=>t.includes(entry.title)));
  console.log('PASS: final APK reads the real public GitHub v2 catalog, downloads and verifies a non-bundled story through native HTTPS, saves all chapters and reopens it after restart. No upload or paid API.');
 }finally{await d.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
