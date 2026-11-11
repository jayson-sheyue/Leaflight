const {_electron}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path'),os=require('node:os');const {Store}=require('../electron/store.cjs');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-swipe-'));let app;const errors=[];
const s=new Store(path.join(dir,'library.sqlite'));const preset={language:'en',level:'A2',genre:'adventure',words:800,totalChapters:2,preferences:'A walk through the library.'};let book=s.create(preset,{title:'The Long Gallery',synopsis:'A reader crosses a long gallery.',bible:'The gallery is quiet.',outline:['Door','Window'],sample:'The gallery is long.',sampleReadings:[]});book=s.append(book.id,{title:'1 · Door',text:Array(48).fill('The gallery is long and quiet. A reader walks from one window to the next.').join('\n\n'),summary:'The reader walks on.',memory:'The gallery is quiet.',readings:[]});s.close();
try{
 const env={...process.env,NODE_ENV:'test',LEAFLIGHT_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
 app=await _electron.launch({args:[path.resolve('.')],env});
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){const staged=this.classList?.contains('page-turn-stage')||this.closest?.('.page-turn-stage');if(staged){const base=typeof options==='number'?{duration:options}:{...options};options={...base,duration:Math.max(900,base.duration||0)};}return animate.call(this,frames,options);};});
 await page.locator('.book-title').click();
 await page.locator('#reader-scroll').waitFor();
 await page.locator('[data-action=appearance]').click();
 assert.match(await page.locator('#reader-form').innerText(),/双指横滑/);
 await page.selectOption('[name=mode]','pages');
 await page.selectOption('[name=effect]','slide');
 await page.locator('button.close[data-action=close]').click();
 await page.locator('.reader-pane[data-mode=pages]').waitFor();
 async function place(){return page.evaluate(()=>{const el=document.querySelector('#reader-scroll');return {left:el.scrollLeft,width:el.clientWidth,chapter:document.querySelector('.toc-item.selected')?.dataset.chapter||'0',turning:document.body.dataset.turning==='true'};});}
 function turns(before,after){const pageOf=p=>Math.round(p.left/Math.max(1,p.width));const chapters=Number(after.chapter)-Number(before.chapter);if(!chapters)return pageOf(after)-pageOf(before);if(chapters===1&&pageOf(after)===0)return 1;return chapters+pageOf(after);}
 async function settled(){await page.waitForFunction(()=>document.body.dataset.turning!=='true'&&!document.querySelector('.page-turn-stage'));}
 async function drag(dx,dy){const box=await page.locator('#reader-scroll').boundingBox();const x=box.x+box.width*0.72,y=box.y+box.height*0.46;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});const during=await place();await page.mouse.up();return during;}
 const before=await place();
 let during=await drag(-36,0);
 await settled();
 assert.equal(during.left,before.left,'a short drag must not scrub the page');
 assert.equal(turns(before,await place()),0,'a short drag must not turn the page');
 during=await drag(0,160);
 await settled();
 assert.equal(during.left,before.left,'a vertical drag must not scrub the page');
 assert.equal(turns(before,await place()),0,'a vertical drag must not turn the page');
 await page.evaluate(()=>getSelection()?.removeAllRanges());
 const effect=page.waitForFunction(()=>document.querySelector('.page-turn-stage')?.getAttribute('data-effect')==='slide');
 during=await drag(-420,0);
 assert.equal(during.left,before.left,'the drag must not scroll the columns before the page turn');
 await effect;
 await settled();
 const once=await place();
 assert.equal(turns(before,once),1,'one mouse drag turns one page');
 const beforeWheel=await place();
 const wheelBox=await page.locator('#reader-scroll').boundingBox();
 await page.mouse.move(wheelBox.x+wheelBox.width*0.5,wheelBox.y+wheelBox.height*0.5);
 await page.mouse.wheel(40,0);
 await page.mouse.wheel(180,0);
 await page.mouse.wheel(180,0);
 await page.waitForFunction(()=>document.querySelector('.page-turn-stage')?.getAttribute('data-effect')==='slide');
 await settled();
 assert.equal(turns(beforeWheel,await place()),1,'one trackpad swipe turns one page');
 const beforeButton=await place();
 const buttonEffect=page.waitForFunction(()=>document.querySelector('.page-turn-stage')?.getAttribute('data-effect')==='slide');
 await page.locator('[data-action=next]').click();
 await buttonEffect;
 await settled();
 assert.equal(turns(beforeButton,await place()),1,'the next button still turns one page after a drag');
 await page.locator('[data-action=prev]').click();
 await settled();
 const beforeDouble=await place();
 const firstEffect=page.waitForFunction(()=>document.body.dataset.turning==='true');
 await drag(-420,0);
 await firstEffect;
 await drag(-420,0);
 await settled();
 assert.equal(turns(beforeDouble,await place()),1,'a second drag during the effect does not skip a page');
 assert.deepEqual(errors,[]);
 console.log('PASS: Mac/Windows reader turns one page when the text is dragged, without scrubbing the columns.');
}finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
