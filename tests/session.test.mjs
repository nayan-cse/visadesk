import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {handle} from '../src/handler.js';
import {remote} from '../src/worker.js';
import {cookieHeader} from '../src/cookies.js';
const realFetch=globalThis.fetch;
const env={SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url')};
const form='<form method="POST" action="StatusEnquiry"><input name="filerfno" id="application_id"><input name="passport_number"><input name="captcha"><input type="hidden" name="token" value="source-csrf"><img id="capt" src="captcha"><input name="submit_btn" type="submit" value="Check Status"></form>';
let nonce,captchaRequests=0;
const call=(path,body,cookie='')=>handle(new Request('https://app.test'+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)}),env);
try{
 globalThis.fetch=async(url,opts)=>{
  const path=new URL(url).pathname;
  if(opts.method==='POST'){
   const cookies=opts.headers.get('Cookie')||'';
   if(!['IVFRT_Cookie=route','BNES_IVFRT_Cookie=guard','JSESSIONID=session','BNES_JSESSIONID=signature'].every(v=>cookies.includes(v)))return new Response('<div class="error">Invalid Captcha</div>');
   const body=new URLSearchParams(opts.body);assert.equal(body.get('captcha'),'AbC123');assert.equal(body.get('token'),'source-csrf');assert.equal(body.get('submit_btn'),'Check Status');
   return new Response('<div>Your visa is processed is Granted but Not-Printed.</div>');
  }
  if(path==='/visa/captcha'){
   captchaRequests++;nonce=new URL(url).searchParams.get('rand');
   return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});
  }
  const cookies=path.endsWith('/index.html')?'IVFRT_Cookie=route; Expires=Tue, 01 Jan 2030 00:00:00 GMT; Path=/, BNES_IVFRT_Cookie=guard; Path=/':'JSESSIONID=session; Path=/visa; Secure, BNES_JSESSIONID=signature; Path=/visa; Secure';
  const response=new Response(form,{headers:{'Set-Cookie':cookies}});
  assert.equal(response.headers.getSetCookie().length,1,'Fixture must reproduce combined upstream cookies.');return response;
 };
 // Valid text must survive the source session when proxies combine cookies.
 let r=await call('/api/prepare',{source:'visa'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0],first=await r.json();
 const body={source:'visa',applicationId:'BGDTESTING001',passportNo:'Z12345678',captcha:'AbC123',token:first.token};
 r=await call('/api/check-status',body,cookie);assert.equal(r.status,200,'Combined source cookies must all survive into the result POST.');assert.equal((await r.json()).result.stage,'granted_not_printed');assert(nonce);
 // The unified function keeps all stages compatible with the same browser token.
 const oldNonce=nonce;r=await call('/api/track?action=prepare',{source:'visa'},cookie);assert.equal(r.status,200);assert.notEqual(nonce,oldNonce);const next=await r.json();
 r=await call('/api/track?action=check-status',{...body,token:next.token},cookie);assert.equal(r.status,200);assert.equal((await r.json()).result.stage,'granted_not_printed');assert.equal(captchaRequests,2);
 r=await handle(new Request('https://app.test/api/track?action=config',{headers:{cookie}}),env);assert.equal(r.status,200);assert.equal((await r.json()).version,'1.1.7');
 r=await call('/api/track?action=unknown',{});assert.equal(r.status,400);r=await call('/api/track?action=prepare',{source:'visa'},'visadesk_session='+'f'.repeat(64));const other=await r.json();
 r=await call('/api/track?action=check-status',{...body,token:other.token},cookie);assert.equal(r.status,409);
 // Some runtimes expose getSetCookie() but leave it empty: fall back to header.
 globalThis.fetch=async()=>{const headers=new Headers({'Set-Cookie':'one=a; Path=/, two=b; Path=/'});headers.getSetCookie=()=>[];return {ok:true,status:200,headers};};
 const jar={};await remote('https://www.passtrack.net/regular_passport.php','ivac',jar);assert.equal(cookieHeader(jar,'https://www.passtrack.net/regular_passport.php'),'one=a; two=b');
}finally{globalThis.fetch=realFetch;}
console.log('PASS: merged Set-Cookie session continuity, Expires comma, empty getSetCookie fallback, fresh CAPTCHA nonce, unified API routes and browser token binding.');
