const {_electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../electron/store.cjs'),demo=require('../electron/demo.cjs');
const {JobQueue}=require('../electron/jobs.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-focus-'));let app;const errors=[];
 fs.mkdirSync('artifacts',{recursive:true});const s=new Store(path.join(dir,'library.sqlite'));
 let book=s.create({language:'en',level:'B1',genre:'fantasy',words:1000,totalChapters:3,preferences:''},demo.plan);
 for(const chapter of demo.chapters)book=s.append(book.id,{...chapter,text:chapter.text+'\n\n'+chapter.text});
 const source=Array.from({length:24},(_,i)=>`Scene ${i+1}. I watched the rain outside and wrote a letter to my friend.`).join('\n\n');
 const draft=s.writing.create({title:'A rainy afternoon',language:'en',text:source,goal:''});
 const review=s.writing.record('focus-review',draft,{summary:'A readable narrative.',strengths:['Clear details.'],dimensions:['grammar','vocabulary','logic','fluency'].map(id=>({id,assessment:'The meaning is clear.',issues:id==='grammar'?[{kind:'suggestion',original:'I watched',replacement:'I was watching',reason:'Emphasize an ongoing action.'}]:[]})),correctedText:source,practice:['Add a sound.']},'zh','mock');
 const queue=new JobQueue(s,async()=>{}),now=new Date().toISOString();queue.save({id:'focus-review-job',type:'review',title:draft.title,draftId:draft.id,status:'completed',stage:'已完成',revision:1,createdAt:now,updatedAt:now,result:{draftId:draft.id,reviewId:review.id}});queue.shutdown();s.close();
 try{
  const env={...process.env,NODE_ENV:'test',LEAFLIGHT_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({...(process.env.LEAFLIGHT_PACKAGED?{executablePath:process.env.LEAFLIGHT_PACKAGED,args:[]}:{args:[path.resolve('.')]}),env});
  let page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
  await app.evaluate(()=>{global.fetch=async()=>{throw Error('Focus tests must remain offline');};});
  async function paint(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
  async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  for(const width of [1360,960]){
   await app.browserWindow(page).then(w=>w.evaluate((win,width)=>win.setSize(width,900),width));
   await page.locator('[data-action=writing]').click();await page.locator('.review-report').waitFor();
   const edited=source+'\nThis sentence is still being edited.';
   await page.locator('#writing-text').fill(edited);await page.locator('#writing-text').evaluate(el=>{window.__editor=el;el.setSelectionRange(10,35);});
   await page.locator('.writing-version').first().locator('summary').click();
   await page.evaluate(()=>{window.__review=document.querySelector('.review-report');});
   const normal=await page.locator('.writing-editor').evaluate(el=>el.getBoundingClientRect().width);
   await page.locator('[data-action=focus-panel][data-panel=editor]').click();await paint();
   assert.equal(await page.locator('body').getAttribute('data-focus'),'editor');
   assert.equal(await page.locator('.writing-feedback').isVisible(),false);assert.equal(await page.locator('.writing-list').isVisible(),false);
   assert(await page.locator('.writing-editor').evaluate((el,w)=>el.getBoundingClientRect().width>w+100,normal));
   assert(await page.evaluate(()=>document.querySelector('#writing-text')===window.__editor));assert.equal(await page.locator('#writing-text').inputValue(),edited);
   assert.deepEqual(await page.locator('#writing-text').evaluate(el=>[el.selectionStart,el.selectionEnd]),[10,35]);await noOverflow();
   await page.locator('[data-action=focus-panel][data-panel=editor]').click();await paint();
   assert.equal(await page.locator('.writing-feedback').isVisible(),true);assert(await page.locator('.writing-version').first().evaluate(el=>el.open));
   await page.locator('[data-action=focus-panel][data-panel=review]').click();await paint();
   assert.equal(await page.locator('.writing-editor').isVisible(),false);assert(await page.evaluate(()=>document.querySelector('.review-report')===window.__review));
   assert(await page.locator('.writing-version').first().evaluate(el=>el.open));await noOverflow();
   const reviewWidth=await page.locator('.writing-feedback').evaluate(el=>el.getBoundingClientRect().width);
   await page.locator('.sidebar [data-action=inbox]').click();await page.locator('.inbox').waitFor();
   assert.equal(await page.locator('.writing-feedback').evaluate(el=>el.getBoundingClientRect().width),reviewWidth,'inbox shrank the expanded review');
   await page.keyboard.press('Escape');assert.equal(await page.locator('body').getAttribute('data-focus'),'review');
   await page.locator('.sidebar [data-action=settings]').click();await page.locator('.modal').waitFor();await page.keyboard.press('Escape');
   assert.equal(await page.locator('body').getAttribute('data-focus'),'review');
   await page.screenshot({path:`artifacts/panel-focus-review-${width}.png`});
   await page.locator('[data-action=writer-locate]').first().click();assert.equal(await page.locator('body').getAttribute('data-focus'),'editor');
   assert.equal(await page.locator('#writing-text').evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd)),'I watched');
   await page.locator('.sidebar [data-action=inbox]').click();await page.locator('[data-action=view-job][data-id=focus-review-job]').click();
   assert.equal(await page.locator('body').getAttribute('data-focus'),'review');assert.equal(await page.locator('.writing-feedback').isVisible(),true);
   await page.keyboard.press('Escape');assert.equal(await page.locator('body').getAttribute('data-focus'),null);
   assert.equal(await page.locator('.writing-list').isVisible(),true);assert.equal(await page.locator('#writing-text').inputValue(),edited);
   // Reading reflows into a different number of columns without losing the text.
   await page.locator('.sidebar [data-action=library]').click();await page.locator('.book-title').click();
   await page.locator('[data-action=appearance]').click();await page.selectOption('[name=mode]','pages');await page.locator('[data-action=close]').click();await paint();
   await page.locator('[data-action=next]').click();await paint();
   await page.evaluate(()=>{const el=document.querySelector('#reader-scroll'),v=el.getBoundingClientRect(),w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode;if(!n.textContent.trim()||n.parentElement.closest('rt,.chapter-kicker,.chapter-divider,.end-mark'))continue;for(let i=0;i<n.length;i++){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();if(b.left>=v.left&&b.right<=v.right&&b.top>=v.top&&b.bottom<=v.bottom){window.__readingAnchor=r;window.__prose=document.querySelector('#prose');return;}}}throw Error('No visible reading character');});
   const oldWidth=await page.locator('#reader-scroll').evaluate(el=>el.clientWidth);
   await page.locator('[data-action=bookmark]').click();await page.waitForFunction(()=>document.querySelector('[data-action=bookmark]')?.getAttribute('aria-pressed')==='true');
   for(const enter of [true,false]){
    await page.locator('[data-action=focus-panel][data-panel=reader]').click();await paint();
    assert.equal(await page.locator('.toc').isVisible(),!enter);
    assert.equal(await page.locator('[data-action=bookmark]').getAttribute('aria-pressed'),'true');
    if(enter)assert(await page.locator('#reader-scroll').evaluate((el,w)=>el.clientWidth>w+150,oldWidth));
    const reading=await page.evaluate(()=>{const el=document.querySelector('#reader-scroll'),r=window.__readingAnchor.getBoundingClientRect(),v=el.getBoundingClientRect();return {same:document.querySelector('#prose')===window.__prose,anchor:r.toJSON(),viewport:v.toJSON(),left:el.scrollLeft,width:el.clientWidth,margin:getComputedStyle(document.querySelector('.reader-pane')).getPropertyValue('--page-margin')};});
    assert(reading.same&&reading.anchor.left>=reading.viewport.left-1&&reading.anchor.right<=reading.viewport.right+1&&reading.anchor.bottom>reading.viewport.top&&reading.anchor.top<reading.viewport.bottom,JSON.stringify({width,enter,reading}));await noOverflow();
   }
   await page.locator('[data-action=bookmark]').click();await page.waitForFunction(()=>document.querySelector('[data-action=bookmark]')?.getAttribute('aria-pressed')==='false');
   await page.locator('[data-action=focus-panel][data-panel=reader]').click();await paint();await page.locator('[data-action=next]').click();await paint();
   await page.evaluate(()=>{const el=document.querySelector('#reader-scroll'),v=el.getBoundingClientRect(),w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode;if(!n.textContent.trim()||n.parentElement.closest('rt,.chapter-kicker,.chapter-divider,.end-mark'))continue;for(let i=0;i<n.length;i++){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();if(b.left>=v.left&&b.right<=v.right&&b.top>=v.top&&b.bottom<=v.bottom){window.__readingAnchor=r;window.__prose=document.querySelector('#prose');return;}}}throw Error('No visible reading character');});
   await page.locator('[data-action=focus-panel][data-panel=reader]').click();await paint();
   assert(await page.evaluate(()=>{const r=window.__readingAnchor.getBoundingClientRect(),v=document.querySelector('#reader-scroll').getBoundingClientRect();return r.left>=v.left-1&&r.right<=v.right+1&&r.top<v.bottom&&r.bottom>v.top;}),'restoring layout undid a page turn made while expanded');
   await page.locator('.sidebar [data-action=library]').click();assert.equal(await page.locator('body').getAttribute('data-focus'),null);
  }
  await page.locator('.book-title').click();await paint();await page.locator('[data-action=focus-panel][data-panel=reader]').click();await paint();await page.locator('[data-action=next]').click();await paint();
  await app.close();app=null;
  const savedStore=new Store(path.join(dir,'library.sqlite')),saved=savedStore.get(book.id).progress;savedStore.close();assert(Number.isInteger(saved.paragraph)&&Number.isInteger(saved.index));
  app=await _electron.launch({...(process.env.LEAFLIGHT_PACKAGED?{executablePath:process.env.LEAFLIGHT_PACKAGED,args:[]}:{args:[path.resolve('.')]}),env});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  await page.locator('.book-title').click();await paint();
  assert(await page.evaluate(progress=>{const p=document.querySelectorAll('#prose p')[progress.paragraph],n=p?.firstChild;if(!n)return false;const r=document.createRange(),i=Math.min(progress.index,n.textContent.length-1);r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect(),v=document.querySelector('#reader-scroll').getBoundingClientRect();return b.left>=v.left-1&&b.right<=v.right+1&&b.bottom>v.top&&b.top<v.bottom;},saved),'restart lost the text saved in the expanded reader');
  assert.deepEqual(errors,[]);console.log('PASS: reader/editor/review expansion at 1360/960, compact navigation, hidden auxiliary panels, unchanged draft/selection/review DOM and disclosures, reading text retained through layout changes and restart, inbox overlay and Escape priority. No API calls.');
 }finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
