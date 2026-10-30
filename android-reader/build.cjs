// Dependency-free Android shell: use the official SDK tools already installed by the developer.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=__dirname,build=path.join(dir,'build'),v=require('./version.json');
const sdk=process.env.ANDROID_SDK_ROOT||process.env.ANDROID_HOME||path.join(os.homedir(),'Library/Android/sdk');
const java=process.env.JAVA_HOME;
if(!java||!fs.existsSync(path.join(java,'bin/javac')))throw Error('Set JAVA_HOME to a JDK 21 installation. See android-reader/README.md.');
const tools=path.join(sdk,'build-tools',process.env.ANDROID_BUILD_TOOLS||'36.1.0'),android=path.join(sdk,'platforms/android-36/android.jar');
for(const f of [android,path.join(tools,'aapt2'),path.join(tools,'d8'),path.join(tools,'zipalign'),path.join(tools,'apksigner')])if(!fs.existsSync(f))throw Error('Missing Android SDK component: '+f);
const env={...process.env,JAVA_HOME:java,PATH:path.join(java,'bin')+path.delimiter+process.env.PATH};
function run(command,args,cwd=root){const r=cp.spawnSync(command,args,{cwd,env,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error(command+' exited '+r.status);}
run(path.join(root,'node_modules/.bin/tsc'),['--noEmit','-p','android-reader/tsconfig.json']);
run(path.join(root,'node_modules/.bin/vite'),['build','--config','android-reader/vite.config.ts']);
for(const name of ['assets','classes','dex']){fs.rmSync(path.join(build,name),{recursive:true,force:true});fs.mkdirSync(path.join(build,name),{recursive:true});}
fs.cpSync(path.join(build,'web'),path.join(build,'assets/web'),{recursive:true});
const release=process.env.READER_KEYSTORE&&process.env.READER_KEY_ALIAS&&process.env.READER_STORE_PASSWORD&&process.env.READER_KEY_PASSWORD;
fs.writeFileSync(path.join(build,'AndroidManifest.xml'),fs.readFileSync(path.join(dir,'native/AndroidManifest.xml'),'utf8').replace('@VERSION_CODE@',v.versionCode).replace('@VERSION_NAME@',v.version).replace('@DEBUGGABLE@',release?'false':'true'));
run(path.join(tools,'aapt2'),['compile','--dir',path.join(dir,'native/res'),'-o',path.join(build,'resources.zip')]);
run(path.join(tools,'aapt2'),['link','-I',android,'--manifest',path.join(build,'AndroidManifest.xml'),'-A',path.join(build,'assets'),'-o',path.join(build,'base.apk'),path.join(build,'resources.zip')]);
run(path.join(java,'bin/javac'),['--release','8','-cp',android,'-d',path.join(build,'classes'),path.join(dir,'native/MainActivity.java')]);
run(path.join(java,'bin/jar'),['cf',path.join(build,'classes.jar'),'-C',path.join(build,'classes'),'.']);
run(path.join(tools,'d8'),['--lib',android,'--min-api',String(v.minSdk),'--output',path.join(build,'dex'),path.join(build,'classes.jar')]);
run('/usr/bin/zip',['-q','-j',path.join(build,'base.apk'),path.join(build,'dex/classes.dex')]);
run(path.join(tools,'zipalign'),['-f','-p','4',path.join(build,'base.apk'),path.join(build,'aligned.apk')]);
const local=path.join(dir,'.local');fs.mkdirSync(local,{recursive:true});
const key=release?path.resolve(process.env.READER_KEYSTORE):path.join(local,'reader-preview.keystore');
if(!release&&!fs.existsSync(key))run(path.join(java,'bin/keytool'),['-genkeypair','-keystore',key,'-alias','reader-preview','-keyalg','RSA','-keysize','3072','-validity','3650','-storepass','android','-keypass','android','-dname','CN=Leaflight Reader Preview']);
const filename='Leaflight-Reader-'+v.version+(release?'':'-debug')+'.apk',output=path.join(build,filename),temporary=output+'.tmp';
run(path.join(tools,'apksigner'),['sign','--ks',key,'--ks-key-alias',release?process.env.READER_KEY_ALIAS:'reader-preview','--ks-pass',release?'env:READER_STORE_PASSWORD':'pass:android','--key-pass',release?'env:READER_KEY_PASSWORD':'pass:android','--out',temporary,path.join(build,'aligned.apk')]);
run(path.join(tools,'apksigner'),['verify','--verbose',temporary]);fs.renameSync(temporary,output);
const hash=crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');fs.writeFileSync(output+'.sha256',hash+'  '+filename+'\n');
console.log(JSON.stringify({apk:output,version:v.version,applicationId:v.applicationId,minSdk:v.minSdk,targetSdk:v.targetSdk,signing:release?'developer':'local debug preview',sha256:hash},null,2));
