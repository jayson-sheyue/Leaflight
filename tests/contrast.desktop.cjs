const {_electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../electron/store.cjs'),{JobQueue}=require('../electron/jobs.cjs');
const demo=require('../electron/demo.cjs'),appearance=require('../electron/appearance.json');

// Measure rendered foregrounds against ancestor surfaces and gradient stops.
// Alpha and inherited opacity count, so pale text on a light button cannot pass.
function auditText(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),cache=new Map();
 function rgba(value){if(cache.has(value))return cache.get(value);ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const p=[...ctx.getImageData(0,0,1,1).data];p[3]/=255;cache.set(value,p);return p;}
 const over=(a,b)=>[...a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])),1];
 const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 function layers(image){const out=[];let depth=0,start=0;for(let i=0;i<image.length;i++){if(image[i]==='(')depth++;if(image[i]===')')depth--;if(image[i]===','&&!depth){out.push(image.slice(start,i));start=i+1;}}out.push(image.slice(start));return out.reverse();}
 const backgroundCache=new Map();
 function backgrounds(el){
  if(!el)return [rgba(getComputedStyle(document.body).getPropertyValue('--bg'))];
  if(backgroundCache.has(el))return backgroundCache.get(el);
  const style=getComputedStyle(el);let colors=backgrounds(el.parentElement).map(b=>over(rgba(style.backgroundColor),b));
  if(style.backgroundImage!=='none')for(const layer of layers(style.backgroundImage)){
   const stops=(layer.match(/rgba?\([^)]*\)|color\([^)]*\)|#[\da-f]{3,8}\b/gi)||[]).map(rgba);
   if(stops.length)colors=colors.flatMap(b=>stops.map(s=>over(s,b)));
   colors=[...new Map(colors.map(c=>[c.map(Math.round).join(','),c])).values()].slice(0,48);
  }
  backgroundCache.set(el,colors);return colors;
 }
 const failures=[];let checked=0,minimum=Infinity;
 function check(el,text,pseudo){
  if(document.querySelector('.modal-overlay')&&!el.closest('.modal-overlay'))return;
  if(!text.trim()||!/[\p{L}\p{N}]/u.test(text)||el.closest('svg,option,script,style,[aria-hidden=true],[inert],:disabled'))return;
  if(!el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})||!el.getClientRects().length)return;
  const style=getComputedStyle(el,pseudo);let alpha=Number(style.opacity);
  if(!pseudo)alpha=1;
  for(let p=el;p;p=p.parentElement)alpha*=Number(getComputedStyle(p).opacity);
  const fg=[...rgba(style.color)];fg[3]*=alpha;
  const ratio=Math.min(...backgrounds(el).map(bg=>contrast(over(fg,bg),bg)));
  checked++;minimum=Math.min(minimum,ratio);
  if(ratio<4.5)failures.push({text:text.trim().slice(0,48),element:el.tagName.toLowerCase()+'.'+el.className,ratio:+ratio.toFixed(2)});
 }
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())check(walker.currentNode.parentElement,walker.currentNode.textContent);
 for(const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select')){
  if(el.value)check(el,el.tagName==='SELECT'?el.selectedOptions[0]?.textContent||'':el.value);
  else if(el.placeholder)check(el,el.placeholder,'::placeholder');
 }
 return {checked,minimum,failures};
}

(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-contrast-'));let app;const errors=[],failures=[];
 fs.mkdirSync('artifacts',{recursive:true});const store=new Store(path.join(dir,'library.sqlite'));
 for(let i=0;i<4;i++){let b=store.create({language:'en',level:'B1',genre:'fantasy',words:1000,totalChapters:3,preferences:''},{...demo.plan,title:'Readable story '+(i+1)});for(const c of demo.chapters)b=store.append(b.id,c);}
 const text='I watched the rain fall outside. I opened my notebook and described the garden.';
 const draft=store.writing.create({title:'A garden in the rain',language:'en',text,goal:'',topicId:'en-ielts-library'});
 store.writing.record('contrast-review',draft,{summary:'The sequence is clear.',strengths:['Concrete details.'],dimensions:['grammar','vocabulary','logic','fluency'].map(id=>({id,assessment:'This sentence can be more precise.',issues:id==='grammar'?[{original:'I watched the rain fall outside.',replacement:'I watched rain falling outside.',reason:'Describe an ongoing action.',kind:'error'}]:[]})),correctedText:text,practice:['Describe a sound.'],taskFeedback:{assessment:'Describe the data.',met:[],missing:['Add an overview.'],nextStep:'Compare the main changes.'}},'en','mock');
 const queue=new JobQueue(store,async()=>{throw Error('Offline test: connection unavailable.');});queue.enqueue('preview',{},{title:'Generation failed',model:'mock'});await new Promise(r=>setImmediate(r));queue.shutdown();store.close();
 try{
  const env={...process.env,NODE_ENV:'test',LEAFLIGHT_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({...(process.env.LEAFLIGHT_PACKAGED?{executablePath:process.env.LEAFLIGHT_PACKAGED,args:[]}:{args:[path.resolve('.')]}),env});
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.title-row').waitFor();await page.addStyleTag({content:'.toast{visibility:hidden!important}'});
  await app.evaluate(()=>{global.fetch=async()=>{throw Error('Contrast QA must stay offline');};});
  let count=0;
  async function audit(theme,screen){const result=await page.evaluate(auditText);assert(result.checked>10);count+=result.checked;for(const failure of result.failures)failures.push({theme,screen,...failure});}
  for(const theme of appearance.themes){
   await page.locator('[data-action=settings]').click();await page.check(`input[name=theme][value=${theme.id}]`);await audit(theme.id,'settings');await page.locator('[data-action=close]').click();
   await page.locator('.start-guide').evaluate(el=>el.open=true);await audit(theme.id,'library');
   await page.locator('.continue-card .text-button').hover();await audit(theme.id,'library-hover');
   if(['paper','rose','sepia'].includes(theme.id)){await page.locator('.start-guide').evaluate(el=>el.open=false);await page.screenshot({path:`artifacts/contrast-library-${theme.id}.png`});}
   await page.locator('.title-row [data-action=new]').click();await page.locator('#story-advanced').evaluate(el=>el.open=true);await audit(theme.id,'create');await page.locator('[data-action=close]').click();
   await page.locator('.book-title').first().click();await audit(theme.id,'reader');await page.locator('[data-action=appearance]').click();await audit(theme.id,'typography');await page.locator('[data-action=close]').click();
   await page.locator('[data-action=writing]').click();await audit(theme.id,'writing');await page.locator('[data-action=inbox]').first().click();await audit(theme.id,'inbox');
   if(theme.id==='ocean')await page.screenshot({path:'artifacts/contrast-writing-ocean.png'});
   await page.locator('[data-action=close-inbox]').click();await page.locator('.sidebar [data-action=library]').click();
  }
  fs.writeFileSync('artifacts/contrast-failures.json',JSON.stringify(failures,null,2));
  assert.deepEqual(errors,[]);assert.equal(failures.length,0,JSON.stringify([...new Map(failures.map(f=>[f.theme+'/'+f.element,f])).values()].slice(0,40),null,2));
  console.log(`PASS: ${count} rendered text/field checks across all 10 themes, library/hover/settings/create/reader/typography/writing/inbox; contrast ≥4.5:1 including opacity and gradient stops. No API calls.`);
 }finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
