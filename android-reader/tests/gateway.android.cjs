const {_android}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{
 const devices=await _android.devices(),d=devices.find(d=>d.serial()==='emulator-5580');assert(d,'Start the dedicated LeaflightTablet emulator on port 5580.');
 assert.equal((await d.shell('getprop ro.boot.qemu.avd_name')).toString().trim(),'LeaflightTablet');const pkg='local.leaflight.reader';
 async function open(){await d.shell('am force-stop '+pkg);await d.shell('am start -W -n '+pkg+'/.MainActivity');const page=await (await d.webView({pkg},{timeout:30000})).page();await page.locator('.shelf-header').waitFor();return page;}
 try{
  await d.installApk(path.resolve(__dirname,'../build/Leaflight-Reader-'+require('../version.json').version+'-debug.apk'));let page=await open();
  assert(await page.evaluate(()=>window.ReaderNative.saveGeminiSettings('AQ.synthetic.native-test.'+'x'.repeat(500),'vertex-express')));
  assert.equal(await page.evaluate(()=>window.ReaderNative.getGeminiProvider()),'vertex-express');assert(await page.evaluate(()=>window.ReaderNative.hasKey()));
  assert.equal(await page.evaluate(()=>window.ReaderNative.saveGeminiSettings('new-key','https://other.invalid')),false);assert.equal(await page.evaluate(()=>window.ReaderNative.saveGeminiSettings('bad\nkey','gemini')),false);
  assert.equal(await page.evaluate(()=>window.ReaderNative.getGeminiProvider()),'vertex-express');
  await page.locator('[data-action=generate]').first().click();await page.locator('[data-action=gemini]').click();await page.locator('[name=gemini-provider]').waitFor();assert.equal(await page.locator('[name=gemini-provider]').inputValue(),'vertex-express');assert.equal(await page.locator('[name=gemini-key]').inputValue(),'');assert.equal(await page.locator('[name=gemini-key]').getAttribute('type'),'password');
  await page.locator('[name=gemini-provider]').selectOption('gemini');await page.locator('[name=gemini-model]').fill('models/gemini-test');await page.locator('[data-action=save-key]').click();assert.equal(await page.evaluate(()=>window.ReaderNative.getGeminiProvider()),'gemini');assert(await page.evaluate(()=>window.ReaderNative.hasKey()));
  page=await open();assert.equal(await page.evaluate(()=>window.ReaderNative.getGeminiProvider()),'gemini');assert(await page.evaluate(()=>window.ReaderNative.hasKey()));
  assert(await page.evaluate(()=>{const ok=window.ReaderNative.beginGeneration('gateway-test-session');window.ReaderNative.endGeneration('gateway-test-session');return ok;}));
  await page.locator('[data-action=generate]').first().click();await page.locator('[data-action=gemini]').click();assert.equal(await page.locator('[name=gemini-model]').inputValue(),'gemini-test');assert.equal(await page.locator('[name=gemini-provider]').inputValue(),'gemini');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));fs.mkdirSync('artifacts/gemini',{recursive:true});await page.screenshot({path:'artifacts/gemini/android-provider-settings.png'});
  console.log('PASS: final native APK saves long AQ keys in Keystore, rejects invalid input atomically, preserves the encrypted key when switching source, normalizes model IDs and keeps settings across restart. No generation request or paid API.');
 }finally{await d.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
