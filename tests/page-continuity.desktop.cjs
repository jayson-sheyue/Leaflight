const {_electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../electron/store.cjs');const demo=require('../electron/demo.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-continuity-'));let app;const errors=[];
 const s=new Store(path.join(dir,'library.sqlite'));
 for(const language of ['en','ja']){
  let b=s.create({language,level:language==='en'?'B1':'N4',genre:'adventure',words:1000,totalChapters:3,preferences:''},{...demo.plan,title:language+' continuity'});
  for(let n=0;n<3;n++)b=s.append(b.id,language==='en'?{...demo.chapters[n],text:demo.chapters[n].text+'\n\n'+demo.chapters[(n+1)%3].text}:{title:'町から海へ '+n,text:Array.from({length:40},(_,i)=>`${i+1}。町から海へ出かけました。友達と一緒に、あおい空を見ました。道は長くて、風が吹いていました。`).join('\n\n'),summary:'旅',memory:'旅の記録',readings:[{surface:'町',reading:'まち'},{surface:'海',reading:'うみ'},{surface:'友達',reading:'ともだち'}]});
 }
 s.close();
 try{
  const env={...process.env,NODE_ENV:'test',LEAFLIGHT_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({...(process.env.LEAFLIGHT_PACKAGED?{executablePath:process.env.LEAFLIGHT_PACKAGED,args:[]}:{args:[path.resolve('.')]}),env});
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);await page.emulateMedia({reducedMotion:'no-preference'});await page.addStyleTag({content:'.toast{visibility:hidden!important}'});
  // Hold the naturally rendered final frame long enough to capture it. Seeking
  // paused compositor animations is not equivalent to actual user playback.
  await page.evaluate(()=>{const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.closest('.page-turn-stage'))options={...options,endDelay:1000};return animate.call(this,frames,options);};});
  async function settled(){await page.waitForFunction(()=>document.body.dataset.turning!=='true'&&!document.querySelector('.page-turn-stage'));await page.waitForTimeout(80);}
  for(const language of ['en','ja']){
   await page.locator('.book-title').filter({hasText:language+' continuity'}).click();await page.locator('#prose').waitFor();
   await page.locator('[data-action=appearance]').click();await page.selectOption('[name=mode]','pages');await page.selectOption('[name=effect]','none');await page.locator('.close[data-action=close]').click();await settled();
   await page.locator('[data-action=next]').click();await settled();
   // Keep a reference to the first visible character; font changes must retain it.
   await page.evaluate(()=>{const el=document.querySelector('#reader-scroll'),v=el.getBoundingClientRect(),walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);while(walk.nextNode()){const n=walk.currentNode;if(n.parentElement.closest('rt,.chapter-kicker,.chapter-divider'))continue;for(let i=0;i<n.length;i++){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();if(b.left>v.left&&b.right<v.right&&b.top>=v.top&&b.bottom<=v.bottom){window.__readingCharacter=r;return;}}}throw Error('no visible anchor');});
   await page.locator('[data-action=appearance]').click();await page.locator('[name=size]').fill('30');await page.locator('[name=size]').dispatchEvent('input');await page.locator('.close[data-action=close]').click();await settled();
   assert(await page.evaluate(()=>{const r=window.__readingCharacter.getBoundingClientRect(),v=document.querySelector('#reader-scroll').getBoundingClientRect();return r.left>=v.left&&r.right<=v.right&&r.bottom>v.top&&r.top<v.bottom;}),'resizing lost the reading character');
   await page.locator('[data-action=bookmark]').click();await page.locator('.bookmark-item').waitFor();
   const mark=(await page.evaluate(()=>window.leaflight.call('library'))).value.find(b=>b.title.startsWith(language)).bookmarks[0];assert(Number.isInteger(mark.paragraph));
   await page.locator('[data-action=appearance]').click();await page.locator('[name=size]').fill('20');await page.locator('[name=size]').dispatchEvent('input');await page.locator('.close[data-action=close]').click();await page.waitForTimeout(300);await page.locator('.bookmark-item').click();await settled();
   const currentPage=await page.locator('#reader-scroll').evaluate(el=>Math.round(el.scrollLeft/el.clientWidth)+1);assert((await page.locator('.bookmark-item').textContent()).includes(`第 ${currentPage} 页`));
   for(const effect of ['slide','paper','cube-in','cube-out','flip','bounce','fade','carousel']){
    await page.locator('[data-action=appearance]').click();await page.selectOption('[name=effect]',effect);await page.locator('.close[data-action=close]').click();await settled();
    await page.locator('[data-action=next]').click();await page.waitForFunction(()=>!!document.querySelector('.turn-incoming'));
    await page.waitForFunction(()=>{const animations=document.querySelector('.page-turn-stage')?.getAnimations({subtree:true});return animations?.length&&animations.every(a=>a.effect.getComputedTiming().progress===1);});
    const result=await page.evaluate(()=>{
     const stage=document.querySelector('.page-turn-stage'),next=stage.querySelector('.turn-incoming'),live=document.querySelector('#reader-scroll');
     const a=live.querySelector('.prose'),b=next.querySelector('.prose');let max=0,count=0;
     const wa=document.createTreeWalker(a,NodeFilter.SHOW_TEXT),wb=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);
     while(wa.nextNode()&&wb.nextNode()){
      const ra=document.createRange(),rb=document.createRange();ra.selectNodeContents(wa.currentNode);rb.selectNodeContents(wb.currentNode);
      const ar=[...ra.getClientRects()],br=[...rb.getClientRects()];if(ar.length!==br.length)return {error:'line counts differ'};
      for(let i=0;i<ar.length;i++){max=Math.max(max,Math.abs(ar[i].x-br[i].x),Math.abs(ar[i].y-br[i].y),Math.abs(ar[i].width-br[i].width),Math.abs(ar[i].height-br[i].height));count++;}
     }
     const v=live.getBoundingClientRect();return {max,count,clip:{x:Math.ceil(v.x)+1,y:Math.ceil(v.y)+1,width:Math.floor(v.width)-2,height:Math.floor(v.height)-2}};
    });
    assert(!result.error,JSON.stringify(result));assert(result.count>20);assert(result.max<.1,`${language}/${effect}: character geometry drift ${result.max}`);
    // Compare actual renderer pixels before/after the handoff, not just scrollLeft.
    await page.waitForTimeout(80);
    fs.writeFileSync('artifacts/continuity-incoming.png',Buffer.from(await app.evaluate(async({BrowserWindow},clip)=>{const image=await BrowserWindow.getAllWindows()[0].webContents.capturePage(clip);global.__incoming=image.toBitmap();return image.toPNG().toString('base64');},result.clip),'base64'));
    await page.evaluate(()=>document.querySelector('.page-turn-stage').style.visibility='hidden');await page.waitForTimeout(80);
    const pixels=await app.evaluate(async({BrowserWindow},clip)=>{const image=await BrowserWindow.getAllWindows()[0].webContents.capturePage(clip);const b=image.toBitmap(),a=global.__incoming;let changed=0;for(let i=0;i<b.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>60)changed++;return {diff:changed/(b.length/4),png:image.toPNG().toString('base64')};},result.clip);const diff=pixels.diff;fs.writeFileSync('artifacts/continuity-live.png',Buffer.from(pixels.png,'base64'));
    assert(diff<.003,`${language}/${effect}: terminal sheet differs from actual text by ${(diff*100).toFixed(2)}% pixels`);
    await page.evaluate(()=>{for(const a of document.querySelector('.page-turn-stage').getAnimations({subtree:true}))a.finish();});await settled();
    console.log(`PASS ${language}/${effect}: geometry ${result.max.toFixed(3)}px, handoff ${(diff*100).toFixed(3)}% pixels`);
    await page.locator('[data-action=prev]').click();await settled();
   }
   await page.locator('.sidebar [data-action=library]').click();
  }
  assert.deepEqual(errors,[]);console.log('PASS: font reflow retains text; bookmark pages follow layout; eight effects match real English/Japanese page pixels.');
 }finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
