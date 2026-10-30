const {app,BrowserWindow,ipcMain,safeStorage,dialog,Menu,shell}=require('electron');
const path=require('node:path');const fs=require('node:fs');const {Store,validatePreset,validateReader}=require('./store.cjs');
const {generate,planSchema,chapterSchema,planPrompt,chapterPrompt,comparisonSchema,comparisonPrompt}=require('./gemini.cjs');const {epub}=require('./export.cjs');
const {analyze,adjustment,normalizeReadings,normalizeComparison}=require('./difficulty.cjs');
const {validateSnapshot,reviewSchema,reviewPrompt}=require('./writing.cjs');
const {catalog:scienceCatalog}=require('./science.cjs');
const {JobQueue}=require('./jobs.cjs');
let store,win,jobs,quitting=false;
if(process.env.NODE_ENV==='test'&&process.env.LEAFLIGHT_TEST_DATA)app.setPath('userData',process.env.LEAFLIGHT_TEST_DATA);
const dev=process.env.LEAFLIGHT_DEV_URL==='http://127.0.0.1:5173';
function credentials(){const s=store.setting('api',{model:'gemini-2.5-flash'});let apiKey='';if(s.encryptedKey&&safeStorage.isEncryptionAvailable()){try{apiKey=safeStorage.decryptString(Buffer.from(s.encryptedKey,'base64'));}catch{throw Error('无法解密已保存的 API Key，请重新填写。');}}return {...s,apiKey};}
async function runGeneration(prompt,schema,job,signal){const {apiKey}=credentials();const result=await generate({apiKey,model:job.model,prompt,schema,signal,temperature:job.type==='review'?0.2:0.9});if(signal.aborted)throw Error('生成已取消。');store.set('lastUsage',result.usage);return result.value;}
function submit(type,payload){const {apiKey,model}=credentials();if(!apiKey)throw Error('请先在设置中填写 Gemini API Key。');if(type==='review'){store.writing.get(payload.snapshot.id);validateSnapshot(payload.snapshot);if(!['zh','en','ja'].includes(payload.feedbackLanguage))throw Error('写作数据无效。');return jobs.enqueue(type,payload,{model,draftId:payload.snapshot.id,title:payload.snapshot.title||'未命名草稿'});}if(type==='preview')payload=validatePreset(payload);if(type==='chapter'){const b=store.get(payload.id);if(b.chapters.length>=b.preset.totalChapters)throw Error('故事已完结。');return jobs.enqueue(type,payload,{model,bookId:b.id,title:b.title});}if(type==='compare')validateComparison(payload);return jobs.enqueue(type,payload,{model,bookId:null,title:type==='preview'?payload.level+' · '+payload.genre:payload.levels.join(' / ')});}
function validateComparison(p){validatePreset(p.preset);if(typeof p.scene!=='string'||p.scene.trim().length<10||p.scene.length>1500||!Array.isArray(p.levels)||p.levels.length!==2||p.levels[0]===p.levels[1])throw Error('难度对照参数无效。');for(const level of p.levels)validatePreset({...p.preset,level});}
async function executeJob(job,signal,stage){const p=job.payload;
 if(job.type==='review'){const value=await runGeneration(reviewPrompt(p.snapshot,p.feedbackLanguage),reviewSchema,job,signal);stage('正在检查并保存写作评审');if(signal.aborted)throw Error('生成已取消。');const review=store.writing.record(job.id,p.snapshot,value,p.feedbackLanguage,job.model);return {draftId:review.draftId,reviewId:review.id};}
 if(job.type==='preview'){const plan=await runGeneration(planPrompt(p),planSchema,job,signal);stage('正在检查试读与难度');if(typeof plan.title!=='string'||typeof plan.synopsis!=='string'||typeof plan.bible!=='string'||typeof plan.sample!=='string'||!Array.isArray(plan.outline)||plan.outline.length!==p.totalChapters||!plan.outline.every(x=>typeof x==='string'))throw Error('规划返回不完整，请重试。');if(plan.preferenceNotes!==undefined&&(!Array.isArray(plan.preferenceNotes)||plan.preferenceNotes.length>12||!plan.preferenceNotes.every(x=>typeof x==='string'&&x.length<=1600)))throw Error('规划返回不完整，请重试。');plan.sampleReadings=normalizeReadings(plan.sampleReadings);plan.sampleDifficulty=analyze(plan.sample,p,0,plan.sampleReadings);if(signal.aborted)throw Error('生成已取消。');return {preset:p,plan};}
 if(job.type==='chapter'){const b=store.get(p.id);if(b.chapters.length>=b.preset.totalChapters)throw Error('故事已完结。');const result=await runGeneration(chapterPrompt(b),chapterSchema,job,signal);stage('正在检查并归档章节');if(signal.aborted)throw Error('生成已取消。');const saved=store.append(b.id,result,job.id);return {bookId:saved.id,chapterId:saved.chapters.at(-1).id};}
 if(job.type==='compare'){const result=await runGeneration(comparisonPrompt(p.preset,p.scene,p.levels),comparisonSchema,job,signal);stage('正在检查难度对照');if(!Array.isArray(result.variants)||result.variants.length!==2||!result.variants.every((x,i)=>x.level===p.levels[i]&&typeof x.text==='string'&&x.text.trim().length>50&&x.text.length<15000))throw Error('规划返回不完整，请重试。');const comparison=normalizeComparison({language:p.preset.language||'en',scene:p.scene,createdAt:new Date().toISOString(),variants:result.variants});if(signal.aborted)throw Error('生成已取消。');store.set('lastComparison',comparison);return {comparison,preset:p.preset};}
 throw Error('不支持此操作。');
}
function settings(){const s=store.setting('api',{model:'gemini-2.5-flash'});return {uiLanguage:store.setting('uiLanguage','zh'),model:s.model,hasKey:!!s.encryptedKey,encryptionAvailable:safeStorage.isEncryptionAvailable(),reader:store.setting('reader',{}),presets:store.setting('presets',[]),lastUsage:store.setting('lastUsage',null)};}
function demo(){const old=store.list().find(b=>b.demo);if(old)return old;const p={level:'B1',genre:'fantasy',words:500,totalChapters:3,preferences:'A gentle mystery in a coastal town.'};const d=require('./demo.cjs');let b=store.create(p,d.plan);for(const c of d.chapters)b=store.append(b.id,c);b.demo=true;return store.put(b);}
async function handle(command,p={}){switch(command){
 case 'science-source':{const source=scienceCatalog.sources.find(s=>s.id===p.id);if(!source)throw Error('找不到这份科学课程依据。');await shell.openExternal(source.url);return true;}
 case 'writing-list':return store.writing.list();
 case 'writing-trash':return store.writing.trash();
 case 'writing-recover':return store.writing.recover(p.id);
 case 'writing-delete':{if(jobs.hasDraftWork(p.id))throw Error('这篇草稿正在评审，请先在消息盒子取消相关任务。');const d=store.writing.get(p.id,true);const result=await dialog.showMessageBox(win,{type:'warning',title:uiText('永久删除这篇草稿？'),message:uiText('永久删除这篇草稿？'),detail:(d.title||uiText('未命名草稿'))+'\n\n'+uiText('将永久删除正文、题目、评审历史及相关任务记录，无法在应用内恢复。需要保留的稿件请使用归档。'),buttons:[uiText('取消'),uiText('永久删除')],defaultId:0,cancelId:0,noLink:true});if(result.response!==1)return false;if(jobs.hasDraftWork(p.id))throw Error('这篇草稿正在评审，请先在消息盒子取消相关任务。');store.writing.remove(p.id);jobs.publish();return true;}

 case 'writing-new':return store.writing.create(p);
 case 'writing-save':return store.writing.save(p);
 case 'writing-archive':return store.writing.archive(p.id,!!p.archived);
 case 'writing-reviews':return store.writing.reviews(p.id);
 case 'writing-review':return store.writing.review(p.id);
 case 'review-writing':{const snapshot=store.writing.get(p.id);if(p.version!==snapshot.version)throw Error('草稿已在别处更新，请重新打开后再编辑。');return submit('review',{snapshot,feedbackLanguage:store.setting('uiLanguage','zh')});}
 case 'writing-export':{const d=store.writing.get(p.id);const result=await dialog.showSaveDialog(win,{title:dialogText('export'),buttonLabel:dialogText('save'),defaultPath:(d.title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'').slice(0,80)||'writing')+'.txt',filters:[{name:'Text',extensions:['txt']}]});if(result.canceled)return false;fs.writeFileSync(result.filePath,d.text);return true;}
 case 'trash':return store.listTrash();
 case 'delete-book':if(jobs.hasBookWork(p.id))throw Error('这部作品正在生成，请先在消息盒子取消相关任务。');return store.remove(p.id);
 case 'recover-book':return store.recover(p.id);
 case 'library':return store.list();
 case 'import-story':{const book=store.importStory(p);return book;}
 case 'settings':return settings();
 case 'save-settings':{if(p.uiLanguage!==undefined&&!['zh','en','ja'].includes(p.uiLanguage))throw Error('界面语言无效。');if(typeof p.model!=='string'||!/^[a-zA-Z0-9._-]{1,100}$/.test(p.model))throw Error('请填写有效的模型 ID。');const old=store.setting('api',{});let encryptedKey=p.clearKey?null:old.encryptedKey;if(!p.clearKey&&typeof p.apiKey==='string'&&p.apiKey.trim()&&!/^[•●*]{4,}$/u.test(p.apiKey.trim())){if(!safeStorage.isEncryptionAvailable())throw Error('系统安全存储不可用，无法保存 API Key。');encryptedKey=safeStorage.encryptString(p.apiKey.trim()).toString('base64');}store.set('api',{model:p.model,encryptedKey});if(p.uiLanguage){store.set('uiLanguage',p.uiLanguage);buildMenu();}return settings();}
 case 'save-reader':validateReader(p);store.set('reader',p);return p;
 case 'save-presets':if(!Array.isArray(p)||p.length>100)throw Error('预设数量无效。');for(const x of p){if(typeof x.name!=='string'||x.name.length>80)throw Error('预设名称无效。');validatePreset(x.preset);}p=p.map(x=>({...x,preset:validatePreset(x.preset)}));store.set('presets',p);return p;
 case 'preview':return submit('preview',p);
 case 'generate':return submit('chapter',p);
 case 'compare':return submit('compare',p);
 case 'create':{const job=jobs.get(p.jobId);if(job.type!=='preview'||job.status!=='completed')throw Error('请先生成试读。');if(job.resultBookId)return store.get(job.resultBookId);store.db.exec('BEGIN IMMEDIATE');try{const b=store.create(job.result.preset,job.result.plan);jobs.update(job.id,{resultBookId:b.id,readRevision:job.revision+1});store.db.exec('COMMIT');return b;}catch(error){store.db.exec('ROLLBACK');throw error;}}
 case 'jobs':return jobs.list();
 case 'job':return jobs.get(p.id);
 case 'jobs-read':return jobs.read(p.items||[]);
 case 'cancel':return jobs.cancel(p.id);
 case 'retry-job':{const job=jobs.get(p.id);if(!['failed','cancelled','interrupted'].includes(job.status))throw Error('此任务暂不能重试。');return submit(job.type,job.payload);}
 case 'difficulty':{const b=store.get(p.id);if(p.chapterId==='sample')return {report:analyze(b.sample,b.preset,0,b.sampleReadings),feedback:null,adjustment:adjustment(b)};const c=b.chapters.find(c=>c.id===p.chapterId);if(!c)throw Error('找不到这部作品。');return {report:analyze(c.text,b.preset,c.calibrationUsed||0,c.readings),feedback:(b.feedback||[]).find(x=>x.chapterId===c.id)?.rating||null,adjustment:adjustment(b)};}
 case 'feedback':return store.feedback(p.id,p.chapterId,p.rating);
 case 'comparison':return normalizeComparison(store.setting('lastComparison',null));
 case 'progress':return store.progress(p.id,p.progress);
 case 'bookmark':return store.bookmark(p.id,p.progress);
 case 'remove-bookmarks':return store.removeBookmarks(p.id,p.ids);
 case 'reanchor':return store.reanchor(p.id,p.marks);
 case 'export':{const b=store.get(p.id);if(!['txt','epub'].includes(p.format))throw Error('无效的导出格式。');const result=await dialog.showSaveDialog(win,{title:dialogText('export'),buttonLabel:dialogText('save'),defaultPath:`${b.title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'').slice(0,80)||'story'}.${p.format}`,filters:[{name:p.format.toUpperCase(),extensions:[p.format]}]});if(result.canceled)return false;const bytes=p.format==='epub'?epub(b):`${b.title}\n${b.source==='import'?'Imported to Leaflight':'AI generated with Leaflight'}\n\n${b.synopsis}\n\n${b.chapters.map(c=>`${c.title}\n\n${c.text}`).join('\n\n\n')}`;fs.writeFileSync(result.filePath,bytes);return true;}
 case 'backup':{const r=await dialog.showSaveDialog(win,{title:dialogText('backup'),buttonLabel:dialogText('save'),defaultPath:'Leaflight-backup.json',filters:[{name:'Leaflight backup',extensions:['json']}]});if(r.canceled)return false;fs.writeFileSync(r.filePath,JSON.stringify(store.backup(),null,2));return true;}
 case 'restore':{const r=await dialog.showOpenDialog(win,{title:dialogText('restore'),buttonLabel:dialogText('open'),properties:['openFile'],filters:[{name:'Leaflight backup',extensions:['json']}]});if(r.canceled)return false;if(fs.statSync(r.filePaths[0]).size>50*1024*1024)throw Error('备份文件超过 50 MB。');const result=store.restore(JSON.parse(fs.readFileSync(r.filePaths[0],'utf8')));buildMenu();return result;}
 case 'demo':return demo();
 default:throw Error('不支持此操作。');
}}
app.whenReady().then(()=>{store=new Store(path.join(app.getPath('userData'),'library.sqlite'));if(!store.setting('presets',null))store.set('presets',[{name:'睡前轻奇幻 · B1',preset:{level:'B1',genre:'fantasy',words:1000,totalChapters:20,preferences:'A warm adventure for adult readers. Natural clear English, few rare words, gentle suspense.'}},{name:'轻松日常 · A2',preset:{level:'A2',genre:'slice of life',words:500,totalChapters:5,preferences:'An engaging everyday story for adults. Short sentences and practical vocabulary.'}},{name:'周末悬疑 · B2',preset:{level:'B2',genre:'mystery',words:2000,totalChapters:10,preferences:'A fair-play mystery with an adult protagonist and a satisfying resolution.'}}]);if(!store.setting('language-update-v2',false)){const presets=store.setting('presets',[]);store.set('presets',[...presets,{name:'海边日常 · 日文 N4',preset:{language:'ja',level:'N4',genre:'slice of life',words:800,totalChapters:5,preferences:'海辺の町を舞台にした、大人が楽しめる温かい物語。自然で読みやすい日本語。'}},{name:'不思议之旅 · 日文 N2',preset:{language:'ja',level:'N2',genre:'fantasy',words:3000,totalChapters:10,preferences:'大人の主人公が旅する幻想的な物語。人物の成長と一貫した世界観を大切に。'}}]);store.set('language-update-v2',true);}jobs=new JobQueue(store,executeJob,list=>{if(win&&!win.isDestroyed())win.webContents.send('jobs-updated',list);});buildMenu();ipcMain.handle('leaflight',async(event,command,p)=>{if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted sender');try{return {ok:true,value:await handle(command,p)};}catch(e){return {ok:false,error:e.message||'操作失败，请重试。'};}});ipcMain.on('close-ready',event=>{if(event.sender===win?.webContents){win.destroy();if(quitting||process.platform!=='darwin')app.quit();}});createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
function createWindow(){win=new BrowserWindow({width:1360,height:900,minWidth:960,minHeight:680,title:'Leaflight',backgroundColor:'#f6f5f0',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});let closing=false;win.on('close',event=>{if(closing)return;event.preventDefault();closing=true;win.webContents.send('prepare-close');const closingWindow=win;setTimeout(()=>{if(!closingWindow.isDestroyed())closingWindow.destroy();if(quitting)app.quit();},2500).unref();});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(url!==(dev?'http://127.0.0.1:5173/':`file://${path.join(__dirname,'../dist/index.html')}`))event.preventDefault();});if(dev)win.loadURL('http://127.0.0.1:5173');else win.loadFile(path.join(__dirname,'../dist/index.html'));}
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{quitting=true;jobs?.shutdown();});

function buildMenu(){
 const locale=store.setting('uiLanguage','zh');
 const labels={zh:['关于 Leaflight','隐藏 Leaflight','隐藏其他','显示全部','退出 Leaflight','编辑','撤销','重做','剪切','复制','粘贴','全选','显示','实际大小','放大','缩小','切换全屏','窗口','最小化','关闭窗口'],en:['About Leaflight','Hide Leaflight','Hide Others','Show All','Quit Leaflight','Edit','Undo','Redo','Cut','Copy','Paste','Select All','View','Actual Size','Zoom In','Zoom Out','Toggle Full Screen','Window','Minimize','Close Window'],ja:['Leaflight について','Leaflight を隠す','ほかを隠す','すべてを表示','Leaflight を終了','編集','取り消す','やり直す','切り取り','コピー','ペースト','すべてを選択','表示','実際のサイズ','拡大','縮小','フルスクリーン切り替え','ウインドウ','最小化','ウインドウを閉じる']}[locale];
 const item=(role,index)=>({role,label:labels[index]});
 Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Leaflight',submenu:[item('about',0),{type:'separator'},item('hide',1),item('hideOthers',2),item('unhide',3),{type:'separator'},item('quit',4)]},{label:labels[5],submenu:[item('undo',6),item('redo',7),{type:'separator'},item('cut',8),item('copy',9),item('paste',10),item('selectAll',11)]},{label:labels[12],submenu:[item('resetZoom',13),item('zoomIn',14),item('zoomOut',15),item('togglefullscreen',16)]},{label:labels[17],submenu:[item('minimize',18),item('close',19)]}]));
}

function uiText(key){const locale=store.setting('uiLanguage','zh');return locale==='zh'?key:require('./messages.json')[key]?.[locale]||key;}
function dialogText(key){const locale=store.setting('uiLanguage','zh');return {zh:{export:'导出作品',backup:'导出备份',restore:'导入备份',save:'保存',open:'打开'},en:{export:'Export story',backup:'Export backup',restore:'Import backup',save:'Save',open:'Open'},ja:{export:'作品を書き出す',backup:'バックアップを書き出す',restore:'バックアップを読み込む',save:'保存',open:'開く'}}[locale][key];}
