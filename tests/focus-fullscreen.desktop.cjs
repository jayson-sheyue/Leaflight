const {_electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../electron/store.cjs'),demo=require('../electron/demo.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-fullscreen-'));let app;
 const errors=[];const store=new Store(path.join(dir,'library.sqlite'));
 let book=store.create({language:'en',level:'B1',genre:'fantasy',words:1000,totalChapters:3,preferences:''},demo.plan);
 book=store.append(book.id,demo.chapters[0]);store.close();
 try{
  const env={...process.env,NODE_ENV:'test',LEAFLIGHT_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;delete env.LEAFLIGHT_SKIP_NATIVE_FOCUS;
  app=await _electron.launch({...(process.env.LEAFLIGHT_PACKAGED?{executablePath:process.env.LEAFLIGHT_PACKAGED,args:[]}:{args:[path.resolve('.')]}),env});
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  await page.locator('.book-title').click();await page.locator('#reader-scroll').waitFor();
  await page.locator('[data-action=focus-panel][data-panel=reader]').click();
  await page.locator('#focus-exit').waitFor();
  const entered=await app.evaluate(async({BrowserWindow,Menu})=>{const win=BrowserWindow.getAllWindows()[0];const start=Date.now();while(Date.now()-start<4000&&!(win.isFullScreen()||win.isSimpleFullScreen()))await new Promise(resolve=>setTimeout(resolve,50));const menuApi=process.platform!=='darwin';return {presented:!!win.__focusPresentation,menuHidden:menuApi?win.isMenuBarVisible()===false:true,menuKept:!!Menu.getApplicationMenu(),full:win.isFullScreen()||win.isSimpleFullScreen()};});
  assert.equal(entered.presented,true);
  assert.equal(entered.menuHidden,true);
  assert.equal(entered.menuKept,true,'Edit menu must stay available for copy and paste');
  assert.equal(entered.full,true,JSON.stringify(entered));
  assert.equal(await page.locator('.sidebar').isVisible(),false);
  if(!(await page.locator('#focus-exit').isVisible())){await page.evaluate(()=>document.querySelector('.reading-layout')?.dispatchEvent(new MouseEvent('click',{bubbles:true})));await page.locator('#focus-exit').waitFor();}
  await page.locator('#focus-exit').click();
  await page.locator('.sidebar').waitFor();
  const left=await app.evaluate(async({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];const start=Date.now();while(Date.now()-start<4000&&(win.__focusPresentation||win.isFullScreen()||win.isSimpleFullScreen()))await new Promise(resolve=>setTimeout(resolve,50));return {presented:!!win.__focusPresentation,full:win.isFullScreen()||win.isSimpleFullScreen(),menu:process.platform==='darwin'?true:win.isMenuBarVisible()};});
  assert.equal(left.presented,false);assert.equal(left.full,false);assert.equal(left.menu,true);
  assert.deepEqual(errors,[]);
  console.log('PASS: full-window reading hides the menu bar and fills the screen, keeps the application menu for shortcuts, and restores both on exit.');
 }finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
