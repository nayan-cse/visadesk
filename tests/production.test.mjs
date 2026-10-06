import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import worker,{remote} from '../src/worker.js';

const originalFetch=globalThis.fetch,originalWarn=console.warn,logs=[];
console.warn=(...values)=>logs.push(values.join(' '));
const env={SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url')};
const call=(path,body)=>worker.fetch(new Request('https://tracker.test'+path,{method:'POST',headers:{'Content-Type':'application/json','x-visadesk-session':'browser-owner'},body:JSON.stringify(body)}),env);
const form='<form method="post"><input name="application_id"><input name="passport_no"><input name="captcha"><input type="hidden" name="csrf" value="private-csrf"><img src="captcha"></form>';
let calls=0,mode='prepare',postCalls=0,redirectGetCookie;
try{
 // Only idempotent GETs receive a single retry. Denials/rate limits and POSTs
 // must not be replayed. The encrypted CAPTCHA is not refreshed behind the user.
 globalThis.fetch=async()=>{calls++;return new Response(calls===1?'busy':'ok',{status:calls===1?503:200});};
 await remote('https://www.passtrack.net/regular_passport.php','ivac',{});assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;throw new TypeError('network unavailable');};
 await assert.rejects(remote('https://www.passtrack.net/regular_passport.php','ivac',{}),e=>e.code==='SOURCE_NETWORK');assert.equal(calls,2);
 calls=0;await assert.rejects(remote('https://www.passtrack.net/regular_passport.php','ivac',{}, {method:'POST',body:'private'}),e=>e.code==='SOURCE_NETWORK');assert.equal(calls,1);
 for(const status of [403,429]){calls=0;globalThis.fetch=async()=>{calls++;return new Response('denied',{status});};await assert.rejects(remote('https://www.passtrack.net/regular_passport.php','ivac',{}),e=>e.upstreamStatus===status);assert.equal(calls,1);}
 calls=0;globalThis.fetch=async()=>{calls++;return new Response(null,{status:307,headers:{Location:'/regular_passport.php'}});};await assert.rejects(remote('https://www.passtrack.net/regular_passport.php','ivac',{}, {method:'POST',body:'private'}),e=>e.code==='SOURCE_REDIRECT');assert.equal(calls,1);

 // A shared budget aborts a slow request before the platform's 60 second limit.
 globalThis.fetch=async(url,opts)=>new Promise((_,reject)=>{const onAbort=()=>reject(opts.signal.reason);if(opts.signal.aborted)onAbort();else opts.signal.addEventListener('abort',onAbort,{once:true});});
 const keepAlive=setTimeout(()=>{},1000);const start=Date.now();
 await assert.rejects(remote('https://www.passtrack.net/regular_passport.php','ivac',{}, {},AbortSignal.timeout(15)),e=>e.code==='SOURCE_TIMEOUT');clearTimeout(keepAlive);assert(Date.now()-start<1000);

 globalThis.fetch=async(url,opts)=>{
  if(opts.method==='POST'){
   postCalls++;
   if(mode==='http')return new Response('unavailable',{status:503});
   if(mode==='captcha')return new Response('<div class="alert">Invalid captcha</div>');
   if(mode==='missing')return new Response(form+'<p>Enter a valid captcha</p>');
   if(mode==='unknown')return new Response('<div class="status">Awaiting new source review</div>');
   if(mode==='record')return new Response('<div class="alert">No record found</div>');
   if(mode==='redirect')return new Response(null,{status:302,headers:{Location:'/visa/index.html','Set-Cookie':'JSESSIONID=renewed; Path=/visa'}});
   if(mode==='printed')return new Response('<p>Please enter correct code</p><div class="status">Granted and Printed</div>');
  }
  if(mode==='redirect'){redirectGetCookie=opts.headers.get('Cookie');assert(!opts.body);return new Response('<h1>Home</h1>');}
  if(url.endsWith('/captcha'))return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png','Set-Cookie':'captchaCookie=image-session; Path=/visa'}});
  return new Response(form,{headers:{'Set-Cookie':'JSESSIONID=private-source-cookie; Path=/visa'}});
 };
 let r=await call('/api/prepare',{source:'visa'});assert.equal(r.status,200);const session=await r.json();
 const payload={source:'visa',applicationId:'BGDTESTING001',passportNo:'Z98765432',captcha:'AbC123',token:session.token};
 for(const [next,status,code,newImage] of [['http',503,'SOURCE_UNAVAILABLE',false],['captcha',422,'CAPTCHA_INVALID',true],['missing',502,'SOURCE_RESULT_MISSING',true],['unknown',502,'RESULT_UNRECOGNIZED',true],['record',422,'NO_RECORD',false],['redirect',409,'SOURCE_SESSION_EXPIRED',true]]){
  mode=next;const before=postCalls;r=await call('/api/check-status',payload);assert.equal(r.status,status,next);const data=await r.json();assert.equal(data.code,code);assert.equal(data.needsNewCaptcha,newImage);assert.equal(postCalls,before+1);assert(!Object.hasOwn(data,'requestId'));assert(!data.sourceMessage);assert(!data.pageTitle);
 }
 assert(redirectGetCookie.includes('JSESSIONID=renewed'));assert(redirectGetCookie.includes('captchaCookie=image-session'));
 mode='printed';r=await call('/api/check-status',payload);assert.equal(r.status,200);assert.equal((await r.json()).result.stage,'granted_printed');
 assert.equal(logs.length,0,'Source failures must not create custom server diagnostics.');
}finally{globalThis.fetch=originalFetch;console.warn=originalWarn;}
console.log('PASS: production error classification, safe GET retry, no POST replay, total request budget, redirect cookies, missing/unknown results, and no custom server diagnostics.');
