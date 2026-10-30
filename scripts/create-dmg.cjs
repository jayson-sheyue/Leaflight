const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {spawnSync}=require('node:child_process');

function run(command,args){
 const result=spawnSync(command,args,{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(`${path.basename(command)} exited with ${result.status}`);
}

if(process.platform!=='darwin')throw Error('DMG packaging requires macOS.');
const root=path.resolve(__dirname,'..');
const {version}=require(path.join(root,'package.json'));
const arch=process.arch;
const outputDir=process.env.LEAFLIGHT_OUTPUT_DIR?path.resolve(root,process.env.LEAFLIGHT_OUTPUT_DIR):path.join(root,'release');
const bundle=path.join(outputDir,arch==='arm64'?'mac-arm64':'mac','Leaflight.app');
const plist=spawnSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',path.join(bundle,'Contents/Info.plist')],{encoding:'utf8'});
if(plist.status!==0||plist.stdout.trim()!==version)throw Error('Build the current application with npm run package:mac first.');
const output=path.join(outputDir,`Leaflight-${version}-${arch}.dmg`);
const temporary=path.join(outputDir,`.Leaflight-${randomUUID()}.dmg`);
const staging=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-dmg-'));
try{
 run('/usr/bin/ditto',[bundle,path.join(staging,'Leaflight.app')]);
 fs.symlinkSync('/Applications',path.join(staging,'Applications'));
 run('/usr/bin/hdiutil',['create','-volname','Leaflight','-srcfolder',staging,'-format','UDZO','-o',temporary]);
 run('/usr/bin/hdiutil',['verify',temporary]);
 fs.renameSync(temporary,output);
 console.log(`Created ${output}`);
}finally{
 fs.rmSync(staging,{recursive:true,force:true});
 fs.rmSync(temporary,{force:true});
}
