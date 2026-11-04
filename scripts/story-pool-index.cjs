const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {validatePoolStory,extractStoryFromIssue}=require('../electron/pool.cjs');
const {MAX_ZIP,MAX_STORY,readShareZip,fetchBytes,catalogEntry}=require('../electron/pool-transfer.cjs');
function attachmentUrls(body=''){
 const urls=[...body.matchAll(/https:\/\/github\.com\/(?:user-attachments\/files\/\d+|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/files\/\d+)\/[^\s<>)]*\.zip(?:\?[^\s<>)]*)?/gi)].map(m=>m[0]);
 return [...new Set(urls)];
}
function allowedRedirect(url){const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='github.com'&&attachmentUrls(url)[0]===url||u.hostname==='objects.githubusercontent.com'||/^github-production-repository-file-[a-z0-9-]+\.s3\.amazonaws\.com$/.test(u.hostname));}
async function downloadAttachment(url,fetchImpl=globalThis.fetch){
 if(attachmentUrls(url)[0]!==url)throw Error('invalid-attachment-url');
 for(let n=0;n<5;n++){
  if(!allowedRedirect(url))throw Error('invalid-attachment-host');
  let next;
  const bytes=await fetchBytes(url,{limit:MAX_ZIP,redirect:'manual',fetchImpl:async(u,o)=>{const r=await fetchImpl(u,o);if([301,302,303,307,308].includes(r.status)){next=new URL(r.headers.get('location'),u).href;await r.body?.cancel();return new Response(new Uint8Array());}return r;}});
  if(!next)return bytes;url=next;
 }throw Error('too-many-redirects');
}
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';try{fs.writeFileSync(temp,data);fs.renameSync(temp,file);}finally{fs.rmSync(temp,{force:true});}}
function rebuildIndex(root='.'){
 const dir=path.join(root,'community-pool/stories');
 const entries=fs.readdirSync(dir).filter(f=>/^[a-z0-9][a-z0-9._-]{2,80}\.json$/.test(f)).map(file=>{
  const bytes=fs.readFileSync(path.join(dir,file)),s=validatePoolStory(JSON.parse(bytes));
  if(file!==s.poolId+'.json')throw Error('invalid-story-path');
  return catalogEntry(s,createHash('sha256').update(bytes).digest('hex'),bytes.length);
 }).sort((a,b)=>b.sharedAt.localeCompare(a.sharedAt));
 if(entries.length>1000)throw Error('catalog-full');
 const json=JSON.stringify({version:2,updatedAt:new Date().toISOString(),stories:entries},null,2)+'\n';if(Buffer.byteLength(json)>require('../electron/pool-transfer.cjs').MAX_INDEX)throw Error('catalog-full');atomic(path.join(root,'community-pool/index.json'),json);return entries;
}
async function processIssue(issue,{root='.',repo='jayson-sheyue/Leaflight',fetchImpl=globalThis.fetch}={}){
 const urls=attachmentUrls(issue.body);if(urls.length>1)throw Error('multiple-attachments');
 let s;
 if(urls.length){const payload=readShareZip(await downloadAttachment(urls[0],fetchImpl));s=validatePoolStory(payload.story);}
 else{s=extractStoryFromIssue(issue);if(!s)throw Error('missing-package');}
 s={...s,sourceUrl:`https://github.com/${repo}/issues/${issue.number}`};
 const file=path.join(root,'community-pool/stories',s.poolId+'.json');
 if(fs.existsSync(file)){
  const old=JSON.parse(fs.readFileSync(file,'utf8'));
  if(old.sourceUrl!==s.sourceUrl)throw Error('story-id-conflict');
 }
 const bytes=Buffer.from(JSON.stringify(s,null,2)+'\n');if(bytes.length>MAX_STORY)throw Error('share-too-large');
 atomic(file,bytes);const entries=rebuildIndex(root);
 return {ok:true,poolId:s.poolId,chapters:s.chapters.length,count:entries.length};
}
const errors={
 'missing-package':'请将 Leaflight 导出的 ZIP 分享包上传到投稿正文，等待上传完成后保存。旧版 leaflight-story JSON 代码块也仍可使用。',
 'multiple-attachments':'一条投稿请只保留一个 ZIP 分享包，然后保存修改。',
 'invalid-attachment-host':'附件下载地址不受支持。请把 ZIP 直接拖入 GitHub 投稿正文重新上传。',
 'invalid-attachment-url':'请把 ZIP 分享包直接拖入 GitHub 投稿正文上传。',
 'story-id-conflict':'这部作品的标识已由另一条投稿使用。更新章节请编辑原投稿并替换附件；不同作品请重新导出分享包。',
 'share-too-large':'作品超出当前分享上限（ZIP 25 MB、解压后 JSON 30 MB）。请减少本次分享的章节。',
 'download-too-large':'附件超出 25 MB 下载上限。请重新导出较小的分享包。',
 'invalid-share-zip':'分享包损坏或格式不正确。请用新版 Leaflight 重新导出 ZIP 后替换附件。'
};
async function main(){
 if(process.argv.includes('--migrate')){rebuildIndex();return;}
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));let result;
 try{result=await processIssue(event.issue,{repo:process.env.GITHUB_REPOSITORY});}
 catch(e){result={ok:false,message:errors[e.message]||'暂未收录：附件下载或作品校验失败。请确认 ZIP 来自 Leaflight，附件上传完成后编辑并保存投稿以重试。'};process.exitCode=1;}
 const out=process.env.POOL_RESULT||path.join(process.env.RUNNER_TEMP||'.','story-pool-result.json');atomic(out,JSON.stringify(result));console.log(result.ok?`Indexed ${result.poolId} (${result.chapters} chapters)`:'Story validation failed; see issue feedback.');
}
if(require.main===module)main().catch(e=>{console.error('Pool indexing failed:',e.message);process.exitCode=1;});
module.exports={attachmentUrls,allowedRedirect,downloadAttachment,rebuildIndex,processIssue};
