import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import worker,{interpret,parseForm} from '../src/worker.js';

// Independent module instances model cold starts without changing network paths.
const {default:coldWorker}=await import('../src/worker.js?runtime-test=cold');
const realFetch=globalThis.fetch,realNow=Date.now,realWarn=console.warn;
const logs=[];console.warn=(...args)=>logs.push(args);
const env={SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url'),VERCEL:'1',VERCEL_REGION:'bom1'};
const form='<form method="post" action="StatusEnquiry"><input name="filerfno" id="application_id"><input name="passport_number"><input name="captcha"><input name="submit_btn" type="submit" value="Check Status"><input type="hidden" name="token" value="private-fixture-token"><img src="captcha"></form>';
const call=(target,path,body,settings=env)=>target.fetch(new Request('https://tracker.test'+path,{method:'POST',headers:{'Content-Type':'application/json','x-visadesk-session':'fixture-owner'},body:JSON.stringify(body)}),settings);
let mode='success',imageMode='same',postCalls=0;
try{
 // Commented error markup must not override an actual status, or become a form.
 assert.equal(interpret('<!-- <ul class="errorMessage"><li>Invalid Captcha</li></ul> --><div class="status">Granted and Printed</div>','visa').stage,'granted_printed');
 assert.equal(interpret('<!-- <div class="error">Please enter correct code</div> --><div class="status">Under Processing</div>','visa').stage,'processing');
 const fake=form.replace('name="filerfno"','name="fake_application_id"');
 assert.equal(parseForm('<!-- '+fake+' -->'+form,'https://indianvisaonline.gov.in/visa/StatusEnquiry','visa').app,'filerfno');
 assert.throws(()=>interpret('<ul class="errorMessage"><li>Invalid Captcha</li></ul>','visa'),e=>e.code==='CAPTCHA_INVALID'&&e.diagnostics.sourceReplyKind==='captcha-error-notice');

 globalThis.fetch=async(url,options)=>{
  if(options.method==='POST'){
   postCalls++;assert(options.headers.get('Cookie').includes('JSESSIONID=private-fixture-session'));
   const params=new URLSearchParams(options.body);assert.equal(params.get('captcha'),'AbC123');assert.equal(params.get('token'),'private-fixture-token');
   if(mode==='error')return new Response('<ul class="errorMessage"><li>Invalid Captcha</li></ul>');
   if(mode==='text')return new Response('<p>Invalid Captcha</p>');
   if(mode==='rotated')return new Response('<div class="error">Invalid Captcha</div>',{headers:{'Set-Cookie':'JSESSIONID=private-reset-session; Path=/visa'}});
   return new Response('<div class="status">Granted and Printed</div>');
  }
  const path=new URL(url).pathname;
  if(path==='/visa/captcha'){
   const headers={'Content-Type':'image/png'};
   if(imageMode==='route')headers['Set-Cookie']='route=private-new-route; Path=/';
   if(imageMode==='expires')headers['Set-Cookie']='challengeRef=private-short-cookie; Path=/visa; Max-Age=2';
   return new Response(new Uint8Array([137,80,78,71]),{headers});
  }
  return new Response(form,{headers:{'Set-Cookie':path.endsWith('/index.html')?'route=private-route; Path=/':'JSESSIONID=private-fixture-session; Path=/visa'}});
 };
 async function prepare(){const r=await call(worker,'/api/prepare',{source:'visa'});assert.equal(r.status,200);return r.json();}
 function payload(session){return {source:'visa',applicationId:'BGDTESTING001',passportNo:'Z12345678',captcha:'AbC123',token:session.token};}
 function privateFieldsAbsent(data){
  const json=JSON.stringify(data);
  for(const secret of ['private-fixture-token','private-fixture-session','private-reset-session','private-route','private-new-route','private-short-cookie','Z12345678','BGDTESTING001','AbC123'])assert(!json.includes(secret));
  for(const name of ['preparedInstance','imageCookies','token','jar','sourceMessage','pageTitle','requestId'])assert(!Object.hasOwn(data,name));
 }
 let session=await prepare();
 let response=await call(worker,'/api/check-status',payload(session));let data=await response.json();
 assert.equal(response.status,200);assert.equal(data.diagnostics.runtimeContinuity,'same-instance');assert.equal(data.diagnostics.formImageCookieState,'unchanged');assert.equal(data.diagnostics.imageSubmitCookieState,'unchanged');assert.equal(data.diagnostics.submitResponseCookieState,'unchanged');assert.equal(data.diagnostics.prepareRegion,'bom1');assert.equal(data.diagnostics.checkRegion,'bom1');assert.equal(data.diagnostics.captchaLength,6);privateFieldsAbsent(data);

 // The stateless encrypted session remains usable after a cold start.
 response=await call(coldWorker,'/api/check-status',payload(session));data=await response.json();assert.equal(response.status,200);assert.equal(data.result.stage,'granted_printed');assert.equal(data.diagnostics.runtimeContinuity,'different-instance');privateFieldsAbsent(data);
 mode='error';let before=postCalls;response=await call(coldWorker,'/api/check-status',payload(session),{...env,VERCEL_REGION:'iad1'});data=await response.json();assert.equal(response.status,422);assert.equal(data.code,'CAPTCHA_INVALID');assert.equal(data.runtimeContinuity,'different-instance');assert.equal(data.prepareRegion,'bom1');assert.equal(data.checkRegion,'iad1');assert.equal(data.sourceReplyKind,'captcha-error-notice');assert.equal(data.sessionCookieState,'unchanged');assert.equal(postCalls,before+1);privateFieldsAbsent(data);
 mode='text';response=await call(worker,'/api/check-status',payload(session));assert.equal((await response.json()).sourceReplyKind,'captcha-page-text');
 mode='rotated';response=await call(worker,'/api/check-status',payload(session));data=await response.json();assert.equal(data.sessionCookieState,'changed');assert.equal(data.submitResponseCookieState,'changed');privateFieldsAbsent(data);

 // Changes during image preparation were invisible in the old POST-only check.
 mode='success';imageMode='route';session=await prepare();response=await call(worker,'/api/check-status',payload(session));data=await response.json();assert.equal(response.status,200);assert.equal(data.diagnostics.formImageCookieState,'changed');assert.equal(data.diagnostics.sessionCookieState,'unchanged');privateFieldsAbsent(data);
 let clock=realNow();Date.now=()=>clock;imageMode='expires';session=await prepare();clock+=3000;response=await call(worker,'/api/check-status',payload(session));data=await response.json();assert.equal(response.status,200);assert.equal(data.diagnostics.imageSubmitCookieState,'changed');assert.equal(data.diagnostics.sessionCookieState,'unchanged');assert.equal(data.diagnostics.captchaAgeSeconds,3);Date.now=realNow;

 // A v1.1.6 token lacks provenance fields; they must remain explicitly unknown.
 const key=await crypto.subtle.importKey('raw',Buffer.from(env.SESSION_ENCRYPTION_KEY,'base64url'),'AES-GCM',false,['encrypt','decrypt']);
 const [iv,cipher]=session.token.split('.');const old=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(iv,'base64url')},key,Buffer.from(cipher,'base64url'))));
 for(const name of ['imageCookies','formImageCookieState','preparedInstance','preparedRegion'])delete old[name];
 const nextIv=randomBytes(12);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:nextIv},key,new TextEncoder().encode(JSON.stringify(old)));
 session.token=nextIv.toString('base64url')+'.'+Buffer.from(encrypted).toString('base64url');
 response=await call(worker,'/api/check-status',payload(session));data=await response.json();assert.equal(response.status,200);assert.equal(data.diagnostics.runtimeContinuity,'unknown');assert.equal(data.diagnostics.formImageCookieState,'unknown');assert.equal(data.diagnostics.imageSubmitCookieState,'unknown');privateFieldsAbsent(data);
 assert.equal(logs.length,0);
}finally{globalThis.fetch=realFetch;Date.now=realNow;console.warn=realWarn;}
console.log('PASS: commented source markup, cold-start session portability, successful/failed private diagnostics, cookie phase changes, elapsed age, regions, no automatic POST retry, and legacy token provenance.');
