export type Position={chapter:number;fraction:number;paragraph?:number;index?:number};
export type Bookmark=Position&{id:string};
export type Chapter={id:string;title:string;text:string;summary?:string;generationId?:string;readings?:{surface:string;reading:string}[]};
export type Series={version:1;genre:string;idea:string;length:string;totalChapters:number;words?:number;bible:string;outline:string[];sample:string;sampleReadings?:{surface:string;reading:string}[];memory:string;context?:string};
export type Book={id:string;title:string;synopsis:string;preset:{language:'en'|'ja';level:string};chapters:Chapter[];series?:Series;progress:Position;bookmarks:Bookmark[];updatedAt:string;[key:string]:unknown};
export type Settings={theme:string;font:string;size:number;line:number;width:number;mode:'pages'|'scroll';effect:string;language:'zh'|'en'|'ja';readings:boolean};
export const defaults:Settings={theme:'paper',font:'serif',size:22,line:1.85,width:820,mode:'pages',effect:'slide',language:'zh',readings:true};
export const effects=['none','slide','fade','paper','flip','cube-in','cube-out','bounce','carousel'];
export const fonts=['serif','sans','mono','system'];
export const themes=['paper','sage','night','sepia','mist','rose','lavender','ocean','charcoal','slate'];
function fail():never{throw Error('invalid-import');}
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max;
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
 return {id:value.id,title:value.title,synopsis:value.synopsis,...(value.source==='import'?{source:'import'}:{}),preset:{language:value.preset.language||'en',level:value.preset.level},chapters,...(series?{series}:{}),progress:cleanPosition(value.progress),bookmarks:marks,updatedAt:str(value.updatedAt,100)?value.updatedAt:new Date().toISOString()};
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
 return {version:1,genre:v.genre,idea:v.idea,length:v.length,totalChapters:v.totalChapters,...(v.words?{words:v.words}:{}),bible:v.bible,outline:[...v.outline],sample:normalizeText(v.sample),memory:normalizeText(v.memory),...(v.context?{context:v.context}:{}),...(Array.isArray(v.sampleReadings)?{sampleReadings:v.sampleReadings.filter((r:any)=>record(r)&&str(r.surface,200)&&!!r.surface&&str(r.reading,300)).slice(0,3000).map((r:any)=>({surface:r.surface,reading:r.reading}))}:{})};
}
export function parseImport(text:string){
 if(new TextEncoder().encode(text).length>30*1024*1024)throw Error('too-large');
 let data:any;try{data=JSON.parse(text);}catch{fail();}
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
