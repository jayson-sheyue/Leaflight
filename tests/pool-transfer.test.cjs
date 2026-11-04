const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {zipSync,strToU8}=require('fflate');
const T=require('../electron/pool-transfer.cjs'),P=require('../electron/pool.cjs'),I=require('../scripts/story-pool-index.cjs');
function longStory(){const s=structuredClone(P.SEED_STORIES[0]);s.poolId='pool-en-b1-long-regression';s.title='Long story regression fixture';s.chapters=Array.from({length:24},(_,i)=>({title:`Chapter ${i+1}`,text:('The river curved through the valley. A reader followed the path and watched the weather change.\n\n').repeat(220),summary:'A walk through the valley.',readings:[]}));s.outline=s.chapters.map(c=>c.title);s.preset.totalChapters=24;return P.validatePoolStory(s);}
function workspace(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-pool-'));fs.mkdirSync(path.join(root,'community-pool/stories'),{recursive:true});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('long story exceeds Issue text limit but ZIP roundtrip preserves every chapter; submission contains no prose',async()=>{
 const story=longStory(),payload={format:'leaflight-pool-story',version:1,story};assert(JSON.stringify(payload).length>65536);
 const zip=await T.createShareZip(payload);assert.deepEqual(T.readShareZip(zip),payload);
 const post=T.submission(story);assert(post.body.length<2000);assert(post.url.length<7200);assert(!post.body.includes(story.chapters[0].text));assert(post.body.includes('ZIP')||post.body.includes('.zip'));
});
test('rejects damaged/truncated archives, traversal, multiple files and misleading expanded-size headers',async()=>{
 const bytes=await T.createShareZip({format:'leaflight-pool-story',version:1,story:longStory()});
 assert.throws(()=>T.readShareZip(bytes.slice(0,-5)));
 assert.throws(()=>T.readShareZip(zipSync({'../story.leaflight-story.json':strToU8('{}')})));
 assert.throws(()=>T.readShareZip(zipSync({'story.leaflight-story.json':strToU8('{}'),'extra.json':strToU8('{}')})));
 const damaged=bytes.slice();damaged[50]^=0x40;assert.throws(()=>T.readShareZip(damaged));
 const header=bytes.slice(),v=new DataView(header.buffer),central=v.getUint32(header.length-6,true);v.setUint32(central+24,T.MAX_STORY+1,true);assert.throws(()=>T.readShareZip(header));
});
test('attachment indexing creates a compact catalog; browsing fetches no full stories; borrowing verifies the whole story',async t=>{
 const root=workspace(t),story=longStory(),archive=await T.createShareZip({format:'leaflight-pool-story',version:1,story});
 const issue={number:9001,body:'[Share](https://github.com/user-attachments/files/123/long.zip)',user:{login:'fixture'}};
 await I.processIssue(issue,{root,fetchImpl:async()=>new Response(archive)});
 const index=JSON.parse(fs.readFileSync(path.join(root,'community-pool/index.json'))),entry=index.stories[0];assert.equal(index.version,2);assert.equal(entry.chapterCount,24);assert(!entry.chapters);assert(!entry.bible);assert(JSON.stringify(index).length<9000);
 const calls=[];const catalog=await P.fetchRemotePool({fetchImpl:async url=>{calls.push(url);return new Response(JSON.stringify(index));}});assert.equal(calls.length,1);assert.equal(catalog.online,true);const remote=catalog.stories.find(s=>s.poolId===story.poolId);assert(remote.content);assert(!remote.chapters);
 const content=fs.readFileSync(path.join(root,entry.content.path));const full=await T.loadStory(remote,{fetchImpl:async()=>new Response(content)});assert.equal(full.chapters[23].text,story.chapters[23].text);
 await assert.rejects(T.loadStory(remote,{fetchImpl:async()=>new Response(Buffer.concat([content,Buffer.from(' ')]))}),/integrity/);
 const changed=Buffer.from(content);changed[changed.indexOf('river')]=120;await assert.rejects(T.loadStory(remote,{fetchImpl:async()=>new Response(changed)}),/integrity/);
});
test('legacy Issue payload and same-Issue updates stay compatible; a different Issue cannot overwrite a story',async t=>{
 const root=workspace(t),s=longStory(),issue={number:7,body:P.formatIssueBody(s),user:{login:'fixture'}};
 await I.processIssue(issue,{root});s.chapters.push({...s.chapters[0],title:'An extra chapter'});s.preset.totalChapters=25;
 await I.processIssue({...issue,body:P.formatIssueBody(s)},{root});assert.equal(JSON.parse(fs.readFileSync(path.join(root,'community-pool/index.json'))).stories[0].chapterCount,25);
 await assert.rejects(I.processIssue({...issue,number:8},{root}),/conflict/);
});
test('attachment downloader rejects private redirects and bounds streaming responses',async()=>{
 let calls=0;await assert.rejects(I.downloadAttachment('https://github.com/user-attachments/files/123/a.zip',async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});}),/host/);assert.equal(calls,1);
 await assert.rejects(T.fetchBytes('https://example.test',{limit:4,fetchImpl:async()=>new Response(new Uint8Array(5))}),/too-large/);
 assert.throws(()=>T.normalizeEntry({poolId:'../unsafe',content:{},chapterCount:1}));
});
test('offline refresh retains cached catalog and bundled full stories; oversize token submission fails before a request',async()=>{
 const s=longStory(),bytes=strToU8(JSON.stringify(s)),entry=T.catalogEntry(s,await T.hashBytes(bytes),bytes.length);
 const result=await P.fetchRemotePool({cached:[entry],fetchImpl:async()=>{throw Error('offline');}});assert.equal(result.online,false);assert.equal(result.syncedAt,null);assert(result.warning);assert(result.stories.find(s=>s.poolId===entry.poolId).content);assert(result.stories.some(s=>s.chapters?.length));
 const book=P.poolStoryToBook(s);let calls=0;await assert.rejects(P.publishToGitHub(book,{token:'synthetic-test-token',fetchImpl:async()=>{calls++;}}),/分享包投稿/);assert.equal(calls,0);
 const clean=P.sanitizeForPool({...book,apiKey:'private-test-marker',bookmarks:[{id:'private-mark',chapter:0,fraction:0}]});const zip=await T.createShareZip(clean.exportPayload);assert(!JSON.stringify(T.readShareZip(zip)).includes('private-test-marker'));assert(!JSON.stringify(T.readShareZip(zip)).includes('private-mark'));
});
