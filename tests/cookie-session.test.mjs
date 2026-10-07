import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import worker,{remote} from '../src/worker.js';

const realFetch=globalThis.fetch,realNow=Date.now;
const base='https://indianvisaonline.gov.in';
let setCookies=[],sent;
try{
 globalThis.fetch=async(url,options)=>{
  sent=options.headers.get('Cookie')||'';
  const headers=new Headers();for(const value of setCookies)headers.append('Set-Cookie',value);
  setCookies=[];return new Response('ok',{headers});
 };
 const jar={};
 setCookies=['JSESSIONID=visa-session; Path=/visa; Secure'];
 await remote(base+'/visa/StatusEnquiry','visa',jar);
 setCookies=['JSESSIONID=root-session; Path=/; Secure'];
 await remote(base+'/visa/captcha','visa',jar);
 await remote(base+'/visa/StatusEnquiry','visa',jar,{method:'POST',body:'fixture'});
 assert.equal(sent,'JSESSIONID=visa-session; JSESSIONID=root-session','A root cookie must not overwrite the separate /visa session.');
 setCookies=['imageOnly=image; Path=/visa/captcha','other=ignored; Domain=unrelated.test; Path=/'];
 await remote(base+'/visa/captcha','visa',jar);
 await remote(base+'/visa/StatusEnquiry','visa',jar);
 assert(!sent.includes('imageOnly='));assert(!sent.includes('other='));
 await remote(base+'/visastore','visa',jar);
 assert.equal(sent,'JSESSIONID=root-session','Path /visa must not match /visastore.');
 setCookies=['JSESSIONID=deleted; Path=/; Max-Age=0'];
 await remote(base+'/visa/StatusEnquiry','visa',jar);
 await remote(base+'/visa/StatusEnquiry','visa',jar);
 assert.equal(sent,'JSESSIONID=visa-session','Deleting the root cookie must preserve the /visa session.');

 let clock=realNow();Date.now=()=>clock;
 const timed={};
 setCookies=['short=value; Max-Age=2; Expires=Tue, 01 Jan 2030 00:00:00 GMT','defaultPath=value'];
 await remote(base+'/visa/StatusEnquiry','visa',timed);
 await remote(base+'/visa/captcha','visa',timed);assert(sent.includes('short=value'));
 clock+=2001;await remote(base+'/visa/captcha','visa',timed);assert.equal(sent,'defaultPath=value');
 await remote(base+'/visa2/captcha','visa',timed);assert.equal(sent,'');
 Date.now=realNow;
 // Tokens issued by the previous version contain the flat cookie jar.
 const legacy={JSESSIONID:'old-session'};
 await remote(base+'/visa/StatusEnquiry','visa',legacy);assert.equal(sent,'JSESSIONID=old-session');

 const env={SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url')};
 const form='<form method="POST" action="StatusEnquiry"><input name="filerfno" id="application_id"><input name="passport_number"><input name="captcha"><input type="hidden" name="token" value="fixture-csrf"><img src="captcha"><input name="submit_btn" type="submit" value="Check Status"></form>';
 const call=(path,body)=>worker.fetch(new Request('https://tracker.test'+path,{method:'POST',headers:{'Content-Type':'application/json','x-visadesk-session':'fixture-owner'},body:JSON.stringify(body)}),env);
 let mode='success',postCalls=0;
 globalThis.fetch=async(url,options)=>{
  const path=new URL(url).pathname;
  if(options.method==='POST'){
   postCalls++;
   assert.equal(options.headers.get('Cookie'),'JSESSIONID=visa-session; JSESSIONID=root-renewed');
   const body=new URLSearchParams(options.body);assert.equal(body.get('captcha'),'AbC123');assert.equal(body.get('token'),'fixture-csrf');
   if(mode!=='success')return new Response('<ul class="errorMessage"><li>Invalid Captcha</li></ul>',{headers:mode==='changed'?{'Set-Cookie':'JSESSIONID=reset-session; Path=/visa'}:{}});
   return new Response('<div class="status">Granted and Printed</div>');
  }
  if(path==='/visa/captcha')return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png','Set-Cookie':'JSESSIONID=root-renewed; Path=/, imageOnly=private-image-cookie; Path=/visa/captcha'}});
  return new Response(form,{headers:{'Set-Cookie':path.endsWith('/index.html')?'JSESSIONID=root-session; Path=/':'JSESSIONID=visa-session; Path=/visa'}});
 };
 const prepared=await call('/api/prepare',{source:'visa'});assert.equal(prepared.status,200);const session=await prepared.json();
 const payload={source:'visa',applicationId:'BGDTESTING001',passportNo:'Z12345678',captcha:'AbC123',token:session.token};
 let response=await call('/api/check-status',payload);assert.equal(response.status,200);assert.equal((await response.json()).result.stage,'granted_printed');
 for(const state of ['unchanged','changed']){
  mode=state;const before=postCalls;response=await call('/api/check-status',payload);assert.equal(response.status,422);
  const data=await response.json();assert.equal(data.code,'CAPTCHA_INVALID');assert.equal(data.source,'visa');assert.equal(data.sessionCookieState,state);assert.equal(data.version,'1.1.7');assert(Number.isInteger(data.captchaAgeSeconds));
  assert.equal(postCalls,before+1,'A rejected CAPTCHA must not trigger an automatic submit retry.');
  const serialized=JSON.stringify(data);for(const value of ['visa-session','root-renewed','reset-session','private-image-cookie','fixture-csrf',payload.passportNo,payload.applicationId])assert(!serialized.includes(value));
 }
}finally{globalThis.fetch=realFetch;Date.now=realNow;}
console.log('PASS: scoped duplicate cookies, path/domain filtering, targeted deletion, expiry, legacy tokens, complete CAPTCHA session and private rejection diagnostics.');
