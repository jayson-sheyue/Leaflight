// This script runs only in the disposable Actions checkout. Rebuild the shared index
// on the latest branch so concurrent submissions never discard one another.
const fs=require('node:fs'),cp=require('node:child_process');
const {rebuildIndex}=require('./story-pool-index.cjs');
const result=JSON.parse(fs.readFileSync(process.env.POOL_RESULT,'utf8'));
if(!result.ok||!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(result.poolId))throw Error('No validated story');
if(!process.env.GITHUB_ACTIONS)throw Error('Disposable GitHub Actions checkout required');
const file=`community-pool/stories/${result.poolId}.json`,bytes=fs.readFileSync(file),incoming=JSON.parse(bytes);
function git(args,optional=false){const r=cp.spawnSync('git',args,{stdio:'inherit'});if(r.status!==0&&!optional)throw Error('Archive git operation failed');return r.status;}
git(['config','user.name','github-actions[bot]']);git(['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
for(let attempt=0;attempt<3;attempt++){
 git(['fetch','origin','main']);git(['reset','--hard','origin/main']);
 if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file,'utf8')).sourceUrl!==incoming.sourceUrl)throw Error('Story ID conflict');
 fs.writeFileSync(file,bytes);rebuildIndex();git(['add','community-pool/']);
 if(git(['diff','--cached','--quiet'],true)===0)process.exit(0);
 git(['commit','-m','chore(pool): index shared story']);
 if(git(['push','origin','HEAD:main'],true)===0)process.exit(0);
}
throw Error('Archive push failed after 3 attempts');
