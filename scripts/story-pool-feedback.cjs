// Feedback is posted only after the repository commit/push has succeeded.
const fs=require('node:fs');
(async()=>{
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 if(!event.issue)return;
 const file=process.env.POOL_RESULT;const result=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{ok:false};
 const ok=result.ok&&process.env.INDEX_JOB_STATUS==='success',marker='<!-- leaflight-pool-index-result:v1 -->';
 const message=ok?`已收录 · Indexed\n\n作品已加入共享书池（${result.chapters} 章）。在 Mac 或 Android 点击「共享书池 → 从 GitHub 同步 / 刷新」即可找到，加入书架后可离线阅读。`:
 `暂未收录 · Not indexed\n\n${result.ok?'作品校验已通过，但归档提交暂时失败。请稍后编辑并保存这条投稿以重试。':result.message||'收录服务暂时失败。请稍后编辑并保存这条投稿以重试。'}\n\nPlease edit and save this issue after replacing the package, or retry later. Your local story is unchanged.`;
 const repo=process.env.GITHUB_REPOSITORY,headers={Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
 const base=`https://api.github.com/repos/${repo}`,comments=await fetch(`${base}/issues/${event.issue.number}/comments?per_page=100`,{headers,signal:AbortSignal.timeout(15000)});if(!comments.ok)throw Error('feedback-read-failed');
 const previous=(await comments.json()).find(c=>c.user?.type==='Bot'&&c.body?.includes(marker));
 const r=await fetch(previous?`${base}/issues/comments/${previous.id}`:`${base}/issues/${event.issue.number}/comments`,{method:previous?'PATCH':'POST',headers,body:JSON.stringify({body:marker+'\n'+message}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('feedback-write-failed');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
