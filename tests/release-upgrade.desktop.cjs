// Run against actual mounted release apps; both launches use one temporary profile.
const {_electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const oldPath=process.env.LEAFLIGHT_OLD_APP,newPath=process.env.LEAFLIGHT_NEW_APP;
 assert(oldPath&&newPath,'Set LEAFLIGHT_OLD_APP and LEAFLIGHT_NEW_APP to the actual release executables.');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-upgrade-'));let app;
 const env={...process.env,NODE_ENV:'test',LEAFLIGHT_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
 async function launch(executablePath){
  app=await _electron.launch({executablePath,args:[],env});const page=await app.firstWindow();
  await app.evaluate(()=>{global.fetch=async()=>{throw Error('Upgrade verification must stay offline');};});
  await page.waitForFunction(()=>!!window.leaflight);
  return page;
 }
 async function call(page,command,payload){const r=await page.evaluate(async({command,payload})=>window.leaflight.call(command,payload),{command,payload});assert(r.ok,JSON.stringify(r));return r.value;}
 try{
  let page=await launch(oldPath);assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.11.4');
  const book=await call(page,'demo');
  await call(page,'progress',{id:book.id,progress:{chapter:1,fraction:.4}});
  const marked=await call(page,'bookmark',{id:book.id,progress:{chapter:1,fraction:.4}});
  const draft=await call(page,'writing-new',{title:'Upgrade fixture',language:'en',text:'I wrote a short account of the rain.',goal:''});
  await call(page,'save-settings',{model:'gemini-2.5-flash',uiLanguage:'ja',apiKey:'',clearKey:false});
  await app.close();app=null;
  const before=fs.readFileSync(path.join(dir,'library.sqlite'));
  page=await launch(newPath);assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.11.6');
  const books=await call(page,'library'),saved=books.find(b=>b.id===book.id);
  assert(saved,'Book disappeared after upgrade');assert.equal(saved.chapters.length,book.chapters.length);
  assert.deepEqual(saved.progress,{chapter:1,fraction:.4});assert.deepEqual(saved.bookmarks,marked.bookmarks);
  const drafts=await call(page,'writing-list');assert.equal(drafts.find(d=>d.id===draft.id)?.text,draft.text);
  const settings=await call(page,'settings');assert.equal(settings.uiLanguage,'ja');assert.equal(settings.model,'gemini-2.5-flash');
  await app.close();app=null;
  assert(before.length>0&&fs.statSync(path.join(dir,'library.sqlite')).size>0);
  console.log('PASS: actual v0.11.4 -> v0.11.6 shared-profile upgrade retains books, chapters, legacy progress/bookmarks, draft text and language/model settings. Temporary data; no API calls.');
 }finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
