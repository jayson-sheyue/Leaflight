const {testCredentialArgs}=require('./mac-keychain.cjs');
const {_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-gateway-'));let app;const errors=[];
 async function launch(){const env={...process.env,NODE_ENV:'test',LEAFLIGHT_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({...(process.env.LEAFLIGHT_PACKAGED?{executablePath:process.env.LEAFLIGHT_PACKAGED,args:testCredentialArgs}:{args:[path.resolve('.'),...testCredentialArgs]}),env});const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('.title-row').waitFor();return page;}
 async function call(page,c,p){const r=await page.evaluate(async({c,p})=>window.leaflight.call(c,p),{c,p});assert(r.ok,r.error);return r.value;}
 try{
  let page=await launch();assert.equal((await call(page,'settings')).provider,'gemini');
  await page.locator('[data-action=settings]').click();await page.locator('[name=provider]').selectOption('vertex-express');await page.locator('[name=apiKey]').fill('AQ.synthetic.desktop-test');await page.locator('[name=model]').fill('models/gemini-test');await page.locator('[data-action=save-settings]').click();
  assert.equal(await page.locator('[name=provider]').inputValue(),'vertex-express');assert.equal(await page.locator('[name=model]').inputValue(),'gemini-test');assert.equal(await page.locator('[name=apiKey]').inputValue(),'••••••••••••••••');
  await app.evaluate(()=>{global.__gatewayRequests=[];global.fetch=async(url,options)=>{global.__gatewayRequests.push({url,role:JSON.parse(options.body).contents[0].role});return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({title:'Synthetic test',synopsis:'Synthetic test',bible:'Adult learner story.',outline:['One','Two'],sample:'A traveller reached the garden. '.repeat(12),sampleReadings:[],preferenceNotes:[]})}]}}]})};};});
  await call(page,'preview',{language:'en',level:'B1',genre:'fantasy',words:500,totalChapters:2,preferences:'A quiet garden.'});
  await page.waitForFunction(async()=>{const r=await window.leaflight.call('jobs');return r.value.some(j=>j.status==='completed');});
  assert((await app.evaluate(()=>global.__gatewayRequests[0].url)).includes('aiplatform.googleapis.com/v1beta1/'));assert.equal(await app.evaluate(()=>global.__gatewayRequests[0].role),'user');
  assert(!JSON.stringify(await call(page,'jobs')).includes('AQ.synthetic.desktop-test'));
  await page.locator('[name=provider]').selectOption('gemini');await page.locator('[data-action=save-settings]').click();assert((await call(page,'settings')).hasKey);
  await call(page,'preview',{language:'en',level:'B1',genre:'fantasy',words:500,totalChapters:2,preferences:'An old map.'});await page.waitForFunction(async()=>{const r=await window.leaflight.call('jobs');return r.value.filter(j=>j.status==='completed').length===2;});
  assert((await app.evaluate(()=>global.__gatewayRequests[1].url)).includes('generativelanguage.googleapis.com/v1beta/'));
  await call(page,'save-settings',{model:'gemini-test',provider:'vertex-express',apiKey:'',uiLanguage:'en'});await app.close();app=null;
  page=await launch();await page.locator('[data-action=settings]').click();assert.equal(await page.locator('[name=provider]').inputValue(),'vertex-express');assert.equal(await page.locator('[name=apiKey]').inputValue(),'••••••••••••••••');assert((await page.locator('#settings-form').innerText()).includes('Gemini service'));
  fs.mkdirSync('artifacts/gemini',{recursive:true});await page.screenshot({path:'artifacts/gemini/mac-provider-settings.png'});assert.deepEqual(errors,[]);
  console.log('PASS: actual desktop settings, AQ key masking, explicit provider routing, role/schema generation, no credential persistence in jobs, saved source and key across restart. Controlled responses only.');
 }finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
