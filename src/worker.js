import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {imageHash,readWithAI} from './vision.js';
import {readWithOCRSpace,OCRSpaceError} from './ocr-space.js';
import {readWithGemini,GeminiError} from './gemini.js';
import {resolveOCRProvider,ocrConfigured} from './ocr-config.js';
import {cookieHeader,acceptCookies,sessionCookieSnapshot,selectedCookieSnapshot} from './cookies.js';
const APP_VERSION='1.1.9';
// Only this opaque instance marker is sealed in the token; it is never returned.
// A fresh module instance models a Vercel cold start, without storing user state.
const INSTANCE_ID=crypto.randomUUID();
function runtimeRegion(env){return /^[a-z]{3}\d$/.test(env.VERCEL_REGION||'')?env.VERCEL_REGION:env.VERCEL?'unknown':'local';}
export async function readCaptcha(image,source,env,provider,signal){
 if(provider==='gemini'){
  let primary,problem,reason;
  try{
   primary=await readWithGemini(image,source,env,{signal});
   if(primary.text&&primary.ready)return {...primary,requestedProvider:'gemini',fallback:false};
   reason=primary.text?'OCR_UNCERTAIN':'OCR_NO_TEXT';
  }
  catch(error){
   if(!(error instanceof GeminiError))throw error;
   problem=error;reason=error.code;
  }
  // The backup is sequential and shares the total budget with the first call.
  if(env.OCR_SPACE_API_KEY?.trim()&&!signal?.aborted){
   try{
    const backup=await readWithOCRSpace(image,source,env,{signal});
    if(backup.text||!primary?.text)return {...backup,requestedProvider:'gemini',fallback:true,fallbackAttempted:true,fallbackReason:reason};
    // Keep a usable but uncertain first candidate when the backup returns none.
    return {...primary,requestedProvider:'gemini',fallback:false,fallbackAttempted:true,fallbackReason:reason,backupError:'OCR_NO_TEXT'};
   }catch(error){
    if(!(error instanceof OCRSpaceError))throw error;
    if(primary?.text)return {...primary,ready:false,requestedProvider:'gemini',fallback:false,fallbackAttempted:true,fallbackReason:reason,backupError:error.code};
    Object.assign(error,{requestedProvider:'gemini',fallbackAttempted:true,fallbackReason:reason});
    throw error;
   }
  }
  if(primary)return {...primary,requestedProvider:'gemini',fallback:false,fallbackAttempted:false};
  throw problem;
 }
 return provider==='ocr-space'?readWithOCRSpace(image,source,env,{signal}):readWithAI(image,source,env);
}
class TrackerError extends Error {
 constructor(message,code,{status=422,retryable=false,needsNewCaptcha=false,upstreamStatus,diagnostics}={}) {
  super(message);this.name='TrackerError';
  Object.assign(this,{code,status,retryable,needsNewCaptcha,upstreamStatus,diagnostics});
 }
}
const failure=(message,code,options)=>new TrackerError(message,code,options);
const SOURCE_BUDGET_MS=45000;
const SOURCES = {
 visa: { name:'Indian Visa Online', origin:'https://indianvisaonline.gov.in', url:'https://indianvisaonline.gov.in/visa/StatusEnquiry' },
 ivac: { name:'IVAC Passtrack', origin:'https://www.passtrack.net', url:'https://www.passtrack.net/regular_passport.php' }
};
const enc = new TextEncoder();
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const decode = s=>String(s||'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(amp|quot|apos|nbsp|lt|gt|ndash|mdash);/g,(_,v)=>({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',ndash:'-',mdash:'-'})[v]);
function attrs(tag){const o={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))o[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);return o;}
const withoutComments=html=>html.replace(/<!--[\s\S]*?(?:-->|$)/g,'');
function plain(html){return decode(withoutComments(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')).trim();}
async function cookieFingerprint(jar,url){const value=cookieHeader(jar,url);return value?imageHash(enc.encode(value)):'';}
function cookieState(before,after){return before===undefined||after===undefined||!before&&!after?'unknown':before===after?'unchanged':'changed';}
const VISA_COOKIE_NAMES=['JSESSIONID','BNES_JSESSIONID','IVFRT_Cookie','BNES_IVFRT_Cookie'];
async function visaCookieSnapshot(jar,url){
 const raw=selectedCookieSnapshot(jar,url,VISA_COOKIE_NAMES);
 return Object.fromEntries(await Promise.all(VISA_COOKIE_NAMES.map(async name=>[name,raw[name]?await imageHash(enc.encode(raw[name])):''])));
}
function visaCookieChanges(before,after){
 return Object.fromEntries(VISA_COOKIE_NAMES.map(name=>{
  const a=before?.[name],b=after?.[name];
  return [name,a===undefined||b===undefined?'unknown':!a&&!b?'absent':!a?'added':!b?'removed':a===b?'unchanged':'changed'];
 }));
}
function sourceVisibleHtml(html){return withoutComments(html).replace(/<([a-z0-9]+)\b[^>]*style=["\'][^"\']*display\s*:\s*none[^"\']*["\'][^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<(head|script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');}
function visaReplySignals(html,url){
 const visible=sourceVisibleHtml(html),text=plain(visible);let enquiryFormPresent=false;
 try{parseForm(visible,url,'visa');enquiryFormPresent=true;}catch{}
 return {captchaErrorPresent:!!captchaRejection(visible),visaStatusPhrasePresent:/\b(?:granted|processed)\s*(?:and|&)\s*printed\b|\bgranted\s*(?:but|and)?\s*not[\s-]*printed\b|\bunder\s+process(?:ing)?\b|\bvisa\s+(?:has been\s+)?(?:granted|issued|rejected|refused)\b/i.test(text),enquiryFormPresent};
}
function captchaRejection(visible){
 const invalid=/invalid\s*(?:captcha|security\s+code)|captcha.{0,35}(?:is\s+incorrect|incorrect|is\s+invalid|invalid|does\s+not\s+match|not\s+match)|wrong\s+(?:captcha|security\s+code)|captcha\s+(?:is\s+)?wrong|status\s*:\s*\*?\s*(?:please|plase)\s+enter\s+(?:the\s+)?correct\s+code/i;
 const notices=[...visible.matchAll(/<(div|span|td|p|ul|li)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:alert|error|message)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)].map(m=>plain(m[2]));
 if(notices.some(n=>invalid.test(n)||/(?:please|plase)\s+enter\s+(?:the\s+)?correct\s+(?:code|captcha)/i.test(n)))return 'captcha-error-notice';
 return invalid.test(plain(visible))?'captcha-page-text':null;
}
function b64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function imageBase64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
function un64(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function key(env){if(!env.SESSION_ENCRYPTION_KEY)throw new Error('সার্ভারের সেশন সেটআপ অসম্পূর্ণ।');return crypto.subtle.importKey('raw',un64(env.SESSION_ENCRYPTION_KEY),'AES-GCM',false,['encrypt','decrypt']);}
async function seal(data,env){const iv=crypto.getRandomValues(new Uint8Array(12));const c=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),enc.encode(JSON.stringify(data)));return b64(iv)+'.'+b64(new Uint8Array(c));}
async function open(token,env,request){try{if(typeof token!=='string'||token.length>30000)throw 0;const [iv,c]=token.split('.');const s=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv)},await key(env),un64(c))));if(!Number.isFinite(s.exp)||s.exp<Date.now()||s.owner!==(request.headers.get('x-visadesk-session')||''))throw 0;return s;}catch{throw failure('আগের ছবির সময় শেষ হয়েছে বা সেশন বদলেছে। নতুন ছবি নিয়ে আবার নিশ্চিত করুন।','SESSION_EXPIRED',{status:409,retryable:true,needsNewCaptcha:true});}}
function allowed(url,source){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!==new URL(SOURCES[source].origin).hostname||u.port||u.username||u.password)throw failure('মূল সাইট অন্য ঠিকানায় পাঠিয়েছে। পরে আবার চেষ্টা করুন।','SOURCE_REDIRECT',{status:502,retryable:true});return u.href;}
async function discard(response){try{await response.body?.cancel();}catch{}}
// One shared budget includes redirects, retries and response-body reads. A POST
// is never replayed: the source may already have consumed its CAPTCHA.
export async function remote(url,source,jar,options={},budget=AbortSignal.timeout(SOURCE_BUDGET_MS)){
 url=allowed(url,source);let redirects=0,retries=0;
 while(redirects<5){
  budget.throwIfAborted();
  const headers=new Headers({'User-Agent':'Mozilla/5.0','Accept':'text/html,image/*;q=0.9,*/*;q=0.8','Accept-Language':'en-US,en;q=0.9',...options.headers});
  const cookie=cookieHeader(jar,url);if(cookie)headers.set('Cookie',cookie);
  const canRetry=!options.method||options.method==='GET';let r;
  try{r=await fetch(url,{...options,headers,cache:'no-store',redirect:'manual',signal:AbortSignal.any([budget,AbortSignal.timeout(12000)])});}
  catch(e){
   if(canRetry&&retries++===0&&!budget.aborted)continue;
   if(budget.aborted||e.name==='TimeoutError'||e.name==='AbortError')throw failure('মূল সাইট সময়মতো সাড়া দেয়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।','SOURCE_TIMEOUT',{status:504,retryable:true});
   throw failure('মূল সাইটের সঙ্গে সংযোগ হয়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।','SOURCE_NETWORK',{status:502,retryable:true});
  }
  let cookieHeaders=typeof r.headers.getSetCookie==='function'?r.headers.getSetCookie():typeof r.headers.getAll==='function'?r.headers.getAll('Set-Cookie'):[];
  if(!cookieHeaders?.length)cookieHeaders=[r.headers.get('set-cookie')||''];
  // Proxies can combine several cookies into one header even when getSetCookie
  // exists. Split every returned entry, preserving the comma in Expires dates.
  acceptCookies(jar,url,cookieHeaders);
  if(r.status>=300&&r.status<400&&r.headers.get('location')){
   const next=allowed(new URL(r.headers.get('location'),url).href,source);await discard(r);redirects++;
   if(options.method==='POST'&&[307,308].includes(r.status))throw failure('মূল সাইট জমা দেওয়ার অনুরোধ অন্য পেইজে পাঠিয়েছে। নতুন ছবি নিয়ে আবার চেক করুন।','SOURCE_REDIRECT',{status:502,retryable:true,needsNewCaptcha:true});
   if(r.status===303||([301,302].includes(r.status)&&options.method==='POST')){const nextHeaders=new Headers(options.headers);nextHeaders.delete('Content-Type');nextHeaders.delete('Content-Length');nextHeaders.delete('Origin');options={headers:Object.fromEntries(nextHeaders),method:'GET'};}
   url=next;continue;
  }
  if(!r.ok){
   await discard(r);
   if(canRetry&&retries++===0&&[408,502,503,504].includes(r.status)&&!budget.aborted)continue;
   const blocked=[401,403].includes(r.status);
   throw failure(blocked?'মূল সাইট এই সার্ভারের অনুরোধ গ্রহণ করছে না। পরে আবার চেষ্টা করুন।':'মূল সাইট এখন সাড়া দিতে পারছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।',blocked?'SOURCE_ACCESS_BLOCKED':'SOURCE_UNAVAILABLE',{status:503,retryable:true,upstreamStatus:r.status});
  }
  return {response:r,url,redirectCount:redirects};
 }
 throw failure('মূল সাইট ফলাফলের বদলে বারবার অন্য পেইজে পাঠাচ্ছে। পরে আবার চেষ্টা করুন।','SOURCE_REDIRECT',{status:502,retryable:true});
}
export function parseForm(html,url,source){
 html=withoutComments(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const forms=[...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)];
 for(const f of forms){const fa=attrs(f[1]);if((fa.method||'get').toLowerCase()!=='post')continue;const tags=[...f[2].matchAll(/<input\b[^>]*>/gi)].map(m=>attrs(m[0]));const fields={};let app='',passport='',captcha='';
 for(const t of tags){t.type=(t.type||'text').toLowerCase();if(!t.name||['button','reset','file'].includes(t.type))continue;if(t.type==='hidden'||t.type==='submit')fields[t.name]=t.value||'';const hint=[t.name,t.id,t.placeholder].join(' ').toLowerCase();if(/captcha|verification|verify|security|txtcode|code/.test(hint)&&t.type!=='hidden')captcha=t.name;else if(/passport/.test(hint)&&t.type!=='hidden')passport=t.name;else if(/application|app.?id|appref|web.?file|file.?no|reg.?no/.test(hint)&&t.type!=='hidden')app=t.name;}
 if(!app||!captcha||(source==='visa'&&!passport))continue;
 const images=[...f[2].matchAll(/<img\b[^>]*>/gi)].map(m=>attrs(m[0]));const img=images.find(x=>/captcha|verification|security|code/i.test([x.src,x.id,x.alt].join(' ')))||images.find(x=>/\.php|\.jsp|captcha/i.test(x.src||''));if(!img?.src)continue;
 return {action:allowed(new URL(fa.action||url,url).href,source),fields,app,passport,captcha,image:allowed(new URL(img.src,url).href,source),referer:url};}
 throw failure('মূল সাইটের স্ট্যাটাস ফর্ম পাওয়া যায়নি। পরে আবার চেষ্টা করুন।','SOURCE_FORM_UNAVAILABLE',{status:502,retryable:true});
}
export function interpret(html,source){
 const visible=sourceVisibleHtml(html);
 const text=plain(visible);
 if(/no\s+(?:record|data|result)s?\s+(?:was\s+)?found|record\s+not\s+found/i.test(text))throw failure('এই নম্বরে তথ্য পাওয়া যায়নি। আবেদন ও পাসপোর্ট নম্বর মিলিয়ে দেখুন।','NO_RECORD');
 // Generic instructions such as "enter a valid captcha" are not failures.
 // Keep the source's actual IVAC error ("Status: * Plase enter correct code").
 const rejection=captchaRejection(visible);
 if(rejection)throw failure('মূল সাইট ক্যাপচাটি গ্রহণ করেনি। নতুন ছবি নিয়ে আবার নিশ্চিত করুন।','CAPTCHA_INVALID',{retryable:true,needsNewCaptcha:true,diagnostics:{sourceReplyKind:rejection}});
 if(/session\s+(?:has\s+)?(?:expired|timed\s+out)|session\s+(?:is\s+)?invalid/i.test(text))throw failure('মূল সাইটে আগের ছবির সময় শেষ হয়েছে। নতুন ছবি নিয়ে আবার নিশ্চিত করুন।','SOURCE_SESSION_EXPIRED',{status:409,retryable:true,needsNewCaptcha:true});
 if(/<title[^>]*>\s*(?:just a moment|access denied|forbidden)/i.test(html)||/verify\s+(?:that\s+)?you\s+are\s+human|request\s+(?:has\s+been\s+)?blocked/i.test(text))throw failure('মূল সাইট এই সার্ভারের অনুরোধ গ্রহণ করছে না। পরে আবার চেষ্টা করুন।','SOURCE_ACCESS_BLOCKED',{status:503,retryable:true});
 const rules=source==='visa'?[[/\bgranted\s*(?:but|and)?\s*not[\s-]*printed\b/i,'Granted but Not-Printed','granted_not_printed'],[/\b(?:granted|processed)\s*(?:and|&)\s*printed\b/i,'Granted and Printed','granted_printed'],[/under\s+process(?:ing)?/i,'Under Processing','processing'],[/visa\s+(?:has been\s+)?(?:granted|issued)|application\s+(?:is\s+)?granted/i,'Visa Granted','success'],[/visa\s+(?:has been\s+)?(?:rejected|refused)|application\s+(?:is\s+)?rejected/i,'Visa Refused','attention']]:[[/passport\s+(?:has been\s+)?delivered|delivered\s+from\s+(?:the\s+)?cent(?:er|re)/i,'Delivered From Center','delivered'],[/ready\s+for\s+delivery/i,'Ready For Delivery','ready'],[/process\s+initiated|under\s+process(?:ing)?/i,'Process Initiated','processing'],[/received\s+at\s+(?:the\s+)?cent(?:er|re)/i,'Received At Center','received']];
 const notices=[...visible.matchAll(/<(?:div|span|td|p)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:result|status|alert|message)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|td|p)>/gi)].map(m=>plain(m[1])).filter(Boolean);
 const ivacRows=source==='ivac'?[...visible.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>plain(c[1]))).filter(c=>c.length>=2):[];const workflow=ivacRows.filter(c=>/received at|process initiated|ready for delivery|delivered from/i.test(c.join(' ')));const doneRows=workflow.filter(c=>/^(?:done|completed|yes|✓|✔)$/i.test(c[c.length-1].trim()));const confirmedRow=doneRows.length?doneRows[doneRows.length-1].join(' '):'';if(workflow.length&&!confirmedRow)throw failure('মূল সাইটের তালিকায় বর্তমান ধাপ নিশ্চিত করা যায়নি। পরে আবার চেক করুন।','RESULT_UNRECOGNIZED',{status:502,retryable:true});
 const resultTables=[...visible.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(m=>plain(m[1])).filter(t=>/status|search result/i.test(t));const responseText=sourceExcerpt(visible);const candidate=confirmedRow||[...notices,...resultTables,...(/your\s+visa(?:\s+application)?\s+(?:is\s+)?(?:processed\s+is\s+)?(?:processed\s+and\s+printed|granted|under\s+process|issued|rejected|refused)|your\s+passport\s+(?:is|has)\b.{0,45}(delivered|processing)|application\s+status\s*:|current\s+status\s*:/i.test(responseText)?[responseText]:[])].join(' ');const hit=rules.find(([r])=>r.test(candidate));
 if(!hit){let returnedForm=false;try{parseForm(visible,SOURCES[source].url,source);returnedForm=true;}catch{}
  throw failure(returnedForm?'মূল সাইট ফলাফলের বদলে ফর্ম ফেরত দিয়েছে। নতুন ছবি নিয়ে আবার চেক করুন।':'মূল সাইটের উত্তর থেকে ফলাফল নিশ্চিত করা যায়নি। পরে আবার চেক করুন।',returnedForm?'SOURCE_RESULT_MISSING':'RESULT_UNRECOGNIZED',{status:502,retryable:true,needsNewCaptcha:true});
 }
 const m=hit[0].exec(candidate),start=Math.max(0,m.index-100);const evidence=candidate.slice(start,m.index+m[0].length+180);const name=text.match(/Applicant\s*Name\s*:?\s*([A-Z][A-Z .'-]{3,70}?)(?=\s+(?:Passport|Web|Application|Delivery|Submission|Status|Process|Date)|$)/);return {label:hit[1],stage:hit[2],evidence,applicantName:name?name[1].trim():null,checkedAt:new Date().toISOString(),source:SOURCES[source].name,sourceUrl:SOURCES[source].url,deliverySteps:source==='ivac'&&workflow.length?['Received At Center','Process Initiated','Ready For Delivery','Delivered From Center'].map(label=>{const row=workflow.find(c=>c.some(v=>v.toLowerCase()===label.toLowerCase()));return {label,done:!!row&&/^(?:done|completed|yes|✓|✔)$/i.test(row[row.length-1].trim())};}):null};
}
export function sourceExcerpt(html){let cleaned=html.replace(/<(head|script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');const text=plain(cleaned);const result=text.match(/Search Result\s+([\s\S]*?)(?=\bNote\s*:|About Us|popular Posts|$)/i);return (result?result[1]:text.split(/Note\s*:\s*\(For|Instructions for|About Us/i)[0]).trim().slice(0,1800);}
function rootCookiePairState(jar){
 const cookies=selectedCookieSnapshot(jar,SOURCES.visa.url,['IVFRT_Cookie','BNES_IVFRT_Cookie']);
 return cookies.IVFRT_Cookie&&cookies.BNES_IVFRT_Cookie?'present':cookies.IVFRT_Cookie||cookies.BNES_IVFRT_Cookie?'partial':'absent';
}
async function loadSourceForm(source,jar,budget){
 let navigationHeaders={};
 if(source==='visa'){
  const landing=await remote(SOURCES.visa.origin+'/visa/index.html',source,jar,{},budget);
  await landing.response.text();navigationHeaders={Referer:landing.url};
 }
 let fetched=await remote(SOURCES[source].url,source,jar,{headers:navigationHeaders},budget);
 let html=await fetched.response.text();
 if(source==='visa'&&new URL(fetched.url).pathname.endsWith('/index.html')){
  fetched=await remote(SOURCES.visa.url,source,jar,{headers:{Referer:fetched.url}},budget);html=await fetched.response.text();
  if(new URL(fetched.url).pathname.endsWith('/index.html'))throw failure('মূল সাইট স্ট্যাটাস ফর্মের বদলে হোমপেইজ ফেরত দিচ্ছে। পরে আবার চেষ্টা করুন।','SOURCE_FORM_UNAVAILABLE',{status:502,retryable:true});
 }
 return parseForm(html,fetched.url,source);
}
async function api(request,env,path){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'অনুরোধ গ্রহণযোগ্য নয়।'},403);
 if(path==='/api/config'&&request.method==='GET'){const provider=resolveOCRProvider(env);return json({version:APP_VERSION,provider,configured:ocrConfigured(env,provider)});}
 if(request.method!=='POST')return json({error:'POST required'},405);
 if(Number(request.headers.get('content-length')||0)>40000)return json({error:'Request too large'},413);
 try{let b;try{b=await request.json();}catch{throw failure('অনুরোধের তথ্য গ্রহণযোগ্য নয়।','INVALID_INPUT',{status:400});}if(!b||!Object.hasOwn(SOURCES,b.source))return json({error:'সঠিক উৎস নির্বাচন করুন।',code:'INVALID_INPUT'},400);
 const budget=AbortSignal.timeout(SOURCE_BUDGET_MS);
 if(path==='/api/prepare'){
 let jar={};let f=await loadSourceForm(b.source,jar,budget),visaBootstrap;
 if(b.source==='visa'){
  const initialRootCookiePair=rootCookiePairState(jar);let attempts=1;
  // Observed failures sometimes have neither root cookie. Before displaying any
  // CAPTCHA, retry normal navigation once with a new jar/form. The source can
  // legitimately omit these cookies, so absence never becomes a CAPTCHA error.
  if(initialRootCookiePair==='absent'){jar={};f=await loadSourceForm(b.source,jar,budget);attempts=2;}
  visaBootstrap={attempts,initialRootCookiePair,finalRootCookiePair:rootCookiePairState(jar)};
 }
 const formCookies=await cookieFingerprint(jar,f.action);
 const formVisaCookies=b.source==='visa'?await visaCookieSnapshot(jar,f.action):undefined;
 // The source's own refreshCaptcha() uses captcha?rand=... to fetch a new image.
 const imageUrl=new URL(f.image);if(b.source==='visa'&&imageUrl.pathname==='/visa/captcha')imageUrl.searchParams.set('rand',String(Date.now()));
 const img=await remote(imageUrl.href,b.source,jar,{headers:{Referer:f.referer,'Cache-Control':'no-cache',Pragma:'no-cache'}},budget);const mime=img.response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
 if(!['image/png','image/jpeg','image/gif','image/webp'].includes(mime))throw failure('মূল সাইট থেকে ছবিটি পাওয়া যায়নি। আবার নতুন ছবি নিন।','SOURCE_IMAGE_UNAVAILABLE',{status:502,retryable:true,needsNewCaptcha:true});
 const bytes=new Uint8Array(await img.response.arrayBuffer());if(!bytes.length||bytes.length>1000000)throw failure('ছবিটি গ্রহণযোগ্য নয়। আবার নতুন ছবি নিন।','SOURCE_IMAGE_UNAVAILABLE',{status:502,retryable:true,needsNewCaptcha:true});
 const captchaHash=await imageHash(bytes);const imageCookies=await cookieFingerprint(jar,f.action);const imageVisaCookies=b.source==='visa'?await visaCookieSnapshot(jar,f.action):undefined;const createdAt=Date.now(),exp=createdAt+5*60*1000;const token=await seal({source:b.source,form:f,jar,exp,createdAt,captchaHash,imageCookies,formImageCookieState:cookieState(formCookies,imageCookies),...(b.source==='visa'?{visaCookies:{form:formVisaCookies,image:imageVisaCookies},visaBootstrap}:{}),preparedInstance:INSTANCE_ID,preparedRegion:runtimeRegion(env),owner:request.headers.get('x-visadesk-session')||''},env);return json({token,expiresAt:exp,captcha:'data:'+mime+';base64,'+imageBase64(bytes)});
 }
 if(path==='/api/read-captcha'){
 const session=await open(b.token,env,request);if(session.source!==b.source)throw failure('ছবির উৎস মেলেনি। নতুন ছবি নিন।','SESSION_EXPIRED',{status:409,retryable:true,needsNewCaptcha:true});
 const provider=resolveOCRProvider(env);
 if(!['gemini','ocr-space','openai','browser'].includes(provider))throw new GeminiError('OCR_SETTINGS_INVALID',false);
 if(!ocrConfigured(env,provider))return json({error:'ছবির লেখাটি নিজে লিখে মিলিয়ে নিন।',code:'AI_NOT_CONFIGURED'},503);
 const match=String(b.image||'').match(/^data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!match||b.image.length>32000)return json({error:'ক্যাপচা ছবিটি গ্রহণযোগ্য নয়।'},400);
 const bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));if(await imageHash(bytes)!==session.captchaHash)return json({error:'ক্যাপচা সেশনের ছবি মেলেনি।'},400);
 return json(await readCaptcha(b.image,b.source,env,provider,budget));
 }
 if(path==='/api/check-status'){
 if(!/^BGD[A-Z0-9]{7,25}$/.test(String(b.applicationId||''))||! /^[A-Z0-9]{5,20}$/.test(String(b.passportNo||'')))throw failure('আবেদন ও পাসপোর্ট নম্বর ঠিক করে লিখুন।','INVALID_INPUT',{status:400});if(!/^[\w -]{1,32}$/.test(String(b.captcha||'')))throw failure('ছবির লেখাটি পূরণ করুন।','CAPTCHA_REQUIRED',{status:400});
 const session=await open(b.token,env,request);if(session.source!==b.source)throw failure('ছবির উৎস মেলেনি। নতুন ছবি নিন।','SESSION_EXPIRED',{status:409,retryable:true,needsNewCaptcha:true});const f=session.form;const params=new URLSearchParams(f.fields);params.set(f.app,b.applicationId);if(f.passport)params.set(f.passport,b.passportNo);params.set(f.captcha,b.captcha);
 const before=sessionCookieSnapshot(session.jar,f.action);
 const submitCookies=await cookieFingerprint(session.jar,f.action);
 const submitVisaCookies=b.source==='visa'?await visaCookieSnapshot(session.jar,f.action):undefined;
 const fetched=await remote(f.action,b.source,session.jar,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Referer:f.referer,Origin:SOURCES[b.source].origin},body:params.toString()},budget);
 if(b.source==='visa'&&/\/(?:index\.html|login)\/?$/i.test(new URL(fetched.url).pathname)){await discard(fetched.response);throw failure('মূল সাইট ফলাফলের বদলে আগের পেইজে পাঠিয়েছে। নতুন ছবি নিয়ে আবার নিশ্চিত করুন।','SOURCE_SESSION_EXPIRED',{status:409,retryable:true,needsNewCaptcha:true});}
 const html=await fetched.response.text();
 const after=sessionCookieSnapshot(session.jar,f.action),responseCookies=await cookieFingerprint(session.jar,f.action);
 const diagnostics={source:b.source,version:APP_VERSION,sessionCookieState:before?(before===after?'unchanged':'changed'):'unknown',captchaAgeSeconds:Math.max(0,Math.floor((Date.now()-(session.createdAt??session.exp-300000))/1000)),captchaLength:String(b.captcha).length,formImageCookieState:session.formImageCookieState??'unknown',imageSubmitCookieState:cookieState(session.imageCookies,submitCookies),submitResponseCookieState:cookieState(submitCookies,responseCookies),runtimeContinuity:session.preparedInstance?(session.preparedInstance===INSTANCE_ID?'same-instance':'different-instance'):'unknown',prepareRegion:session.preparedRegion??'unknown',checkRegion:runtimeRegion(env)};
 if(b.source==='visa')Object.assign(diagnostics,{visaBootstrap:session.visaBootstrap??{attempts:null,initialRootCookiePair:'unknown',finalRootCookiePair:'unknown'},visaCookieChanges:{formToImage:visaCookieChanges(session.visaCookies?.form,session.visaCookies?.image),imageToSubmit:visaCookieChanges(session.visaCookies?.image,submitVisaCookies),submitToResponse:visaCookieChanges(submitVisaCookies,await visaCookieSnapshot(session.jar,f.action))},sourceHttpStatus:fetched.response.status,sourceRedirectCount:fetched.redirectCount,sourceReplySignals:visaReplySignals(html,fetched.url)});
 try{return json({result:interpret(html,b.source),diagnostics});}
 catch(error){
  if(error instanceof TrackerError)error.diagnostics={...diagnostics,...error.diagnostics};
  throw error;
 }
 }return json({error:'Not found'},404);
 }catch(e){
  if(e instanceof OCRSpaceError||e instanceof GeminiError)return json({error:'ছবির লেখাটি নিজে লিখে মিলিয়ে নিন।',code:e.code,retryable:e.retryable,verified:false,...(e.fallbackAttempted?{requestedProvider:e.requestedProvider,fallbackAttempted:true,fallbackReason:e.fallbackReason}:{})},503);
  const problem=e instanceof TrackerError?e:/(?:TimeoutError|AbortError)/.test(e.name)?failure('মূল সাইট সময়মতো সাড়া দেয়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।','SOURCE_TIMEOUT',{status:504,retryable:true}):failure(path==='/api/read-captcha'?'ছবির লেখাটি নিজে লিখে মিলিয়ে নিন।':'এখন ফলাফল আনা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।',path==='/api/read-captcha'?'OCR_UNAVAILABLE':'INTERNAL_ERROR',{status:503,retryable:true});
  return json({error:problem.message,code:problem.code,retryable:problem.retryable,needsNewCaptcha:problem.needsNewCaptcha,verified:false,...problem.diagnostics},problem.status);
 }
}

let page;
function readPage(){
 if(page!==undefined)return page;
 // Vercel includes this asset at the project root even if the handler is bundled.
 // Read only for the home page so an asset error cannot prevent API startup.
 try{page=readFileSync(join(process.cwd(),'src','index.html'),'utf8');}
 catch(error){
  if(!['ENOENT','ENOTDIR'].includes(error.code))throw error;
  page=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 }
 return page;
}

export default {async fetch(request,env){const path=new URL(request.url).pathname;if(path.startsWith("/api/"))return api(request,env,path);if(path!=="/")return new Response("Not found",{status:404});return new Response(readPage(),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' data: https://cdn.jsdelivr.net https://tessdata.projectnaptha.com; base-uri 'none'; form-action 'self'"}});}};
