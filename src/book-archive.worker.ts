import {unzipSync} from 'fflate';
import limits from '../electron/import-limits.json';
// Inflate away from the reader; budget images/fonts but never decompress them.
const worker = self as unknown as {onmessage:((e:MessageEvent<Uint8Array>)=>void)|null;postMessage:(value:unknown,transfer:Transferable[])=>void};
worker.onmessage = ({data}) => {
  try {
    let count=0,total=0,xml=0;const names=new Set<string>();
    const files=unzipSync(data,{filter(entry){
      if(++count>limits.maxEntries||!Number.isSafeInteger(entry.originalSize)||entry.originalSize<0||(total+=entry.originalSize)>limits.maxArchiveBytes)throw Error('import-archive-limit');
      if(entry.name.length>2048||names.has(entry.name))throw Error('import-invalid');names.add(entry.name);
      if(entry.name==='META-INF/encryption.xml')throw Error('import-encrypted');
      const include=!entry.name.endsWith('/')&&!/\.(?:jpe?g|png|gif|webp|svg|avif|ico|bmp|ttf|otf|woff2?|eot|mp3|m4a|ogg|wav|mp4|mov|pdf|css|js)$/i.test(entry.name);
      if(include&&(xml+=entry.originalSize)>limits.maxXmlBytes)throw Error('import-archive-limit');return include;
    }});
    if(Object.values(files).reduce((n,b)=>n+b.length,0)>limits.maxXmlBytes)throw Error('import-archive-limit');
    worker.postMessage({files},[...new Set(Object.values(files).map(b=>b.buffer as ArrayBuffer))]);
  }catch(error){worker.postMessage({error:error instanceof Error&&error.message.startsWith('import-')?error.message:'import-invalid'},[]);}
};
