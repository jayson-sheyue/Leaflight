import {strFromU8} from 'fflate';
import ArchiveWorker from './book-archive.worker?worker&inline';
import limits from '../electron/import-limits.json';
export type ImportedBook={title:string;language:'en'|'ja';chapters:{title:string;text:string;readings:{surface:string;reading:string}[]}[]};
export const importErrorMessages:Record<string,string>={
 'import-file-limit':'导入失败：文件超过 50 MiB，请拆分为较小的文件。',
 'import-archive-limit':'导入失败：EPUB 展开内容过大或文件条目过多，请拆分后重试。',
 'import-text-limit':'导入失败：正文超过 3200 万字符，请分卷导入。',
 'import-chapter-limit':'导入失败：超过 5000 个章节或分段，请分卷导入。',
 'import-encrypted':'导入失败：此 EPUB 含加密资源，暂不支持。',
 'import-unsafe-xml':'导入失败：此 EPUB 包含不支持的实体声明或 DTD。',
 'import-empty':'导入失败：没有找到可阅读的正文。',
 'import-encoding':'导入失败：TXT 请使用 UTF-8 编码保存。',
 'import-unsupported':'导入失败：请选择 TXT 或 EPUB 文件。',
 'import-timeout':'导入超时，请拆分文件后重试。',
 'import-invalid':'导入失败：EPUB 结构不完整或内容无法解析。'
};
export function storyImportError(error:unknown){const code=error instanceof Error?error.message:'';return importErrorMessages[code]||(code==='网页预览存储空间不足，请使用 Mac 或 Android 客户端导入长篇。'?code:'')||'导入未完成，请检查可用存储空间后重试。';}
const fail=(code='import-invalid'):never=>{throw Error(code);};
const tags=(node:Document|Element,name:string)=>Array.from(node.getElementsByTagName('*')).filter(e=>e.localName===name);
const entityCache=new Map<string,string>();
function parse(xml:string){
 // Strip inert HTML/XHTML doctypes; never expand custom entities or fetch DTDs.
 if(/<!ENTITY\b/i.test(xml))fail('import-unsafe-xml');
 xml=xml.replace(/<!DOCTYPE\s+html(?:\s+(?:PUBLIC\s+(?:"[^"]*"|'[^']*')\s+(?:"[^"]*"|'[^']*')|SYSTEM\s+(?:"[^"]*"|'[^']*')))?\s*>/gi,'');
 if(/<!DOCTYPE\b/i.test(xml))fail('import-unsafe-xml');
 xml=xml.replace(/&([a-z][a-z0-9]+);/gi,(entity,name:string)=>{
  if(['amp','lt','gt','quot','apos'].includes(name))return entity;
  if(!entityCache.has(entity)){const el=document.createElement('textarea');el.innerHTML=entity;if(el.value===entity)return entity;entityCache.set(entity,Array.from(el.value).map(c=>`&#${c.codePointAt(0)};`).join(''));}
  return entityCache.get(entity)!;
 });
 const doc=new DOMParser().parseFromString(xml,'application/xml');if(tags(doc,'parsererror').length)fail();return doc;
}
function language(text:string):'en'|'ja'{return /[\u3040-\u30ff]/.test(text.slice(0,10000))?'ja':'en';}
function pathJoin(base:string,href:string){
 let decoded:string;try{decoded=decodeURIComponent(href.split('#')[0]);}catch{return fail();}
 if(/^(?:[a-z]+:|\/|\\)/i.test(decoded)||decoded.includes('\\')||/[\x00-\x1f]/.test(decoded))fail();
 const out:string[]=[];for(const part of (base+'/'+decoded).split('/')){if(part==='..'){if(!out.length)fail();out.pop();}else if(part&&part!=='.')out.push(part);}return out.join('/');
}
function chapterFromHtml(xml:string,fallback:string){
 const doc=parse(xml),body=tags(doc,'body')[0];if(!body)return fail();
 const heading=tags(body,'h1')[0]||tags(body,'h2')[0]||tags(body,'h3')[0];
 const title=(heading?.textContent?.trim()||tags(doc,'title')[0]?.textContent?.trim()||fallback).slice(0,1000);
 const readings:{surface:string;reading:string}[]=[];
 for(const ruby of tags(body,'ruby')){const rt=tags(ruby,'rt')[0];if(!rt)continue;const reading=rt.textContent?.trim()||'',surface=Array.from(ruby.childNodes).filter(n=>!(n.nodeType===1&&['rt','rp'].includes((n as Element).localName))).map(n=>n.textContent||'').join('').trim();if(surface&&reading&&surface.length<=200&&reading.length<=300)readings.push({surface,reading});}
 heading?.remove();
 const ignored=new Set(['script','style','rt','rp','nav','iframe','object','embed','template']),blocks=new Set(['p','li','blockquote','div','section','article','h1','h2','h3','h4','h5','h6','pre','tr']);
 function plain(node:Node,depth=0):string{
  if(depth>128)return fail();if(node.nodeType===3)return(node.textContent||'').replace(/\s+/g,' ');if(node.nodeType!==1)return '';
  const tag=(node as Element).localName;if(ignored.has(tag))return '';if(tag==='br')return '\n';
  const text=tag==='pre'?node.textContent||'':Array.from(node.childNodes).map(n=>plain(n,depth+1)).join('');return blocks.has(tag)?'\n\n'+text.trim()+'\n\n':text;
 }
 const text=plain(body).replace(/[ \t]*\n[ \t]*/g,'\n').replace(/\n{3,}/g,'\n\n').trim();return {title,text,readings:readings.slice(0,3000)};
}
function splitText(text:string){
 const chunks:string[]=[];let start=0;
 while(text.length-start>limits.splitAt){let cut=text.lastIndexOf('\n\n',start+limits.splitAt);if(cut<start+limits.splitAt/2)cut=text.lastIndexOf(' ',start+limits.splitAt);if(cut<start+limits.splitAt/2)cut=start+limits.splitAt;if(/[\uD800-\uDBFF]/.test(text[cut-1]))cut--;chunks.push(text.slice(start,cut).trim());start=cut;if(chunks.length>limits.maxChapters)fail('import-chapter-limit');}
 if(text.slice(start).trim())chunks.push(text.slice(start).trim());return chunks;
}
function archive(bytes:Uint8Array):Promise<Record<string,Uint8Array>>{
 return new Promise((resolve,reject)=>{const worker=new ArchiveWorker();const finish=()=>{clearTimeout(timer);worker.terminate();};const timer=setTimeout(()=>{finish();reject(Error('import-timeout'));},60000);worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data.files);};worker.onerror=()=>{finish();reject(Error('import-invalid'));};worker.postMessage(bytes,[bytes.buffer]);});
}
export async function readStoryFile(file:File):Promise<ImportedBook>{
 if(file.size>limits.maxFileBytes)fail('import-file-limit');const title=file.name.replace(/\.(txt|epub)$/i,'').slice(0,1000)||'Imported story';
 if(!/\.(txt|epub)$/i.test(file.name))return fail('import-unsupported');const bytes=new Uint8Array(await file.arrayBuffer());
 if(/\.txt$/i.test(file.name)){let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();}catch{return fail('import-encoding');}if(!text)fail('import-empty');if(text.length>limits.maxTextChars)fail('import-text-limit');const chunks=splitText(text);if(chunks.length>limits.maxChapters)fail('import-chapter-limit');return {title,language:language(text),chapters:chunks.map((text,i)=>({title:chunks.length===1?title:`${title} ${i+1}`,text,readings:[]}))};}
 const files=await archive(bytes);const get=(name:string)=>{if(!files[name])return fail();return strFromU8(files[name]);};
 const container=parse(get('META-INF/container.xml')),opfPath=tags(container,'rootfile')[0]?.getAttribute('full-path');if(!opfPath)return fail();const path=pathJoin('',opfPath),opf=parse(get(path)),dir=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'';
 const manifest=new Map(tags(opf,'item').map(e=>[e.getAttribute('id'),e])),spine=tags(opf,'itemref');if(!spine.length)fail('import-empty');if(spine.length>limits.maxChapters+100)fail('import-chapter-limit');
 const chapters:ImportedBook['chapters']=[];let total=0,visited=0;
 for(const ref of spine){const item=manifest.get(ref.getAttribute('idref'));if(!item)return fail();if(item.getAttribute('properties')?.split(/\s+/).includes('nav'))continue;if(!['application/xhtml+xml','text/html'].includes(item.getAttribute('media-type')||''))continue;
  const chapter=chapterFromHtml(get(pathJoin(dir,item.getAttribute('href')||'')),`Chapter ${chapters.length+1}`);
  if(chapter.text){if((total+=chapter.text.length)>limits.maxTextChars)fail('import-text-limit');const parts=splitText(chapter.text);for(let i=0;i<parts.length;i++)chapters.push({...chapter,title:parts.length===1?chapter.title:`${chapter.title.slice(0,970)} (${i+1}/${parts.length})`,text:parts[i]});if(chapters.length>limits.maxChapters)fail('import-chapter-limit');}
  if(++visited%12===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(!chapters.length)fail('import-empty');const name=tags(opf,'title')[0]?.textContent?.trim().slice(0,1000)||title,declared=tags(opf,'language')[0]?.textContent?.toLowerCase()||'';
 return {title:name,language:declared.startsWith('ja')?'ja':declared.startsWith('en')?'en':language(chapters.slice(0,2).map(c=>c.text).join('')),chapters};
}
