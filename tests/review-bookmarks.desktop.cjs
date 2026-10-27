const {_electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../electron/store.cjs'),demo=require('../electron/demo.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-review-bookmarks-'));let app;const errors=[];
 fs.mkdirSync('artifacts',{recursive:true});const store=new Store(path.join(dir,'library.sqlite'));
 let book=store.create({language:'en',level:'B1',genre:'fantasy',words:1000,totalChapters:3,preferences:''},demo.plan);
 book=store.append(book.id,{...demo.chapters[0],text:Array.from({length:40},(_,i)=>`Paragraph ${i+1}. `+('The traveller reached the garden and wrote about the changing weather. ').repeat(6)).join('\n\n')});
 book.bookmarks=[{id:'legacy',chapter:0,fraction:.4},{id:'anchored',chapter:0,fraction:0,paragraph:0,index:120},{id:'anchored-duplicate',chapter:0,fraction:0,paragraph:0,index:160},{id:'other',chapter:0,fraction:.9,paragraph:35,index:0}];store.put(book);
 const fixture=process.env.LEAFLIGHT_REVIEW_FIXTURE?JSON.parse(fs.readFileSync(process.env.LEAFLIGHT_REVIEW_FIXTURE,'utf8')):null;
 const source=fixture?.snapshot.text??Array.from({length:25},(_,i)=>`Scene ${i+1}: I walked through the garden and watched the rain fall. The path was quiet.`).join('\n\n');
 const corrected=fixture?.correctedText??source.replaceAll('walked','wandered');
 const draft=store.writing.create({title:'A long review',language:'en',text:source,goal:''});
 store.writing.record('fixture-review',draft,{summary:'Clear descriptions.',strengths:['A clear setting.'],dimensions:['grammar','vocabulary','logic','fluency'].map(id=>({id,assessment:'The passage is readable.',issues:[]})),correctedText:corrected,practice:['Describe a sound.']},'zh','mock');store.close();
 try{
  const env={...process.env,NODE_ENV:'test',LEAFLIGHT_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({...(process.env.LEAFLIGHT_PACKAGED?{executablePath:process.env.LEAFLIGHT_PACKAGED,args:[]}:{args:[path.resolve('.')]}),env});
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
  await app.evaluate(()=>{global.fetch=async()=>{throw Error('No live requests allowed');};});
  await page.locator('[data-action=writing]').click();await page.locator('.review-report').waitFor();
  for(const width of [1360,960]){
   await app.browserWindow(page).then(w=>w.evaluate((win,width)=>win.setSize(width,900),width));
   for(let i=0;i<2;i++){
    const details=page.locator('.writing-version').nth(i),summary=details.locator('summary');
    await details.click({position:{x:12,y:6}});assert(await details.evaluate(el=>el.open),`review ${i} did not open at ${width}`);
    await details.locator('.writing-comparison-text').waitFor({state:'visible'});
    assert.equal(await details.locator('.writing-comparison-text').textContent(),i===0?source:corrected);
    await summary.focus();await page.keyboard.press('Enter');assert.equal(await details.evaluate(el=>el.open),false);
    await page.keyboard.press('Space');assert(await details.evaluate(el=>el.open));
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('jobs-updated',[]));
    assert(await details.evaluate(el=>el.open),'job updates closed the review');
    if(!fixture)await page.screenshot({path:`artifacts/review-expanded-${width}-${i}.png`});
    await summary.click();assert.equal(await details.evaluate(el=>el.open),false);
   }
  }
  console.log('PASS: original/revised review sections open by mouse and keyboard, preserve full text, and survive job updates at 1360/960.');
  if(process.env.LEAFLIGHT_REVIEW_ONLY)return;
  await page.locator('.sidebar [data-action=library]').click();await page.locator('.book-title').click();
  await page.locator('[data-action=appearance]').click();await page.selectOption('[name=mode]','pages');await page.selectOption('[name=effect]','none');await page.locator('[data-action=close]').click();
  async function library(){return (await page.evaluate(()=>window.leaflight.call('library'))).value[0];}
  for(const id of ['anchored','legacy']){
   await page.locator(`[data-action=goto-mark][data-mark=${id}]`).click();
   await page.waitForFunction(()=>document.querySelector('[data-action=bookmark]')?.getAttribute('aria-pressed')==='true');
   await page.locator('[data-action=appearance]').click();await page.locator('[name=size]').fill('30');await page.locator('[name=size]').dispatchEvent('input');await page.locator('[data-action=close]').click();
   await page.locator(`[data-action=goto-mark][data-mark=${id}]`).click();
   await page.waitForFunction(()=>document.querySelector('[data-action=bookmark]')?.getAttribute('aria-pressed')==='true');
   await page.locator('[data-action=bookmark]').click();
   await page.waitForFunction(async(id)=>!(await window.leaflight.call('library')).value[0].bookmarks.some(m=>m.id===id),id);
   await page.waitForFunction(()=>document.querySelector('[data-action=bookmark]')?.getAttribute('aria-pressed')==='false');
   assert((await library()).bookmarks.some(m=>m.id==='other'),'cancelling removed an unrelated bookmark');
   if(id==='anchored')assert(!(await library()).bookmarks.some(m=>m.id==='anchored-duplicate'),'same-page duplicate survived cancellation');
  }
  // A list-level removal must work without visiting the bookmarked page.
  await page.locator('[data-action=remove-bookmark][data-mark=other]').click();
  await page.waitForFunction(async()=>(await window.leaflight.call('library')).value[0].bookmarks.length===0);
  await page.locator('[data-action=bookmark]').click();await page.waitForFunction(async()=>(await window.leaflight.call('library')).value[0].bookmarks.length===1);
  await page.locator('[data-action=bookmark]').click();await page.waitForFunction(async()=>(await window.leaflight.call('library')).value[0].bookmarks.length===0);
  assert.deepEqual(errors,[]);console.log('PASS: legacy and mid-paragraph bookmarks cancel after font reflow, unrelated marks remain, list removal and toggle work.');
 }finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
