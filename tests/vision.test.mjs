import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {handle} from '../src/handler.js';
import {readWithAI} from '../src/vision.js';
const savedFetch=globalThis.fetch;
const env={SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url'),OPENAI_API_KEY:'mock-test-key'};
const form='<form method="post"><input name="appref1"><input name="captcha"><img src="captcha.php"></form>';
let aiCalls=0,answer={text:'abcdef',uncertain:false},status=200;
globalThis.fetch=async(url,opts)=>{
 if(url==='https://api.openai.com/v1/responses'){
  aiCalls++;const b=JSON.parse(opts.body);assert.equal(b.store,false);assert.equal(b.input[0].content[1].type,'input_image');assert.equal(b.text.format.strict,true);assert(!opts.body.includes('passportNo'));assert(!opts.body.includes('applicationId'));assert(!opts.body.includes('"token":'));
  if(status!==200)return new Response('provider-secret-detail',{status});
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(answer)}]}]});
 }
 if(url.endsWith('captcha.php'))return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});
 return new Response(form);
};
const call=(path,body,cookie='',settings=env)=>handle(new Request('https://demo.test'+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)}),settings);
let r=await call('/api/prepare',{source:'ivac'});const cookie=r.headers.get('set-cookie').split(';')[0],data=await r.json();
const body={source:'ivac',token:data.token,image:data.captcha};
r=await call('/api/read-captcha',body,cookie);assert.equal(r.status,200);let result=await r.json();assert.equal(result.text,'abcdef');assert(result.ready);
answer={text:'abcdef',uncertain:true};r=await call('/api/read-captcha',body,cookie);assert.equal((await r.json()).ready,false);
const before=aiCalls;
r=await call('/api/read-captcha',{...body,image:'data:image/png;base64,YWJj'},cookie);assert.equal(r.status,400);assert.equal(aiCalls,before);
r=await call('/api/read-captcha',body);assert.equal(r.status,422);assert.equal(aiCalls,before);
r=await call('/api/read-captcha',body,cookie,{SESSION_ENCRYPTION_KEY:env.SESSION_ENCRYPTION_KEY});assert.equal(r.status,503);assert.equal((await r.json()).code,'AI_NOT_CONFIGURED');
answer={text:'aB9dE2',uncertain:false};result=await readWithAI(data.captcha,'visa',env);assert.equal(result.text,'aB9dE2');assert(result.ready);
answer={text:'abc',uncertain:false};result=await readWithAI(data.captcha,'visa',env);assert.equal(result.text,'');assert.equal(result.ready,false);
status=401;await assert.rejects(()=>readWithAI(data.captcha,'ivac',env),e=>!e.message.includes('provider-secret-detail'));
globalThis.fetch=savedFetch;
console.log('PASS: AI request schema, uncertain result, case preservation, image/session binding, missing key and provider error handling (mocked).');
