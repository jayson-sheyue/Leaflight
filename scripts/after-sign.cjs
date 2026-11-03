const path=require('node:path');
const {verifyMacBundle}=require('./verify-mac-bundle.cjs');
module.exports=async context=>{
 if(context.electronPlatformName!=='darwin')return;
 const app=path.join(context.appOutDir,context.packager.appInfo.productFilename+'.app');
 console.log('Verified signed macOS bundle:',verifyMacBundle(app,context.packager.appInfo.version));
};
