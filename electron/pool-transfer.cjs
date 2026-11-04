// Shared by Electron, Android WebView and the GitHub indexer. No filesystem or credentials.
const {zip, strToU8, strFromU8, Unzip, UnzipInflate}=require('fflate');
const MAX_ZIP=25*1024*1024, MAX_STORY=30*1024*1024, MAX_INDEX=8*1024*1024;
const ID=/^[a-z0-9][a-z0-9._-]{2,80}$/;
const isCatalog=s=>!!s?.content && Number.isInteger(s.chapterCount);
function normalizeEntry(s){
 if(!isCatalog(s)||!ID.test(s.poolId)||typeof s.title!=='string'||!s.title.trim()||s.title.length>300||!['en','ja'].includes(s.preset?.language)||!['A2','B1','B2','C1','N5','N4','N3','N2','N1'].includes(s.preset?.level)||s.chapterCount<1||s.chapterCount>100||s.content.path!==`community-pool/stories/${s.poolId}.json`||!/^[a-f0-9]{64}$/.test(s.content.sha256)||!Number.isInteger(s.content.bytes)||s.content.bytes<1||s.content.bytes>MAX_STORY)throw Error('invalid-catalog');
 const bounded=(x,n)=>typeof x==='string'?x.slice(0,n):'';
 return {poolId:s.poolId,path:s.content.path,title:s.title,synopsis:bounded(s.synopsis,4000),sharedBy:bounded(s.sharedBy,60)||'Leaflight Reader',sharedAt:typeof s.sharedAt==='string'&&!isNaN(Date.parse(s.sharedAt))?new Date(s.sharedAt).toISOString():'2026-04-20T00:00:00.000Z',note:bounded(s.note,280),preset:{language:s.preset.language,level:s.preset.level,genre:bounded(s.preset.genre,100),words:s.preset.words,totalChapters:s.preset.totalChapters},sample:bounded(s.sample,1600),sampleReadings:Array.isArray(s.sampleReadings)?s.sampleReadings.slice(0,100).filter(r=>typeof r?.surface==='string'&&r.surface.length<=200&&typeof r.reading==='string'&&r.reading.length<=300).map(r=>({surface:r.surface,reading:r.reading})):[],chapterCount:s.chapterCount,content:{path:s.content.path,sha256:s.content.sha256,bytes:s.content.bytes},...(typeof s.sourceUrl==='string'&&/^https:\/\/github\.com\//.test(s.sourceUrl)?{sourceUrl:s.sourceUrl.slice(0,500)}:{})};
}
function catalogEntry(s,sha256,bytes){return normalizeEntry({...s,sample:s.sample?.slice(0,1600),chapterCount:s.chapters.length,content:{path:`community-pool/stories/${s.poolId}.json`,sha256,bytes}});}
function submission(s,repo='jayson-sheyue/Leaflight'){
 const clean=x=>String(x||'').replace(/[\r\n<>]/g,' ').replace(/\]\(/g,'] (');
 const title=`[Story Pool] (${s.preset.language.toUpperCase()} ${s.preset.level}) ${clean(s.title)}`;
 const body=[`### ${clean(s.title)}`,'',`- Language / Level: ${s.preset.language.toUpperCase()} · ${s.preset.level}`,`- Chapters: ${s.chapters.length}`,`- Shared by: ${clean(s.sharedBy)}`,'',clean(s.synopsis).slice(0,600),'','请将 Leaflight 生成的 .zip 分享包拖入此处，等待上传完成，再点击 Create / Submit new issue。','Drag the .zip share package here, wait for upload, then submit.','提交后，收录结果会回复在本投稿下。 / Indexing results will appear below.','', '<!-- leaflight-share-package:v1 -->'].join('\n');
 return {title,body,url:`https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`};
}
function createShareZip(payload){
 const bytes=strToU8(JSON.stringify(payload));if(bytes.length>MAX_STORY)throw Error('share-too-large');
 return new Promise((resolve,reject)=>zip({'story.leaflight-story.json':bytes},{level:6},(err,data)=>err?reject(err):data.length>MAX_ZIP?reject(Error('share-too-large')):resolve(data)));
}
// Stream decompression with an actual output budget; trusting ZIP size headers alone permits bombs.
function readShareZip(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>MAX_ZIP||bytes.length<22)throw Error('invalid-share-zip');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==1||view.getUint16(end+10,true)!==1)throw Error('invalid-share-zip');
 const central=view.getUint32(end+16,true),length=view.getUint32(end+12,true);
 if(central+length!==end||central+46>end||view.getUint32(central,true)!==0x02014b50||view.getUint16(central+8,true)&1||![0,8].includes(view.getUint16(central+10,true))||view.getUint32(central+24,true)>MAX_STORY||view.getUint32(central+20,true)>MAX_ZIP||view.getUint32(central+42,true)!==0||view.getUint32(0,true)!==0x04034b50)throw Error('invalid-share-zip');
 const nameLength=view.getUint16(central+28,true),extraLength=view.getUint16(central+30,true),commentLength=view.getUint16(central+32,true);
 if(46+nameLength+extraLength+commentLength!==length||strFromU8(bytes.subarray(central+46,central+46+nameLength))!=='story.leaflight-story.json')throw Error('invalid-share-zip');
 let failure,result,count=0,total=0;const chunks=[];
 const unzip=new Unzip(file=>{
  count++;if(count!==1||file.name!=='story.leaflight-story.json'||file.originalSize>MAX_STORY){failure=Error('invalid-share-zip');file.terminate();return;}
  file.ondata=(err,chunk,final)=>{if(err){failure=err;return;}total+=chunk.length;if(total>MAX_STORY){failure=Error('share-too-large');file.terminate();return;}chunks.push(chunk);if(final){const data=new Uint8Array(total);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}try{result=JSON.parse(strFromU8(data));}catch{failure=Error('invalid-share-json');}}};file.start();
 });unzip.register(UnzipInflate);
 for(let i=0;i<bytes.length&&!failure;i+=4096)unzip.push(bytes.subarray(i,i+4096),i+4096>=bytes.length);
 if(failure)throw failure;if(total!==view.getUint32(central+24,true)||count!==1||!result||result.format!=='leaflight-pool-story'||result.version!==1||!result.story)throw Error('invalid-share-zip');
 let crc=0xffffffff;for(const chunk of chunks)for(const byte of chunk){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}if(((crc^0xffffffff)>>>0)!==view.getUint32(central+16,true))throw Error('invalid-share-zip');return result;
}
async function hashBytes(bytes){return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
async function fetchBytes(url,{fetchImpl=globalThis.fetch,limit=MAX_STORY,timeout=20000,...options}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{const res=await fetchImpl(url,{...options,signal:controller.signal});if(!res.ok)throw Error(`HTTP ${res.status}`);if(Number(res.headers?.get('content-length'))>limit)throw Error('download-too-large');
  const chunks=[];let size=0;
  if(res.body?.getReader){const reader=res.body.getReader();try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('download-too-large');}chunks.push(value);}}finally{reader.releaseLock();}}
  else{const data=new Uint8Array(await res.arrayBuffer());size=data.length;if(size>limit)throw Error('download-too-large');chunks.push(data);}
  const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}return bytes;
 }finally{clearTimeout(timer);}
}
async function loadStory(entry,{repo='jayson-sheyue/Leaflight',fetchImpl=globalThis.fetch}={}){
 const e=normalizeEntry(entry),bytes=await fetchBytes(`https://raw.githubusercontent.com/${repo}/main/${e.content.path}`,{fetchImpl});
 if(bytes.length!==e.content.bytes||await hashBytes(bytes)!==e.content.sha256)throw Error('story-integrity');
 const raw=JSON.parse(strFromU8(bytes));if((raw.story||raw).poolId!==e.poolId)throw Error('story-integrity');return raw;
}
module.exports={MAX_ZIP,MAX_STORY,MAX_INDEX,isCatalog,normalizeEntry,catalogEntry,submission,createShareZip,readShareZip,hashBytes,fetchBytes,loadStory};
