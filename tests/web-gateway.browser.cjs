const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve('dist'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}try{res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
  await page.addInitScript(()=>localStorage.setItem('leaflight-web-apikey-v1','legacy-synthetic-test-key'));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.book-title').first().waitFor();assert((await page.locator('.book-title').count())>=6);
  await page.locator('[data-action=settings]').click();assert.equal(await page.locator('[name=apiKey]').count(),0);assert.equal(await page.locator('[name=provider]').count(),0);assert((await page.locator('#settings-form').innerText()).includes('网页预览不提供 AI'));
  await page.locator('[name=clearKey]').check();await page.locator('[data-action=save-settings]').click();assert.equal(await page.evaluate(()=>localStorage.getItem('leaflight-web-apikey-v1')),null);
  const result=await page.evaluate(async()=>{await window.leaflight.call('save-settings',{apiKey:'AQ.synthetic-new-key',provider:'vertex-express'});return {settings:await window.leaflight.call('settings'),preview:await window.leaflight.call('preview',{})};});
  assert.equal(result.settings.value.encryptionAvailable,false);assert.equal(result.settings.value.apiGenerationAvailable,false);assert.equal(result.settings.value.hasKey,false);assert.equal(result.preview.ok,false);assert.equal(await page.evaluate(()=>localStorage.getItem('leaflight-web-apikey-v1')),null);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  fs.mkdirSync('artifacts/gemini',{recursive:true});await page.screenshot({path:'artifacts/gemini/web-preview-settings.png'});
  console.log('PASS: merged web preview keeps six preloaded books, does not expose native-only provider/key fields, does not collect new API keys, allows explicit cleanup of legacy keys and sends no model request.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
