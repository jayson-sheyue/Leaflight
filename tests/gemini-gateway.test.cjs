const {test}=require('node:test'),assert=require('node:assert/strict');
const gateway=require('../electron/gemini-gateway.cjs');
const {generate}=require('../electron/gemini.cjs');
const schema={type:'OBJECT',properties:{hello:{type:'STRING'}},required:['hello']};
for(const provider of ['gemini','vertex-express'])for(const apiKey of ['AIzaSyntheticKey1234567890','AQ.synthetic.auth.key-1234567890']){
 test(`${provider} accepts either key format without guessing its issuing service (${apiKey.slice(0,3)})`,async()=>{
  let calls=0;const out=await generate({apiKey:` ${apiKey} `,provider,model:'models/gemini-test',schema,prompt:'synthetic',fetchImpl:async(url,options)=>{
   calls++;assert.equal(url,provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent':'https://aiplatform.googleapis.com/v1beta1/publishers/google/models/gemini-test:generateContent');
   assert.equal(new URL(url).search,'');assert.equal(options.headers['x-goog-api-key'],apiKey);assert.equal(options.redirect,'error');
   const body=JSON.parse(options.body);assert.equal(body.contents[0].role,'user');assert.deepEqual(body.generationConfig.responseSchema,schema);assert.equal(body.generationConfig.responseMimeType,'application/json');
   return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"hello":"world"}'}]}}]})};
  }});assert.equal(calls,1);assert.equal(out.value.hello,'world');
 });
}
test('legacy settings default to AI Studio and invalid configuration is rejected before sending credentials',()=>{
 assert(gateway.request('AQ.synthetic','test').url.startsWith('https://generativelanguage.googleapis.com/'));
 for(const source of ['https://attacker.invalid','auto',''])assert.throws(()=>gateway.request('test','test',source));
 for(const id of ['../other','x?key=secret','models/models/test','https://other'])assert.throws(()=>gateway.request('test',id));
 for(const secret of ['','test key','test\nkey','x'.repeat(4097)])assert.throws(()=>gateway.request(secret,'test'));
 assert.equal(gateway.key('AQ.'+'x'.repeat(500)).length,503);
});
test('an upstream rejection or transport exception never retries another gateway or reveals a key',async()=>{
 const key='AQ.synthetic-private-test';for(const status of [400,401,403,404,429]){let calls=0;await assert.rejects(()=>generate({apiKey:key,provider:'vertex-express',model:'test',prompt:'x',schema,fetchImpl:async()=>{calls++;return {ok:false,status};}}),e=>!e.message.includes(key));assert.equal(calls,1);}
 let calls=0;await assert.rejects(()=>generate({apiKey:key,model:'test',prompt:'x',schema,fetchImpl:async()=>{calls++;throw Error('url?key='+key);}}),e=>!e.message.includes(key));assert.equal(calls,1);
});
