const {openResult}=require('./job-ui.cjs');
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
(async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-ui-'));const output=path.resolve('artifacts');fs.mkdirSync(output,{recursive:true});let app;
const errors=[];
async function launch(){const env={...process.env,NODE_ENV:'test',LEAFLIGHT_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;const a=await electron.launch({args:[path.resolve('.')],env});const page=await a.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('.title-row').waitFor();return {a,page};}
try{
let instance=await launch();app=instance.a;let page=instance.page;
await page.screenshot({path:path.join(output,'library-empty.png')});
await page.getByRole('button',{name:'打开三章示例'}).click();await page.locator('#prose h1').waitFor();
assert((await page.locator('#prose').textContent()).includes('A Light Across the Water'));
await page.locator('[data-action=chapter][data-chapter="1"]').click();
await page.getByRole('button',{name:'Aa 排版'}).click();
await page.selectOption('select[name=mode]','pages');

await page.locator('input[name=size]').fill('22');await page.locator('input[name=size]').dispatchEvent('input');
await page.getByRole('button',{name:'关闭',exact:true}).click();await page.locator('[data-action=settings]').click();await page.check('input[name=theme][value=sage]');await page.locator('[data-action=close]').click();
await page.waitForTimeout(250);
const dimensions=await page.locator('#reader-scroll').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight}));
assert(dimensions.scroll>dimensions.width,JSON.stringify(dimensions));
assert(dimensions.scrollHeight<=dimensions.height+2,JSON.stringify(dimensions));
await page.getByRole('button',{name:'下一页',exact:true}).click();
await page.waitForTimeout(350);
const position=await page.locator('#reader-scroll').evaluate(el=>({x:el.scrollLeft,w:el.clientWidth}));assert(position.x>0,JSON.stringify(position));
await page.getByRole('button',{name:'添加书签',exact:true}).click();await page.locator('.bookmark-item').waitFor();assert.equal(await page.locator('[data-action=bookmark]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-action=bookmark]').getAttribute('aria-label'),'取消书签');await page.getByRole('button',{name:'取消书签',exact:true}).click();await page.locator('.bookmark-item').waitFor({state:'detached'});assert.equal(await page.locator('[data-action=bookmark]').getAttribute('aria-pressed'),'false');await page.getByRole('button',{name:'添加书签',exact:true}).click();await page.locator('.bookmark-item').waitFor();
await page.screenshot({path:path.join(output,'reader.png')});
const before=await page.evaluate(()=>window.leaflight.call('library'));const demo=before.value[0];assert(demo.progress.fraction>0);assert.equal(demo.progress.chapter,1);
await app.close();instance=await launch();app=instance.a;page=instance.page;
await page.locator('.book-title').first().click();await page.waitForTimeout(300);
assert.equal(await page.locator('body').getAttribute('data-theme'),'sage');assert((await page.locator('#prose h1').textContent()).includes('Keeper'));
const after=await page.locator('#reader-scroll').evaluate(el=>el.scrollLeft);assert(after>0,'Paged position did not restore');assert.equal(await page.locator('.bookmark-item').count(),1);
await page.getByRole('button',{name:'返回书架'}).click();assert.notEqual(await page.locator('.book-actions .delete-book').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');assert.notEqual(await page.locator('.book-actions .small-link').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');await page.screenshot({path:path.join(output,'library.png')});
// No live API requests: verify actual main-process generation path with a deterministic transport.
await app.evaluate(()=>{global.fetch=async(_url,opts)=>{const request=JSON.parse(opts.body);const isPlan=request.contents[0].parts[0].text.includes('Plan a complete story');const schema=request.generationConfig.responseSchema;let value;if(isPlan)value={title:'Test of the Quiet Sea',synopsis:'An original test story.',bible:'Mara is a mapmaker. Third person.',outline:['Begin','Investigate','Resolve'],sample:'The sea was quiet that morning. Mara opened her shop and waited for a visitor.'};else value={title:'The New Map',text:('Mara opened the door and saw a new map on the table. She followed the line towards the harbour.\n\n').repeat(15),summary:'Mara finds a new map.',memory:'Mara has found a map and will visit the harbour.'};if(!schema)throw Error('Missing response schema');return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}],usageMetadata:{totalTokenCount:100}})};};});
await page.getByRole('button',{name:'系统设置'}).click();await page.locator('input[name=apiKey]').fill('test-key-local-only');await page.getByRole('button',{name:'保存设置',exact:true}).click();await page.getByRole('button',{name:'关闭',exact:true}).click();
await page.locator('.title-row [data-action=new]').click();await page.locator('#story-advanced').evaluate(el=>el.open=true);await page.locator('input[name=totalChapters]').fill('3');
await page.getByRole('button',{name:'生成故事试读'}).click();await openResult(page,'preview');await page.locator('.plan-title').waitFor();assert.equal(await page.locator('.plan-title').textContent(),'Test of the Quiet Sea');
await page.screenshot({path:path.join(output,'preview.png')});await page.getByRole('button',{name:'创建并加入书架'}).click();
for(let i=0;i<3;i++){await page.getByRole('button',{name:'生成下一章'}).click();await openResult(page,'chapter');await page.getByRole('button',{name:'取消本次生成'}).waitFor({state:'detached'});await page.locator('.toc-item').nth(i).waitFor();}
assert.equal(await page.locator('.toc-item').count(),3);assert.equal(await page.locator('[data-action=generate]').count(),0);
const library=await page.evaluate(()=>window.leaflight.call('library'));assert.equal(library.value.length,2);assert.equal(library.value.find(b=>!b.demo).chapters.length,3);
// v0.2: independently switch interface and story language, then exercise every appearance option.
for(const [locale,lang,label] of [['en','en','Save settings'],['ja','ja','設定を保存']]){
 await page.locator('[data-action=settings]').click();await page.selectOption('select[name=uiLanguage]',locale);await page.locator('[data-action=save-settings]').click();await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);assert.equal(await page.locator('[data-action=save-settings]').textContent(),label);await page.locator('[data-action=close]').click();
}
await page.locator('[data-action=library]').first().click();
await page.locator('.title-row [data-action=new]').click();await page.selectOption('select[name=language]','ja');assert.equal(await page.locator('select[name=level] option').allTextContents().then(x=>x.join(',')),'N5,N4,N3,N2,N1');await page.selectOption('select[name=level]','N4');await page.locator('#story-advanced').evaluate(el=>el.open=true);await page.selectOption('select[name=words]','800');await page.locator('#story-advanced').evaluate(el=>el.open=true);await page.locator('input[name=totalChapters]').fill('3');
await page.locator('#preset-name').fill('日本語 N4 テスト');await page.locator('[data-action=save-preset]').click();
await app.evaluate(()=>{global.__leaflightRequests=[];global.fetch=async(_url,opts)=>{const prompt=JSON.parse(opts.body).contents[0].parts[0].text;global.__leaflightRequests.push(prompt);const isPlan=prompt.includes('Plan a complete story');const value=isPlan?{title:'海辺の小さな図書館',synopsis:'海の近くの図書館で働く美咲が、不思議な手紙の送り主を探す物語。',bible:'美咲は大人の図書館員。海辺の町。過去形、三人称。',outline:['手紙を見つける','町の人に聞く','送り主に会う'],sample:'海辺の町に、小さな図書館がありました。美咲は毎朝、窓を開けて海を見ました。ある日、古い本の中から一通の手紙が出てきました。'}:{title:'第一章・海からの手紙',text:('美咲は図書館の窓を開けました。海からの風が、本のページを静かに動かしました。机の上には、小さな白い手紙がありました。誰がこの手紙を置いたのでしょう。美咲はそっと封を開けました。\n\n').repeat(16),summary:'美咲が図書館で不思議な手紙を見つけた。',memory:'美咲は図書館員。海辺の図書館で手紙を見つけた。送り主はまだ分からない。'};return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}],usageMetadata:{totalTokenCount:200}})};};});
await page.locator('[data-action=preview]').click();await openResult(page,'preview');await page.locator('.plan-title').waitFor();assert.equal(await page.locator('.plan-title').textContent(),'海辺の小さな図書館');await page.screenshot({path:path.join(output,'japanese-preview.png')});
await page.locator('[data-action=create]').click();await page.locator('[data-action=generate]').click();await openResult(page,'chapter');await page.locator('.toc-item').first().waitFor();assert.equal(await page.locator('#prose').getAttribute('lang'),'ja');assert((await page.locator('.chapter-kicker').textContent()).includes('字'));
await page.locator('[data-action=settings]').click();assert.equal(await page.locator('.theme-swatch').count(),10);
const appearance=require('../electron/appearance.json');
for(const theme of appearance.themes){await page.check(`input[name=theme][value="${theme.id}"]`);assert.equal(await page.locator('body').getAttribute('data-theme'),theme.id);assert.equal(await page.locator('body').evaluate(el=>el.style.getPropertyValue('--bg')),theme.bg);}
await page.check('input[name=theme][value=lavender]');await page.locator('[data-action=close]').click();await page.locator('[data-action=appearance]').click();assert.equal(await page.locator('.theme-swatch').count(),0);assert.equal(await page.locator('select[name=font] option').count(),12);
for(const font of appearance.fonts){await page.selectOption('select[name=font]',font.id);assert.equal(await page.locator('.reader-pane').evaluate(el=>el.style.getPropertyValue('--reading-font')),font.family);}
await page.selectOption('select[name=font]','hiragino-mincho');await page.selectOption('select[name=mode]','pages');await page.screenshot({path:path.join(output,'appearance-japanese.png')});await page.locator('[data-action=close]').click();await page.waitForTimeout(250);
await page.locator('[data-action=next]').click();await page.waitForTimeout(250);assert(await page.locator('#reader-scroll').evaluate(el=>el.scrollLeft>0));await page.locator('[data-action=bookmark]').click();await page.waitForTimeout(200);await page.screenshot({path:path.join(output,'japanese-reader.png')});
const requests=await app.evaluate(()=>global.__leaflightRequests);assert.equal(requests.length,2);assert(requests.every(x=>x.includes('Target JLPT N4')&&x.includes('800 Japanese characters')&&x.includes('in Japanese')));
const nativeMenu=await app.evaluate(({Menu})=>Menu.getApplicationMenu().items[1].label);assert.equal(nativeMenu,'編集');
const jaBefore=(await page.evaluate(()=>window.leaflight.call('library'))).value.find(b=>b.preset.language==='ja');assert(jaBefore.progress.fraction>0);assert.equal(jaBefore.bookmarks.length,1);
await app.close();instance=await launch();app=instance.a;page=instance.page;assert.equal(await page.locator('html').getAttribute('lang'),'ja');assert.equal(await page.locator('body').getAttribute('data-theme'),'lavender');await page.locator('[data-action=open]').filter({hasText:'海辺の小さな図書館'}).first().click();await page.waitForTimeout(250);assert.equal(await page.locator('#prose').getAttribute('lang'),'ja');assert(await page.locator('#reader-scroll').evaluate(el=>el.scrollLeft>0));
// Verify the real export IPC writes a Japanese EPUB with a Unicode default filename.
await app.evaluate(({dialog},dir)=>{dialog.showSaveDialog=async(_win,options)=>{global.__leaflightExportName=options.defaultPath;return {canceled:false,filePath:dir+'/japanese.epub'};};},dir);
await page.locator('[data-action=export]').click();await page.locator('[data-action=export-epub]').click();await page.waitForFunction(()=>document.querySelector('.toast')?.textContent==='物語を書き出しました');
const {unzipSync,strFromU8}=require('fflate');const exported=unzipSync(fs.readFileSync(path.join(dir,'japanese.epub')));assert(strFromU8(exported['OEBPS/content.opf']).includes('<dc:language>ja</dc:language>'));assert.equal(await app.evaluate(()=>global.__leaflightExportName),'海辺の小さな図書館.epub');
const jaSettings=(await page.evaluate(()=>window.leaflight.call('settings'))).value;assert.equal(jaSettings.reader.font,'hiragino-mincho');assert(jaSettings.presets.some(x=>x.name==='日本語 N4 テスト'&&x.preset.language==='ja'));
assert.deepEqual(errors,[]);console.log('PASS: actual Electron UI — offline sample, paging, bookmark, restart persistence, mocked English and Japanese generation, 3 UI languages, all 10 themes / 12 fonts, native menus and restart persistence, no renderer errors.');
}finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
