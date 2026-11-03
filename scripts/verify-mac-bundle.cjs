const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function command(file,args){const r=spawnSync(file,args,{encoding:'utf8'});if(r.error)throw r.error;if(r.status!==0)throw Error(`${path.basename(file)} failed: ${(r.stderr||r.stdout).trim()}`);return (r.stdout+r.stderr).trim();}
function verifyMacBundle(bundle,version){
 if(process.platform!=='darwin')throw Error('macOS bundle verification requires macOS.');
 bundle=path.resolve(bundle);const plist=path.join(bundle,'Contents/Info.plist');
 if(!fs.statSync(bundle).isDirectory())throw Error('Expected an application bundle.');
 const identifier=command('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIdentifier',plist]);
 const actualVersion=command('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',plist]);
 if(identifier!=='local.novelreading.app')throw Error('Unexpected bundle identifier: '+identifier);
 if(version&&actualVersion!==version)throw Error(`Bundle version ${actualVersion} does not match ${version}.`);
 command('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',bundle]);
 const signature=command('/usr/bin/codesign',['--display','--verbose=4',bundle]);
 if(!fs.existsSync(path.join(bundle,'Contents/_CodeSignature/CodeResources'))||/Sealed Resources=none|Info.plist=not bound/.test(signature))throw Error('The app must seal its resources and Info.plist before packaging.');
 return {identifier,version:actualVersion,signature:signature.includes('Signature=adhoc')?'ad-hoc':'certificate',resourcesSealed:true};
}
if(require.main===module){try{console.log(JSON.stringify(verifyMacBundle(process.argv[2],process.argv[3]),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={verifyMacBundle};
