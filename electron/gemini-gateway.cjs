// Key prefixes do not identify the Google API a key is authorized to call.
const PROVIDERS=['gemini','vertex-express'];
function provider(value='gemini'){
 if(!PROVIDERS.includes(value))throw Error('请选择有效的 Gemini 服务来源。');return value;
}
function key(value){
 const clean=typeof value==='string'?value.trim():'';
 if(!clean)throw Error('请先在设置中填写 Gemini API Key。');
 if(clean.length>4096||!/^[A-Za-z0-9._-]+$/.test(clean))throw Error('API Key 格式无效，请重新粘贴完整密钥。');return clean;
}
function model(value){
 const clean=typeof value==='string'?value.trim().replace(/^models\//,''):'';
 if(!/^[a-zA-Z0-9._-]{1,100}$/.test(clean))throw Error('模型名称无效，请填写 Gemini 模型 ID。');return clean;
}
function request(apiKey,modelId,source='gemini'){
 const backend=provider(source),cleanKey=key(apiKey),id=model(modelId);
 const base=backend==='vertex-express'?'https://aiplatform.googleapis.com/v1beta1/publishers/google/models/':'https://generativelanguage.googleapis.com/v1beta/models/';
 return {url:`${base}${id}:generateContent`,headers:{'Content-Type':'application/json','x-goog-api-key':cleanKey}};
}
module.exports={provider,key,model,request};
