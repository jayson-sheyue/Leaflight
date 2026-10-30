// Destructive only inside the explicitly named, disposable LeaflightTablet emulator.
const {_android}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),demo=require('../../electron/demo.cjs');
(async()=>{
 const devices=await _android.devices(),d=devices.find(d=>d.serial()===(process.env.ANDROID_SERIAL||'emulator-5580'));
 assert(d&&d.serial().startsWith('emulator-'),'Use the isolated LeaflightTablet emulator, never a personal device.');
 assert.equal((await d.shell('getprop ro.boot.qemu.avd_name')).toString().trim(),'LeaflightTablet');
 const apk=path.resolve(__dirname,'../build/Leaflight-Reader-'+require('../version.json').version+'-debug.apk'),pkg='local.leaflight.reader';let page;const errors=[];
 try{
  await d.installApk(process.env.READER_UPGRADE_FROM?path.resolve(process.env.READER_UPGRADE_FROM):apk);await d.shell('am force-stop '+pkg);await d.shell('pm clear '+pkg);await d.shell('am force-stop com.google.android.documentsui');await d.shell('rm -f /sdcard/Download/Leaflight-Reader-native-test.json');
  await d.shell('am start -n '+pkg+'/.MainActivity');
  async function connect(){page=await (await d.webView({pkg},{timeout:30000})).page();page.on('pageerror',e=>errors.push(e.message));await page.locator('.shelf-header').waitFor();}
  await connect();await page.locator('.empty').waitFor();assert.equal(page.url(),'https://appassets.androidplatform.net/assets/index.html');
  const book={id:'native-pad-fixture',title:'The Rain Map',synopsis:'A mapmaker follows a trail of rain through a coastal town.',preset:{language:'en',level:'B1'},chapters:demo.chapters.map((c,i)=>({id:'native-chapter-'+i,title:c.title,text:c.text+'\n\n'+c.text})),progress:{chapter:0,fraction:0},bookmarks:[],updatedAt:new Date().toISOString()};
  await d.push(Buffer.from(JSON.stringify({format:'leaflight',version:1,books:[book]})),'/sdcard/Download/Leaflight-test.json');
  await page.locator('[data-action=import]').first().click();
  // Open the navigation drawer. Its row has a stable title ID distinct from the toolbar.
  await d.tap({desc:'Show roots'});await d.wait({res:'android:id/title',text:'Downloads'},{timeout:10000});await d.tap({res:'android:id/title',text:'Downloads'});
  await d.wait({res:'android:id/title',text:'Leaflight-test.json'},{timeout:45000});await d.tap({res:'android:id/title',text:'Leaflight-test.json'});await page.locator('.book-card').waitFor();
  assert.equal(await page.locator('.book-card').count(),1);
  await d.shell('am force-stop '+pkg);await d.installApk(apk);await d.shell('am start -n '+pkg+'/.MainActivity');await connect();assert.equal(await page.locator('.book-card').count(),1);
  await page.locator('[data-action=open]').first().click();await page.locator('#progress').waitFor();await page.waitForFunction(()=>!!document.querySelector('#progress')?.textContent);
  await page.evaluate(()=>{window.__nativeTurnVisibility=null;const observer=new MutationObserver(()=>{const el=document.querySelector('.turn-incoming>.reader-scroll');if(el){window.__nativeTurnVisibility=getComputedStyle(el).visibility;observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});});await page.locator('[data-action=next]').click();await page.waitForFunction(()=>window.__nativeTurnVisibility!==null);assert.equal(await page.evaluate(()=>window.__nativeTurnVisibility),'visible');await page.waitForSelector('.page-turn-stage',{state:'detached'});const before=await page.locator('#reader-scroll').evaluate(el=>el.scrollLeft);
  await d.input.swipe({x:1250,y:1200},[{x:400,y:1200}],40);
  await page.waitForFunction(left=>document.querySelector('#reader-scroll').scrollLeft>left,before);
  await page.waitForSelector('.page-turn-stage',{state:'detached'});await page.locator('#bookmark').click();
  await page.waitForFunction(()=>document.querySelector('#bookmark')?.getAttribute('aria-pressed')==='true');
  await page.locator('[data-action=settings]').click();await page.locator('[data-theme=ocean]').click();await d.input.press('Back');await page.waitForSelector('.modal',{state:'detached'});
  await page.evaluate(()=>window.readerFlush());await page.waitForTimeout(300);
  const saved=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('leaflight-reader',1);r.onsuccess=()=>resolve(r.result);});const result=await new Promise(resolve=>{const r=db.transaction('books').objectStore('books').get('native-pad-fixture');r.onsuccess=()=>resolve(r.result);});db.close();return result;});
  assert.equal(saved.bookmarks.length,1);assert(Number.isInteger(saved.progress.paragraph));
  await d.shell('settings put system accelerometer_rotation 0');await d.shell('settings put system user_rotation 1');await page.waitForFunction(()=>innerWidth>innerHeight);
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  fs.mkdirSync('artifacts/android',{recursive:true});await page.screenshot({path:'artifacts/android/native-reader-landscape.png'});
  await d.shell('settings put system user_rotation 0');await page.waitForFunction(()=>innerHeight>innerWidth);
  await page.locator('[data-action=library]').click();await page.locator('.shelf-header').waitFor();
  await page.locator('[data-action=generate]').click();await page.locator('[data-action=gemini]').click();await page.locator('[name=gemini-key]').fill('native-test-key-only');await page.locator('[data-action=save-key]').click();await page.locator('[data-action=close]').click();
  const encrypted=(await d.shell('run-as '+pkg+' cat shared_prefs/gemini.xml')).toString();assert(!encrypted.includes('native-test-key-only'));
  await page.locator('[data-action=backup]').click();
  // This Android image exposes the save dialog unreliably to Playwright's driver after rotation.
  // Query the actual system hierarchy, then send normal taps/keys. The resulting SAF file is still verified below.
  await d.shell('am force-stop com.microsoft.playwright.androiddriver');
  async function systemControl(resource,expectedText){for(let n=0;n<6;n++){await d.shell('uiautomator dump /sdcard/leaflight-export-ui.xml');const xml=(await d.shell('cat /sdcard/leaflight-export-ui.xml')).toString();const nodes=xml.match(/<node [^>]+>/g)||[];const node=nodes.find(v=>v.includes('resource-id="'+resource+'"')&&v.includes('package="com.google.android.documentsui"')&&(!expectedText||v.includes('text="'+expectedText+'"')));if(node){const b=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert(b);return {x:Math.round((+b[1]+ +b[3])/2),y:Math.round((+b[2]+ +b[4])/2)};}}throw Error('Missing system control '+resource);}
  const field=await systemControl('android:id/title','Leaflight-Reader-backup.json');await d.shell('input tap '+field.x+' '+field.y);await d.shell('input keycombination 113 29');await d.shell('input text Leaflight-Reader-native-test.json');await systemControl('android:id/title','Leaflight-Reader-native-test.json');const saveButton=await systemControl('android:id/button1');await d.shell('input tap '+saveButton.x+' '+saveButton.y);
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('备份已保存'));
  const exported=JSON.parse((await d.shell('cat /sdcard/Download/Leaflight-Reader-native-test.json')).toString());assert(!JSON.stringify(exported).includes('native-test-key-only'));assert.equal(exported.format,'leaflight-reader');assert.equal(exported.books[0].bookmarks.length,1);assert.equal(exported.settings.theme,'ocean');
  // Reinstall this same signed APK and restart; Android must retain the existing profile.
  await d.shell('am force-stop '+pkg);await d.installApk(apk);await d.shell('am start -n '+pkg+'/.MainActivity');await connect();
  assert.equal(await page.evaluate(()=>window.ReaderNative.hasKey()),true);await page.locator('[data-action=open]').first().click();await page.waitForFunction(()=>!!document.querySelector('#progress')?.textContent);
  assert.equal(await page.locator('#bookmark').getAttribute('aria-pressed'),'true');await page.locator('#bookmark').click();await page.waitForFunction(()=>document.querySelector('#bookmark')?.getAttribute('aria-pressed')==='false');
  assert.deepEqual(errors,[]);console.log('PASS: actual Android 16 APK upgrade from prior version, encrypted keystore persistence, offline asset origin, native SAF import/export, physical swipe, bookmark, theme, hardware Back, rotation, signed reinstall and persisted library. Emulator-only test data.');
 }finally{
  await d.shell('am force-stop com.microsoft.playwright.androiddriver').catch(()=>{});
  await d.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
