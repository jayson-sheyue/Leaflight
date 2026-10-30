export type Position={chapter:number;fraction:number;paragraph?:number;index?:number};
export type Bookmark=Position&{id:string};
export type Chapter={id:string;title:string;text:string;summary?:string;generationId?:string;readings?:{surface:string;reading:string}[]};
export type Series={version:1;genre:string;idea:string;length:string;totalChapters:number;words?:number;bible:string;outline:string[];sample:string;sampleReadings?:{surface:string;reading:string}[];memory:string;context?:string};
export type Book={id:string;title:string;synopsis:string;preset:{language:'en'|'ja';level:string;genre?:string;words?:number;totalChapters?:number;preferences?:string};chapters:Chapter[];series?:Series;progress:Position;bookmarks:Bookmark[];updatedAt:string;source?:string;poolId?:string;sharedBy?:string;[key:string]:unknown};
export type PoolStory={poolId:string;sharedBy:string;sharedAt:string;note:string;sourceUrl?:string;preset:{language:'en'|'ja';level:string;genre:string;words:number;totalChapters:number;preferences:string};title:string;synopsis:string;bible:string;outline:string[];sample:string;sampleReadings:{surface:string;reading:string}[];chapters:{title:string;text:string;summary:string;readings:{surface:string;reading:string}[]}[]};
export type Settings={theme:string;font:string;size:number;line:number;width:number;mode:'pages'|'scroll';effect:string;language:'zh'|'en'|'ja';readings:boolean};
export const defaults:Settings={theme:'paper',font:'serif',size:22,line:1.85,width:820,mode:'pages',effect:'slide',language:'zh',readings:true};
export const effects=['none','slide','fade','paper','flip','cube-in','cube-out','bounce','carousel'];
export const fonts=['serif','sans','mono','system'];
export const themes=['paper','sage','night','sepia','mist','rose','lavender','ocean','charcoal','slate'];
const DEFAULT_POOL_REPO='jayson-sheyue/Leaflight';
function fail():never{throw Error('invalid-import');}
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max;
function hashId(input:string){let h1=0x811c9dc5,h2=0x01000193;for(let i=0;i<input.length;i++){const c=input.charCodeAt(i);h1=Math.imul(h1^c,0x01000193)>>>0;h2=Math.imul(h2^(c+i),0x85ebca6b)>>>0;}return h1.toString(16).padStart(8,'0')+h2.toString(16).padStart(8,'0').slice(0,4);}
function cleanReadings(raw:unknown){return Array.isArray(raw)?raw.filter((r:any)=>record(r)&&str(r.surface,200)&&!!r.surface&&str(r.reading,300)).slice(0,3000).map((r:any)=>({surface:r.surface,reading:r.reading})):[];}
export function position(v:unknown,chapters:number):v is Position{
 if(!record(v)||!Number.isInteger(v.chapter)||v.chapter<0||v.chapter>=Math.max(1,chapters)||!Number.isFinite(v.fraction)||v.fraction<0||v.fraction>1)return false;
 return (v.paragraph===undefined&&v.index===undefined)||(Number.isInteger(v.paragraph)&&v.paragraph>=0&&v.paragraph<100000&&Number.isInteger(v.index)&&v.index>=0&&v.index<200000);
}
function cleanPosition(v:Position):Position{return {chapter:v.chapter,fraction:v.fraction,...(Number.isInteger(v.paragraph)&&Number.isInteger(v.index)?{paragraph:v.paragraph,index:v.index}:{})};}
function normalizeText(v:string){return v.replace(/\\(?:\\)?r\\(?:\\)?n|\\(?:\\)?n/g,'\n');}
export function validateBook(value:unknown):Book{
 if(!record(value)||!str(value.id,200)||!value.id||!str(value.title,1000)||!value.title||!str(value.synopsis,20000)||!record(value.preset)||!['en','ja',undefined].includes(value.preset.language)||!str(value.preset.level,30)||!Array.isArray(value.chapters)||value.chapters.length>100||!Array.isArray(value.bookmarks)||value.bookmarks.length>1000||!position(value.progress,value.chapters.length))fail();
 const ids=new Set<string>();
 const chapters=value.chapters.map((c:unknown)=>{
  if(!record(c)||!str(c.id,200)||!c.id||ids.has(c.id)||!str(c.title,1000)||!str(c.text,500000)||c.readings!==undefined&&(!Array.isArray(c.readings)||c.readings.length>3000||!c.readings.every((r:unknown)=>record(r)&&str(r.surface,200)&&!!r.surface&&str(r.reading,300))))fail();
  ids.add(c.id);return {id:c.id,title:c.title,text:normalizeText(c.text),...(str(c.summary,20000)?{summary:c.summary}:{}),...(str(c.generationId,200)?{generationId:c.generationId}:{}),...(c.readings?{readings:c.readings.map((r:any)=>({surface:r.surface,reading:r.reading}))}:{})};
 });
 if(!value.bookmarks.every((m:unknown)=>record(m)&&str(m.id,200)&&!!m.id&&position(m,chapters.length)))fail();
 // Keep whitelisted reading/continuation fields only, never credentials or writing drafts.
 const series=cleanSeries(value,chapters.length);
 const marks:Bookmark[]=[];const seen=new Set<string>();
 for(const mark of value.bookmarks){const key=mark.chapter+':'+(Number.isInteger(mark.paragraph)?mark.paragraph+':'+mark.index:Math.round(mark.fraction*100));if(!seen.has(key)){seen.add(key);marks.push({id:mark.id,...cleanPosition(mark)});}}
 return {id:value.id,title:value.title,synopsis:value.synopsis,...(value.source==='import'||value.source==='pool'?{source:value.source}:{}),...(str(value.poolId,120)&&value.poolId?{poolId:value.poolId}:{}),...(str(value.sharedBy,80)&&value.sharedBy?{sharedBy:value.sharedBy}:{}),preset:{language:value.preset.language||'en',level:value.preset.level},chapters,...(series?{series}:{}),progress:cleanPosition(value.progress),bookmarks:marks,updatedAt:str(value.updatedAt,100)?value.updatedAt:new Date().toISOString()};
}
function cleanSeries(book:Record<string,any>,count:number):Series|undefined{
 let v=book.series;
 if(!v&&book.source!=='import'&&Array.isArray(book.outline)&&book.outline.length>=2&&book.outline.length===book.preset.totalChapters&&count<=book.preset.totalChapters&&typeof book.bible==='string'){
  const p=book.preset,science=p.science,language=p.language||'en';
  const context=science&&Array.isArray(science.facts?.[language])?JSON.stringify({title:science.title?.[language],facts:science.facts[language].filter((x:unknown)=>str(x,1500)).slice(0,8),misconception:typeof science.misconception?.[language]==='string'?science.misconception[language].slice(0,2000):''}):'';
  v={version:1,genre:p.genre,idea:p.preferences||'',length:'medium',words:p.words,totalChapters:p.totalChapters,bible:book.bible,outline:book.outline,sample:book.sample||'',memory:book.memory||'',context};
 }
 if(v===undefined)return;
 if(!record(v)||v.version!==1||!str(v.genre,100)||!v.genre||!str(v.idea,4000)||!['short','medium','long'].includes(v.length)||!Number.isInteger(v.totalChapters)||v.totalChapters<2||v.totalChapters>100||count>v.totalChapters||!str(v.bible,50000)||!Array.isArray(v.outline)||v.outline.length!==v.totalChapters||!v.outline.every((x:unknown)=>str(x,4000)&&!!x)||!str(v.sample,20000)||!str(v.memory,50000)||v.words!==undefined&&(!Number.isInteger(v.words)||v.words<100||v.words>10000)||v.context!==undefined&&!str(v.context,20000))fail();
 return {version:1,genre:v.genre,idea:v.idea,length:v.length,totalChapters:v.totalChapters,...(v.words?{words:v.words}:{}),bible:v.bible,outline:[...v.outline],sample:normalizeText(v.sample),memory:normalizeText(v.memory),...(v.context?{context:v.context}:{}),...(Array.isArray(v.sampleReadings)?{sampleReadings:cleanReadings(v.sampleReadings)}:{})};
}
export function validatePoolStory(raw:unknown):PoolStory{
 const input=record(raw)&&record(raw.story)?raw.story:raw;
 if(!record(input)||!str(input.title,300)||!input.title.trim()||!Array.isArray(input.chapters)||!input.chapters.length||input.chapters.length>100)fail();
 const chapters=input.chapters.map((c:unknown)=>{
  if(!record(c)||!str(c.title,300)||!c.title.trim()||!str(c.text,150000)||normalizeText(c.text).trim().length<80)fail();
  const title=normalizeText(c.title.trim()),text=normalizeText(c.text.trim()),summary=str(c.summary,2000)&&c.summary.trim()?normalizeText(c.summary.trim()):title;
  return {title,text,summary,readings:cleanReadings(c.readings)};
 });
 const rp=record(input.preset)?input.preset:{},language:'en'|'ja'=rp.language==='ja'?'ja':'en',level=str(rp.level,30)&&rp.level.trim()?rp.level.trim():(language==='ja'?'N4':'B1');
 const genre=['fantasy','mystery','science fiction','adventure','slice of life','romance'].includes(rp.genre)?rp.genre:'slice of life';
 const words=Number.isInteger(rp.words)?Math.min(language==='ja'?6000:3000,Math.max(300,rp.words)):(language==='ja'?900:600);
 const outlineRaw=Array.isArray(input.outline)&&input.outline.every((x:unknown)=>str(x,500)&&!!x.trim())?input.outline.map((x:string)=>normalizeText(x.trim())):chapters.map(c=>c.title);
 const totalChapters=Math.min(100,Math.max(chapters.length,outlineRaw.length,Number.isInteger(rp.totalChapters)?rp.totalChapters:chapters.length));
 const outline=[...outlineRaw];while(outline.length<totalChapters){const ch=chapters[outline.length];outline.push(ch?ch.title:`Chapter ${outline.length+1}`);}
 const preferences=str(rp.preferences,3000)?rp.preferences:'';
 const synopsis=str(input.synopsis,4000)&&input.synopsis.trim()?normalizeText(input.synopsis.trim()):chapters[0].summary;
 const bible=str(input.bible,6000)?normalizeText(input.bible.trim()):'';
 const sample=str(input.sample,20000)&&input.sample.trim()?normalizeText(input.sample.trim()):chapters[0].text.split(/\n\s*\n/).slice(0,2).join('\n\n');
 const sampleReadings=cleanReadings(input.sampleReadings??chapters[0].readings);
 const sharedBy=str(input.sharedBy,60)&&input.sharedBy.trim()?input.sharedBy.trim():'Leaflight Reader';
 const sharedAt=typeof input.sharedAt==='string'&&!Number.isNaN(Date.parse(input.sharedAt))?new Date(input.sharedAt).toISOString():'2026-04-20T00:00:00.000Z';
 const note=str(input.note,280)?input.note.trim():'';
 const sourceUrl=str(input.sourceUrl,500)&&/^https:\/\/github\.com\//i.test(input.sourceUrl)?input.sourceUrl:undefined;
 const poolId=typeof input.poolId==='string'&&/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(input.poolId.trim())?input.poolId.trim().toLowerCase():`pool-${language}-${level.toLowerCase()}-${hashId(`${language}:${level}:${input.title.trim().toLowerCase()}:${chapters[0].title.toLowerCase()}`)}`;
 return {poolId,sharedBy,sharedAt,note,...(sourceUrl?{sourceUrl}:{}),preset:{language,level,genre,words,totalChapters,preferences},title:normalizeText(input.title.trim()),synopsis,bible,outline:outline.slice(0,totalChapters),sample,sampleReadings,chapters};
}
export function poolStoryToBook(raw:unknown):Book{
 const s=validatePoolStory(raw);
 const chapters:Chapter[]=s.chapters.map((c,i)=>({id:`${s.poolId}-ch-${i+1}`,title:c.title,text:c.text,summary:c.summary,...(c.readings.length?{readings:c.readings}:{})}));
 const series:Series|undefined=s.preset.totalChapters>=2?{version:1,genre:s.preset.genre,idea:s.preset.preferences||s.synopsis,length:'medium',words:s.preset.words,totalChapters:s.preset.totalChapters,bible:s.bible||s.synopsis,outline:s.outline,sample:s.sample,sampleReadings:s.sampleReadings,memory:chapters.at(-1)?.summary||s.synopsis}:undefined;
 return validateBook({id:s.poolId,source:'pool',poolId:s.poolId,sharedBy:s.sharedBy,title:s.title,synopsis:s.synopsis,preset:{language:s.preset.language,level:s.preset.level},chapters,...(series?{series}:{}),progress:{chapter:0,fraction:0},bookmarks:[],updatedAt:s.sharedAt});
}
export function sanitizeForPool(book:Book,meta:{sharedBy?:string;note?:string;repo?:string}={}){
 if(!record(book)||!Array.isArray(book.chapters)||!book.chapters.length)throw Error('empty-book');
 const s=validatePoolStory({poolId:book.poolId,sharedBy:meta.sharedBy,sharedAt:new Date().toISOString(),note:meta.note,preset:{language:book.preset?.language||'en',level:book.preset?.level||'B1',genre:book.series?.genre||book.preset?.genre||'slice of life',words:book.series?.words||book.preset?.words||600,totalChapters:book.series?.totalChapters||book.chapters.length,preferences:book.series?.idea||''},title:book.title,synopsis:book.synopsis||book.chapters[0]?.summary||book.title,bible:book.series?.bible||'',outline:book.series?.outline||book.chapters.map(c=>c.title),sample:book.series?.sample||book.chapters[0].text.split(/\n\s*\n/).slice(0,2).join('\n\n'),sampleReadings:book.series?.sampleReadings||book.chapters[0].readings||[],chapters:book.chapters.map(c=>({title:c.title,text:c.text,summary:c.summary||c.title,readings:c.readings||[]}))});
 const langLabel=s.preset.language.toUpperCase(),issueTitle=`[Story Pool] (${langLabel} ${s.preset.level}) ${s.title}`;
 const exportPayload={format:'leaflight-pool-story' as const,version:1 as const,story:s};
 const issueBody=[`### ${s.title}`,'',`- **Language / Level**: ${langLabel} · ${s.preset.level}`,`- **Genre**: ${s.preset.genre}`,`- **Chapters**: ${s.chapters.length} / ${s.preset.totalChapters}`,`- **Shared by**: ${s.sharedBy}`,...(s.note?[`- **Reader Note**: ${s.note}`]:[]),'',`> ${s.synopsis}`,'','```leaflight-story',JSON.stringify(exportPayload,null,2),'```'].join('\n');
 const repo=meta.repo?.trim()||DEFAULT_POOL_REPO,fullUrl=`https://github.com/${repo}/issues/new?labels=story-pool&title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
 const fallbackBody=[`### ${s.title}`,'',`> 已自动将完整作品内容复制到剪贴板，请在下方长按粘贴后点击 Submit new issue 即可！`,'','<!-- 请在此处粘贴剪贴板中的内容 -->'].join('\n');
 return {story:s,exportPayload,issueTitle,issueBody,newIssueUrl:fullUrl.length<=7200?fullUrl:`https://github.com/${repo}/issues/new?labels=story-pool&title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(fallbackBody)}`,urlTruncated:fullUrl.length>7200};
}
export function extractStoryFromIssue(issue:unknown):PoolStory|null{
 if(!record(issue)||typeof issue.body!=='string')return null;
 const fence=issue.body.match(/```(?:leaflight-story|json)\s*([\s\S]*?)```/i),candidate=fence?fence[1].trim():issue.body.trim();
 if(!candidate.startsWith('{'))return null;
 try{const parsed=JSON.parse(candidate),raw=record(parsed)&&record(parsed.story)?parsed.story:parsed;if(!record(raw))return null;return validatePoolStory({...raw,sharedBy:raw.sharedBy||issue.user?.login||'GitHub Reader',sharedAt:raw.sharedAt||issue.created_at||new Date().toISOString(),sourceUrl:issue.html_url||raw.sourceUrl});}catch{return null;}
}
export function parseImport(text:string){
 if(new TextEncoder().encode(text).length>30*1024*1024)throw Error('too-large');
 let data:any;try{data=JSON.parse(text);}catch{fail();}
 if(record(data)&&data.format==='leaflight-pool-story'&&data.version===1)return {books:[poolStoryToBook(data.story??data)],source:'leaflight-pool-story',settings:null};
 if(!record(data)||!['leaflight','leaflight-reader'].includes(data.format)||data.version!==1||!Array.isArray(data.books)||data.books.length>500)fail();
 const books=data.books.map(validateBook);if(new Set(books.map((b:Book)=>b.id)).size!==books.length)fail();
 return {books:books as Book[],source:data.format,settings:data.format==='leaflight-reader'?validateSettings(data.settings):null};
}
export function validateSettings(v:unknown):Settings{
 if(!record(v))return {...defaults};
 return {theme:themes.includes(v.theme)?v.theme:defaults.theme,font:fonts.includes(v.font)?v.font:defaults.font,size:Number.isFinite(v.size)&&v.size>=16&&v.size<=40?v.size:defaults.size,line:Number.isFinite(v.line)&&v.line>=1.3&&v.line<=2.5?v.line:defaults.line,width:Number.isFinite(v.width)&&v.width>=420&&v.width<=1100?v.width:defaults.width,mode:v.mode==='scroll'?'scroll':'pages',effect:effects.includes(v.effect)?v.effect:defaults.effect,language:['en','ja','zh'].includes(v.language)?v.language:'zh',readings:v.readings!==false};
}
export function mergeBooks(current:Book[],incoming:Book[]){
 const byId=new Map(current.map(b=>[b.id,b]));let added=0,updated=0,skipped=0;
 for(const book of incoming){const old=byId.get(book.id);if(!old){byId.set(book.id,book);added++;continue;}
  const prefix=Math.min(old.chapters.length,book.chapters.length);
  if(old.preset.language!==book.preset.language||old.chapters.slice(0,prefix).some((c,i)=>c.id!==book.chapters[i].id||c.text!==book.chapters[i].text)){skipped++;continue;}
  if(book.chapters.length>old.chapters.length||book.chapters.length===old.chapters.length&&!old.series&&book.series){byId.set(book.id,{...book,progress:old.progress,bookmarks:old.bookmarks});updated++;}else skipped++;
 }
 return {books:[...byId.values()],added,updated,skipped};
}
function request<T>(r:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function done(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||Error('storage-error'));});}
export class Library{
 private constructor(private db:IDBDatabase){}
 static async open(){const r=indexedDB.open('leaflight-reader',1);r.onupgradeneeded=()=>{r.result.createObjectStore('books',{keyPath:'id'});r.result.createObjectStore('meta');};return new Library(await request(r));}
 async list(){return await request(this.db.transaction('books').objectStore('books').getAll()) as Book[];}
 async settings(){return validateSettings(await request(this.db.transaction('meta').objectStore('meta').get('settings')));}
 async saveSettings(v:Settings){const tx=this.db.transaction('meta','readwrite'),completion=done(tx);tx.objectStore('meta').put(v,'settings');await completion;}
 async meta<T>(key:string):Promise<T|undefined>{return await request(this.db.transaction('meta').objectStore('meta').get(key));}
 async saveMeta(key:string,value:unknown){const tx=this.db.transaction('meta','readwrite'),completion=done(tx);tx.objectStore('meta').put(value,key);await completion;}
 async finishGeneration(book:Book,jobs:unknown){const tx=this.db.transaction(['books','meta'],'readwrite'),completion=done(tx);tx.objectStore('books').add(validateBook(book));tx.objectStore('meta').put(jobs,'generation-jobs');await completion;}
 async get(id:string){return await request(this.db.transaction('books').objectStore('books').get(id)) as Book|undefined;}
 async saveReading(book:Book){const tx=this.db.transaction('books','readwrite'),completion=done(tx),store=tx.objectStore('books'),latest=await request(store.get(book.id)) as Book|undefined;if(latest)store.put({...latest,progress:book.progress,bookmarks:book.bookmarks});await completion;}
 async archiveChapter(id:string,expected:number,c:Chapter&{memory:string},jobs:unknown){const tx=this.db.transaction(['books','meta'],'readwrite'),completion=done(tx),store=tx.objectStore('books');const book=await request(store.get(id)) as Book|undefined;if(!book?.series||book.chapters.length!==expected||expected>=book.series.totalChapters){tx.abort();await completion;throw Error('chapter-conflict');}const {memory,...chapter}=c;book.chapters.push(chapter);book.series.memory=memory;book.updatedAt=new Date().toISOString();store.put(validateBook(book));tx.objectStore('meta').put(jobs,'generation-jobs');await completion;return book;}
 async put(book:Book){const tx=this.db.transaction('books','readwrite'),completion=done(tx);tx.objectStore('books').put(book);await completion;}
 async remove(id:string){const tx=this.db.transaction('books','readwrite'),completion=done(tx);tx.objectStore('books').delete(id);await completion;}
 async import(text:string){const parsed=parseImport(text);const tx=this.db.transaction(['books','meta'],'readwrite'),completion=done(tx),store=tx.objectStore('books');
  const current=await request(store.getAll()),result=mergeBooks(current,parsed.books);result.books.forEach(b=>store.put(b));
  if(parsed.settings&&!current.length)tx.objectStore('meta').put(parsed.settings,'settings');await completion;
  return {added:result.added,updated:result.updated,skipped:result.skipped,source:parsed.source};
 }
 async backup(){return JSON.stringify({format:'leaflight-reader',version:1,books:await this.list(),settings:await this.settings()},null,2);}
}
