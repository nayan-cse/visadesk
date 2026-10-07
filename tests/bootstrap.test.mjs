import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import currentWorker from '../src/worker.js';
const worker=process.env.REPRO_WORKER_PATH?(await import(pathToFileURL(process.env.REPRO_WORKER_PATH).href)).default:currentWorker;
const env={SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url')};
const realFetch=globalThis.fetch,realWarn=console.warn,logs=[];
console.warn=(...args)=>logs.push(args);
let mode='recover',landingCalls=0,formCalls=0,imageCalls=0,postCalls=0,requests=[];
function reset(next){mode=next;landingCalls=0;formCalls=0;imageCalls=0;postCalls=0;requests=[];}
const cookieHeaders=(values,other={})=>{const h=new Headers(other);for(const value of values)h.append('Set-Cookie',value);return h;};
const roots=['IVFRT_Cookie=private-route; Path=/; Secure; HttpOnly','BNES_IVFRT_Cookie=private-route-signature; Path=/; Secure; HttpOnly'];
const form=()=>`<form method="post" action="StatusEnquiry"><input name="filerfno" id="application_id"><input name="passport_number"><input name="captcha"><input name="submit_btn" type="submit" value="Check Status"><input type="hidden" name="token" value="private-csrf-${formCalls}"><img src="captcha"></form>`;
const call=(path,body)=>worker.fetch(new Request('https://tracker.test'+path,{method:'POST',headers:{'x-visadesk-session':'private-owner','Content-Type':'application/json'},body:JSON.stringify(body)}),env);
const payload=session=>({source:'visa',applicationId:'BGDTESTING001',passportNo:'Z12345678',captcha:'AbC123',token:session.token});
function privateOutput(data,session){const text=JSON.stringify(data);for(const secret of ['private-route','private-route-signature','private-session-1','private-session-2','private-csrf-1','private-csrf-2','private-owner','AbC123','BGDTESTING001','Z12345678',session?.token].filter(Boolean))assert(!text.includes(secret));}
try{
 globalThis.fetch=async(url,options)=>{
  const path=new URL(url).pathname,sent=options.headers.get('Cookie')||'';
  requests.push({path,method:options.method||'GET'});
  if(options.method==='POST'){
   postCalls++;
   const fields=new URLSearchParams(options.body);
   assert.equal(fields.get('captcha'),'AbC123');assert.equal(fields.get('submit_btn'),'Check Status');
   assert.equal(fields.get('token'),'private-csrf-'+formCalls);
   assert(sent.includes('JSESSIONID=private-session-'+formCalls));
   const hasRoots=sent.includes('IVFRT_Cookie=private-route')&&sent.includes('BNES_IVFRT_Cookie=private-route-signature');
   return new Response(hasRoots||['optional','partial'].includes(mode)?'<p>Your visa is Processed and Printed.</p>':'<ul class="errorMessage"><li>Invalid Captcha</li></ul>'+form());
  }
  if(path.endsWith('/index.html')){
   landingCalls++;
   // Recovery must discard the first source jar before creating the next form.
   assert.equal(sent,'');
   if(mode==='denied'&&landingCalls===2)return new Response('denied',{status:403});
   const list=mode==='healthy'||mode==='recover'&&landingCalls===2?roots:mode==='partial'?[roots[0]]:[];
   return new Response('Visa home',{headers:cookieHeaders(list)});
  }
  if(path.endsWith('/captcha')){
   imageCalls++;
   assert(sent.includes('JSESSIONID=private-session-'+formCalls));
   // Only the final form/cookies may generate the CAPTCHA the user reviews.
   return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});
  }
  formCalls++;
  return new Response(form(),{headers:cookieHeaders([`JSESSIONID=private-session-${formCalls}; Path=/visa; Secure`, `BNES_JSESSIONID=private-signature-${formCalls}; Path=/visa; Secure`,...(mode==='form-root'?roots:[])])});
 };
 async function prepare(){const r=await call('/api/prepare',{source:'visa'});assert.equal(r.status,200);return r.json();}

 // With the previous worker, the first image was prepared from the incomplete
 // bootstrap. This fixture returns CAPTCHA_INVALID although the text matches.
 reset('recover');const session=await prepare();
 let r=await call('/api/check-status',payload(session)),data=await r.json();
 assert.equal(r.status,200,'Missing root-cookie bootstrap should recover before user confirmation.');
 assert.equal(data.result.stage,'granted_printed');assert.equal(landingCalls,2);assert.equal(formCalls,2);assert.equal(imageCalls,1);assert.equal(postCalls,1);
 assert.deepEqual(data.diagnostics.visaBootstrap,{attempts:2,initialRootCookiePair:'absent',finalRootCookiePair:'present'});privateOutput(data,session);

 reset('healthy');let next=await prepare();r=await call('/api/check-status',payload(next));data=await r.json();assert.equal(r.status,200);assert.equal(landingCalls,1);assert.equal(formCalls,1);assert.equal(imageCalls,1);assert.equal(postCalls,1);assert.equal(data.diagnostics.visaBootstrap.attempts,1);privateOutput(data,next);
 reset('form-root');next=await prepare();r=await call('/api/check-status',payload(next));data=await r.json();assert.equal(r.status,200);assert.equal(landingCalls,1);assert.equal(formCalls,1);assert.equal(imageCalls,1);assert.equal(data.diagnostics.visaBootstrap.initialRootCookiePair,'present');privateOutput(data,next);

 // Absence is not proof of an invalid CAPTCHA. Retry once, then allow a source
 // that legitimately has no root pair to produce its actual result.
 reset('optional');next=await prepare();r=await call('/api/check-status',payload(next));data=await r.json();assert.equal(r.status,200);assert.equal(landingCalls,2);assert.equal(imageCalls,1);assert.equal(postCalls,1);assert.deepEqual(data.diagnostics.visaBootstrap,{attempts:2,initialRootCookiePair:'absent',finalRootCookiePair:'absent'});privateOutput(data,next);
 reset('missing');next=await prepare();r=await call('/api/check-status',payload(next));data=await r.json();assert.equal(r.status,422);assert.equal(data.code,'CAPTCHA_INVALID');assert.equal(landingCalls,2);assert.equal(formCalls,2);assert.equal(imageCalls,1);assert.equal(postCalls,1);assert.equal(data.visaBootstrap.finalRootCookiePair,'absent');assert.equal(data.visaCookieChanges.submitToResponse.IVFRT_Cookie,'absent');privateOutput(data,next);
 reset('partial');next=await prepare();r=await call('/api/check-status',payload(next));data=await r.json();assert.equal(r.status,200);assert.equal(landingCalls,1);assert.equal(imageCalls,1);assert.equal(data.diagnostics.visaBootstrap.initialRootCookiePair,'partial');privateOutput(data,next);

 reset('denied');r=await call('/api/prepare',{source:'visa'});data=await r.json();assert.equal(r.status,503);assert.equal(data.code,'SOURCE_ACCESS_BLOCKED');assert.equal(landingCalls,2);assert.equal(formCalls,1);assert.equal(imageCalls,0);assert.equal(postCalls,0);privateOutput(data);
 assert.equal(logs.length,0);
}finally{globalThis.fetch=realFetch;console.warn=realWarn;}
console.log('PASS: missing-root bootstrap recovery with fresh jar/form, bounded GET navigation, one final image/one POST, healthy/partial/legitimately absent cookies, original source rejection, access denial and private diagnostics (mocked).');
