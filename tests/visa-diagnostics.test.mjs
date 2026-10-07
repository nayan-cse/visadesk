import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import worker from '../src/worker.js';
const {default:coldWorker}=await import('../src/worker.js?visa-diagnostics=cold');
const env={SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url')};
const form='<form action="StatusEnquiry" method="post"><input name="filerfno" id="application_id"><input name="passport_number"><input name="captcha"><input name="submit_btn" type="submit" value="Check Status"><input type="hidden" name="token" value="private-form-token"><img src="captcha"></form>';
const success='<p class="error_para text_center">Your visa is <B>Processed and Printed</B>.<BR>If not collected earlier,Please contact the respective office on next working day where you have submitted your Application.</p><form action="StatusEnquiry" method="POST"><input name="submit_btn" type="submit" value="Back"><input name="submit_btn" type="submit" value="Home"><input type="hidden" name="token" value="private-result-token"></form>';
const error='<ul class="errorMessage"><li>Invalid Captcha</li></ul>'+form;
const names=['JSESSIONID','BNES_JSESSIONID','IVFRT_Cookie','BNES_IVFRT_Cookie'];
const values={JSESSIONID:'private-session-1',BNES_JSESSIONID:'private-signature-1',IVFRT_Cookie:'private-route-1',BNES_IVFRT_Cookie:'private-route-signature-1'};
const header=(name,value=values[name],extra='')=>`${name}=${value}; Path=${name.includes('JSESSIONID')?'/visa':'/'}; Secure; HttpOnly; SameSite=Strict${extra}`;
const headersFor=(list,other={})=>{const h=new Headers(other);for(const value of list)h.append('Set-Cookie',value);return h;};
const call=(target,path,body)=>target.fetch(new Request('http://tracker.test'+path,{method:'POST',headers:{'x-visadesk-session':'private-browser-owner','Content-Type':'application/json'},body:JSON.stringify(body)}),env);
const payload=session=>({source:'visa',applicationId:'BGDTESTING001',passportNo:'Z12345678',captcha:'AbC123',token:session.token});
const realFetch=globalThis.fetch,realNow=Date.now,realWarn=console.warn;
let imageMode='same',replyMode='success',omitRootSignature=false,postCalls=0,requestCalls=0;
const logs=[];console.warn=(...args)=>logs.push(args);
try{
 globalThis.fetch=async(url,options)=>{
  requestCalls++;
  const path=new URL(url).pathname;
  if(options.method==='POST'){
   postCalls++;
   const sent=options.headers.get('Cookie');
   assert(sent.includes('JSESSIONID='+values.JSESSIONID));
   assert(sent.includes('IVFRT_Cookie='+values.IVFRT_Cookie));
   assert(sent.includes('BNES_JSESSIONID='+(imageMode==='signed'?'private-signature-2':values.BNES_JSESSIONID))||imageMode==='expires');
   assert.equal(new URLSearchParams(options.body).get('token'),'private-form-token');
   assert.equal(new URLSearchParams(options.body).get('captcha'),'AbC123');
   if(replyMode==='reset')return new Response(error,{headers:headersFor([header('JSESSIONID','private-session-reset'),header('BNES_JSESSIONID','private-signature-reset')])});
   if(replyMode==='remove')return new Response(error,{headers:headersFor([header('IVFRT_Cookie','', '; Max-Age=0'),header('BNES_IVFRT_Cookie','', '; Max-Age=0')])});
   if(replyMode==='add')return new Response(success,{headers:headersFor([header('BNES_IVFRT_Cookie')])});
   if(replyMode==='mixed')return new Response(error+success);
   if(replyMode==='redirect')return new Response(null,{status:302,headers:headersFor([header('JSESSIONID','private-session-reset')],{Location:'StatusResult'})});
   return new Response(replyMode==='error'?error:'<!-- '+error+' -->'+success);
  }
  if(path.endsWith('/StatusResult'))return new Response(error);
  if(path.endsWith('/index.html'))return new Response('Visa home',{headers:headersFor([header('IVFRT_Cookie'),...(!omitRootSignature?[header('BNES_IVFRT_Cookie')]:[])])});
  if(path.endsWith('/captcha')){
   const list=imageMode==='signed'?[header('BNES_JSESSIONID','private-signature-2')]:imageMode==='expires'?[header('BNES_JSESSIONID',values.BNES_JSESSIONID,'; Max-Age=2')]:[];
   return new Response(new Uint8Array([137,80,78,71]),{headers:headersFor(list,{'Content-Type':'image/png'})});
  }
  return new Response(form,{headers:headersFor([header('JSESSIONID'),header('BNES_JSESSIONID')])});
 };
 async function prepare(){const r=await call(worker,'/api/prepare',{source:'visa'});assert.equal(r.status,200);return r.json();}
 function privateFieldsAbsent(data,session){
  const json=JSON.stringify(data);
  for(const secret of [...Object.values(values),'private-signature-2','private-session-reset','private-signature-reset','private-form-token','private-result-token','private-browser-owner','BGDTESTING001','Z12345678','AbC123',session.token])assert(!json.includes(secret));
  assert(!json.includes('<form'));assert(!json.includes('visaCookies'));assert(!json.includes('preparedInstance'));assert(!json.includes('imageCookies'));
  for(const phase of Object.values((data.diagnostics||data).visaCookieChanges))assert.deepEqual(Object.keys(phase).sort(),[...names].sort());
 }
 const equalStates=state=>Object.fromEntries(names.map(name=>[name,state]));
 let session=await prepare(),beforePosts=postCalls,beforeCalls=requestCalls;
 let r=await call(coldWorker,'/api/check-status',payload(session)),data=await r.json();
 assert.equal(r.status,200);assert.equal(data.result.stage,'granted_printed');assert.equal(data.diagnostics.runtimeContinuity,'different-instance');assert.equal(data.diagnostics.sourceHttpStatus,200);assert.equal(data.diagnostics.sourceRedirectCount,0);
 assert.deepEqual(data.diagnostics.sourceReplySignals,{captchaErrorPresent:false,visaStatusPhrasePresent:true,enquiryFormPresent:false});
 for(const phase of Object.values(data.diagnostics.visaCookieChanges))assert.deepEqual(phase,equalStates('unchanged'));
 assert.equal(postCalls,beforePosts+1);assert.equal(requestCalls,beforeCalls+1);privateFieldsAbsent(data,session);

 replyMode='reset';session=await prepare();beforePosts=postCalls;r=await call(coldWorker,'/api/check-status',payload(session));data=await r.json();
 assert.equal(r.status,422);assert.equal(data.code,'CAPTCHA_INVALID');assert.equal(data.sourceHttpStatus,200);assert.equal(data.sessionCookieState,'changed');assert.equal(data.visaCookieChanges.submitToResponse.JSESSIONID,'changed');assert.equal(data.visaCookieChanges.submitToResponse.BNES_JSESSIONID,'changed');assert.equal(data.visaCookieChanges.submitToResponse.IVFRT_Cookie,'unchanged');assert.equal(data.visaCookieChanges.submitToResponse.BNES_IVFRT_Cookie,'unchanged');
 assert.deepEqual(data.sourceReplySignals,{captchaErrorPresent:true,visaStatusPhrasePresent:false,enquiryFormPresent:true});assert.equal(postCalls,beforePosts+1);privateFieldsAbsent(data,session);

 replyMode='remove';session=await prepare();r=await call(worker,'/api/check-status',payload(session));data=await r.json();
 assert.equal(data.visaCookieChanges.submitToResponse.IVFRT_Cookie,'removed');assert.equal(data.visaCookieChanges.submitToResponse.BNES_IVFRT_Cookie,'removed');assert.equal(data.sessionCookieState,'unchanged');privateFieldsAbsent(data,session);

 replyMode='add';omitRootSignature=true;session=await prepare();r=await call(worker,'/api/check-status',payload(session));data=await r.json();
 assert.equal(r.status,200);assert.equal(data.diagnostics.visaCookieChanges.formToImage.BNES_IVFRT_Cookie,'absent');assert.equal(data.diagnostics.visaCookieChanges.imageToSubmit.BNES_IVFRT_Cookie,'absent');assert.equal(data.diagnostics.visaCookieChanges.submitToResponse.BNES_IVFRT_Cookie,'added');privateFieldsAbsent(data,session);omitRootSignature=false;

 replyMode='success';imageMode='signed';session=await prepare();r=await call(worker,'/api/check-status',payload(session));data=await r.json();
 assert.equal(r.status,200);assert.equal(data.diagnostics.visaCookieChanges.formToImage.BNES_JSESSIONID,'changed');assert.equal(data.diagnostics.visaCookieChanges.formToImage.JSESSIONID,'unchanged');assert.equal(data.diagnostics.visaCookieChanges.imageToSubmit.BNES_JSESSIONID,'unchanged');privateFieldsAbsent(data,session);

 imageMode='expires';let clock=realNow();Date.now=()=>clock;session=await prepare();clock+=3000;r=await call(worker,'/api/check-status',payload(session));data=await r.json();
 assert.equal(r.status,200);assert.equal(data.diagnostics.visaCookieChanges.imageToSubmit.BNES_JSESSIONID,'removed');assert.equal(data.diagnostics.visaCookieChanges.imageToSubmit.JSESSIONID,'unchanged');privateFieldsAbsent(data,session);Date.now=realNow;imageMode='same';

 replyMode='mixed';session=await prepare();r=await call(worker,'/api/check-status',payload(session));data=await r.json();
 assert.equal(r.status,422);assert.equal(data.sourceReplySignals.captchaErrorPresent,true);assert.equal(data.sourceReplySignals.visaStatusPhrasePresent,true);privateFieldsAbsent(data,session);

 replyMode='redirect';session=await prepare();beforePosts=postCalls;beforeCalls=requestCalls;r=await call(worker,'/api/check-status',payload(session));data=await r.json();
 assert.equal(r.status,422);assert.equal(data.sourceHttpStatus,200);assert.equal(data.sourceRedirectCount,1);assert.equal(data.visaCookieChanges.submitToResponse.JSESSIONID,'changed');assert.equal(postCalls,beforePosts+1);assert.equal(requestCalls,beforeCalls+2);privateFieldsAbsent(data,session);

 // Old tokens remain usable. Missing historical snapshots are unknown; the
 // current submit/response phase can still be compared without guessing.
 replyMode='success';session=await prepare();
 const key=await crypto.subtle.importKey('raw',Buffer.from(env.SESSION_ENCRYPTION_KEY,'base64url'),'AES-GCM',false,['encrypt','decrypt']);
 const [iv,cipher]=session.token.split('.');const old=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(iv,'base64url')},key,Buffer.from(cipher,'base64url'))));
 delete old.visaCookies;delete old.visaBootstrap;
 const nextIv=randomBytes(12),encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:nextIv},key,new TextEncoder().encode(JSON.stringify(old)));
 session.token=nextIv.toString('base64url')+'.'+Buffer.from(encrypted).toString('base64url');
 r=await call(coldWorker,'/api/check-status',payload(session));data=await r.json();assert.equal(r.status,200);
 assert.deepEqual(data.diagnostics.visaCookieChanges.formToImage,equalStates('unknown'));assert.deepEqual(data.diagnostics.visaCookieChanges.imageToSubmit,equalStates('unknown'));assert.deepEqual(data.diagnostics.visaCookieChanges.submitToResponse,equalStates('unchanged'));assert.deepEqual(data.diagnostics.visaBootstrap,{attempts:null,initialRootCookiePair:'unknown',finalRootCookiePair:'unknown'});privateFieldsAbsent(data,session);
 assert.equal(logs.length,0);
}finally{globalThis.fetch=realFetch;Date.now=realNow;console.warn=realWarn;}
console.log('PASS: four-cookie phase changes, additions/deletions/expiry, source response markers/status/redirects, real-form fixture parsing, cold-start and legacy compatibility, private output, and one POST without extra source requests (mocked).');
