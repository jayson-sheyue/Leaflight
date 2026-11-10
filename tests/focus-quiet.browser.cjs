const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve('dist'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}try{const type=file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream';res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  fs.mkdirSync('artifacts',{recursive:true});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('.book-title').first().click();
  await page.locator('#reader-scroll').waitFor();
  for(const view of [{name:'portrait',width:834,height:1194},{name:'landscape',width:1194,height:834},{name:'phone',width:390,height:844}]){
   await page.setViewportSize({width:view.width,height:view.height});
   if((await page.locator('body').getAttribute('data-focus'))!=='reader')await page.locator('[data-action=focus-panel][data-panel=reader]').click();
   await page.locator('#focus-chrome.shown').waitFor();
   const quiet=await page.locator('#focus-exit').evaluate(el=>{const s=getComputedStyle(el),bar=el.parentElement.getBoundingClientRect();return {radius:s.borderRadius,background:s.backgroundColor,shadow:s.boxShadow,text:el.textContent,right:bar.right,width:bar.width,pad:getComputedStyle(document.querySelector('.reading-layout')).paddingTop};});
   assert.equal(quiet.radius,'0px',view.name);
   assert.equal(quiet.background,'rgba(0, 0, 0, 0)',view.name);
   assert.equal(quiet.shadow,'none',view.name);
   assert.equal(quiet.text,'退出',view.name);
   assert.equal(quiet.pad,'0px',view.name);
   assert(quiet.right>view.width-24,JSON.stringify({view,quiet}));
   assert(quiet.width<180,JSON.stringify({view,quiet}));
   await page.screenshot({path:`artifacts/focus-quiet-${view.name}-shown.png`});
   await page.waitForFunction(()=>!document.querySelector('#focus-chrome')?.classList.contains('shown'),null,{timeout:4500});
   assert.equal(await page.locator('#focus-exit').isVisible(),false,view.name);
   await page.screenshot({path:`artifacts/focus-quiet-${view.name}.png`});
   await page.locator('#reader-scroll').click({position:{x:24,y:180}});
   await page.locator('#focus-chrome.shown').waitFor();
   await page.locator('#focus-exit').click();
   await page.locator('.sidebar').waitFor();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: web preview full window has no standing pills in iPad portrait, landscape, or phone width. Tap shows plain Inbox and Exit text, then it hides.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
