import {readFileSync} from 'node:fs';
import {imageHash,readWithAI} from './vision.js';
import {readWithOCRSpace} from './ocr-space.js';
const SOURCES = {
 visa: { name:'Indian Visa Online', origin:'https://indianvisaonline.gov.in', url:'https://indianvisaonline.gov.in/visa/StatusEnquiry' },
 ivac: { name:'IVAC Passtrack', origin:'https://www.passtrack.net', url:'https://www.passtrack.net/regular_passport.php' }
};
const enc = new TextEncoder();
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const decode = s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
function attrs(tag){const o={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))o[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);return o;}
function plain(html){return decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')).trim();}
function b64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function un64(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function key(env){if(!env.SESSION_ENCRYPTION_KEY)throw new Error('সার্ভারের সেশন সেটআপ অসম্পূর্ণ।');return crypto.subtle.importKey('raw',un64(env.SESSION_ENCRYPTION_KEY),'AES-GCM',false,['encrypt','decrypt']);}
async function seal(data,env){const iv=crypto.getRandomValues(new Uint8Array(12));const c=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),enc.encode(JSON.stringify(data)));return b64(iv)+'.'+b64(new Uint8Array(c));}
async function open(token,env,request){try{if(typeof token!=='string'||token.length>30000)throw 0;const [iv,c]=token.split('.');const s=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv)},await key(env),un64(c))));if(s.exp<Date.now()||s.owner!==(request.headers.get('x-visadesk-session')||''))throw 0;return s;}catch{throw new Error('ক্যাপচা সেশনের মেয়াদ শেষ। নতুন ক্যাপচা নিন।');}}
function allowed(url,source){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!==new URL(SOURCES[source].origin).hostname)throw new Error('মূল সাইট অন্য ঠিকানায় পাঠিয়েছে; সরাসরি মূল সাইটে চেক করুন।');return u.href;}
async function remote(url,source,jar,options={}){
 url=allowed(url,source);for(let i=0;i<5;i++){
 const headers=new Headers({'User-Agent':'Mozilla/5.0','Accept':'text/html,image/*;q=0.9,*/*;q=0.8',...options.headers});const cookie=Object.entries(jar).map(([k,v])=>k+'='+v).join('; ');if(cookie)headers.set('Cookie',cookie);
 const r=await fetch(url,{...options,headers,redirect:'manual',signal:AbortSignal.timeout(14000)});
 const cookies=typeof r.headers.getSetCookie==='function'?r.headers.getSetCookie():typeof r.headers.getAll==='function'?r.headers.getAll('Set-Cookie'):(r.headers.get('set-cookie')||'').split(/,(?=\s*[^;,=\s]+=[^;,]*)/);for(const c of cookies){const m=c.match(/^\s*([^=;,\s]+)=([^;]*)/);if(m)jar[m[1]]=m[2];}
 if(r.status>=300&&r.status<400&&r.headers.get('location')){url=allowed(new URL(r.headers.get('location'),url).href,source);if([301,302,303].includes(r.status))options={};continue;}
 if(!r.ok)throw new Error('মূল সাইট HTTP '+r.status+' দিয়েছে। ক্যাপচা আবার নিন অথবা মূল সাইটে চেক করুন।');return {response:r,url};}
 throw new Error('মূল সাইট বারবার অন্য পেইজে পাঠাচ্ছে।');
}
export function parseForm(html,url,source){
 const forms=[...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)];
 for(const f of forms){const fa=attrs(f[1]);if((fa.method||'get').toLowerCase()!=='post')continue;const tags=[...f[2].matchAll(/<input\b[^>]*>/gi)].map(m=>attrs(m[0]));const fields={};let app='',passport='',captcha='';
 for(const t of tags){if(!t.name||['button','reset','file'].includes((t.type||'').toLowerCase()))continue;if(t.type==='hidden'||t.type==='submit')fields[t.name]=t.value||'';const hint=[t.name,t.id,t.placeholder].join(' ').toLowerCase();if(/captcha|verification|verify|security|txtcode|code/.test(hint)&&t.type!=='hidden')captcha=t.name;else if(/passport/.test(hint)&&t.type!=='hidden')passport=t.name;else if(/application|app.?id|appref|web.?file|file.?no|reg.?no/.test(hint)&&t.type!=='hidden')app=t.name;}
 if(!app||!captcha||(source==='visa'&&!passport))continue;
 const images=[...f[2].matchAll(/<img\b[^>]*>/gi)].map(m=>attrs(m[0]));const img=images.find(x=>/captcha|verification|security|code/i.test([x.src,x.id,x.alt].join(' ')))||images.find(x=>/\.php|\.jsp|captcha/i.test(x.src||''));if(!img?.src)continue;
 return {action:allowed(new URL(fa.action||url,url).href,source),fields,app,passport,captcha,image:allowed(new URL(img.src,url).href,source),referer:url};}
 throw new Error('ক্যাপচাসহ স্ট্যাটাস ফর্ম শনাক্ত করা যায়নি। মূল সাইটের ফর্ম বদলেছে বা প্রবেশ সীমিত করেছে।');
}
export function interpret(html,source){
 const text=plain(html.replace(/<([a-z0-9]+)\b[^>]*style=["\'][^"\']*display\s*:\s*none[^"\']*["\'][^>]*>[\s\S]*?<\/\1>/gi,''));if(/no\s+(?:record|data|result)s?\s+(?:was\s+)?found|record\s+not\s+found/i.test(text))throw new Error('মূল উৎসে এই আবেদনের রেকর্ড পাওয়া যায়নি। Application ID ও Passport Number যাচাই করুন।');if(/invalid\s*(captcha|security code)|captcha.{0,45}(incorrect|invalid|not match)|wrong.{0,20}captcha|(?:correct|valid)\s+captcha|captcha.{0,20}wrong|(?:please|plase)\s+enter\s+(?:the\s+)?correct\s+code/i.test(text))throw new Error('ক্যাপচা সঠিক হয়নি। নতুন ক্যাপচা নিয়ে আবার চেষ্টা করুন।');
 const rules=source==='visa'?[[/\bgranted\s*(?:but|and)?\s*not[\s-]*printed\b/i,'Granted but Not-Printed','granted_not_printed'],[/\b(?:granted|processed)\s*(?:and|&)\s*printed\b/i,'Granted and Printed','granted_printed'],[/under\s+process(?:ing)?/i,'Under Processing','processing'],[/visa\s+(?:has been\s+)?(?:granted|issued)|application\s+(?:is\s+)?granted/i,'Visa Granted','success'],[/visa\s+(?:has been\s+)?(?:rejected|refused)|application\s+(?:is\s+)?rejected/i,'Visa Refused','attention']]:[[/passport\s+(?:has been\s+)?delivered|delivered\s+from\s+(?:the\s+)?cent(?:er|re)/i,'Delivered From Center','delivered'],[/ready\s+for\s+delivery/i,'Ready For Delivery','ready'],[/process\s+initiated|under\s+process(?:ing)?/i,'Process Initiated','processing'],[/received\s+at\s+(?:the\s+)?cent(?:er|re)/i,'Received At Center','received']];
 const notices=[...html.matchAll(/<(?:div|span|td|p)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:result|status|alert|message)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|td|p)>/gi)].map(m=>plain(m[1])).filter(Boolean);
 const ivacRows=source==='ivac'?[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>plain(c[1]))).filter(c=>c.length>=2):[];const workflow=ivacRows.filter(c=>/received at|process initiated|ready for delivery|delivered from/i.test(c.join(' ')));const doneRows=workflow.filter(c=>/^(?:done|completed|yes|✓|✔)$/i.test(c[c.length-1].trim()));const confirmedRow=doneRows.length?doneRows[doneRows.length-1].join(' '):'';if(workflow.length&&!confirmedRow)throw new Error('উৎসের ধাপের তালিকা পাওয়া গেছে, কিন্তু নিশ্চিত বর্তমান ধাপ শনাক্ত হয়নি।');
 const resultTables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(m=>plain(m[1])).filter(t=>/status|search result/i.test(t));const responseText=sourceExcerpt(html);const candidate=confirmedRow||[...notices,...resultTables,...(/your\s+visa(?:\s+application)?\s+(?:is\s+)?(?:processed\s+is\s+)?(?:processed\s+and\s+printed|granted|under\s+process|issued|rejected|refused)|your\s+passport\s+(?:is|has)\b.{0,45}(delivered|processing)|application\s+status\s*:|current\s+status\s*:/i.test(responseText)?[responseText]:[])].join(' ');if(!candidate)throw new Error('উৎসের নির্দিষ্ট ফলাফল অংশ পাওয়া যায়নি। মূল সাইটে যাচাই করুন।');const hit=rules.find(([r])=>r.test(candidate));if(!hit)throw new Error('উৎস থেকে নিশ্চিত স্ট্যাটাস শনাক্ত হয়নি। মূল সাইটে ফলাফল যাচাই করুন।');
 const m=hit[0].exec(candidate),start=Math.max(0,m.index-100);const evidence=candidate.slice(start,m.index+m[0].length+180);const name=text.match(/Applicant\s*Name\s*:?\s*([A-Z][A-Z .'-]{3,70}?)(?=\s+(?:Passport|Web|Application|Delivery|Submission|Status|Process|Date)|$)/);return {label:hit[1],stage:hit[2],evidence,applicantName:name?name[1].trim():null,checkedAt:new Date().toISOString(),source:SOURCES[source].name,sourceUrl:SOURCES[source].url,deliverySteps:source==='ivac'&&workflow.length?['Received At Center','Process Initiated','Ready For Delivery','Delivered From Center'].map(label=>{const row=workflow.find(c=>c.some(v=>v.toLowerCase()===label.toLowerCase()));return {label,done:!!row&&/^(?:done|completed|yes|✓|✔)$/i.test(row[row.length-1].trim())};}):null};
}
export function sourceExcerpt(html){let cleaned=html.replace(/<(head|script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');const text=plain(cleaned);const result=text.match(/Search Result\s+([\s\S]*?)(?=\bNote\s*:|About Us|popular Posts|$)/i);return (result?result[1]:text.split(/Note\s*:\s*\(For|Instructions for|About Us/i)[0]).trim().slice(0,1800);}
async function api(request,env,path){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'অনুরোধ গ্রহণযোগ্য নয়।'},403);
 if(path==='/api/config'&&request.method==='GET'){const provider=(env.OCR_PROVIDER|| (env.OCR_SPACE_API_KEY?.trim()?'ocr-space':env.OPENAI_API_KEY?.trim()?'openai':'browser')).trim();return json({provider,configured:provider==='ocr-space'?!!env.OCR_SPACE_API_KEY?.trim():provider==='openai'?!!env.OPENAI_API_KEY?.trim():false});}
 if(request.method!=='POST')return json({error:'POST required'},405);
 if(Number(request.headers.get('content-length')||0)>40000)return json({error:'Request too large'},413);
 try{const b=await request.json();if(!SOURCES[b.source])return json({error:'সঠিক উৎস নির্বাচন করুন।'},400);
 if(path==='/api/prepare'){
 const jar={};let navigationHeaders={};if(b.source==='visa'){const landing=await remote(SOURCES.visa.origin+'/visa/index.html',b.source,jar);await landing.response.text();navigationHeaders={Referer:landing.url};}
 let fetched=await remote(SOURCES[b.source].url,b.source,jar,{headers:navigationHeaders});let html=await fetched.response.text();if(b.source==='visa'&&new URL(fetched.url).pathname.endsWith('/index.html')){fetched=await remote(SOURCES.visa.url,b.source,jar,{headers:{Referer:fetched.url}});html=await fetched.response.text();if(new URL(fetched.url).pathname.endsWith('/index.html'))throw new Error('Indian Visa এই সার্ভারের অনুরোধে স্ট্যাটাস ফর্মের বদলে হোমপেইজ ফেরত দিচ্ছে। মূল সাইটে গিয়ে Check your Visa Status খুলুন।');}const f=parseForm(html,fetched.url,b.source);const img=await remote(f.image,b.source,jar,{headers:{Referer:f.referer}});const mime=img.response.headers.get('content-type')?.split(';')[0];if(!['image/png','image/jpeg','image/gif','image/webp'].includes(mime))throw new Error('মূল সাইট থেকে ক্যাপচা ছবি পাওয়া যায়নি।');const bytes=new Uint8Array(await img.response.arrayBuffer());if(bytes.length>1000000)throw new Error('ক্যাপচা ছবি গ্রহণযোগ্য নয়।');const captchaHash=await imageHash(bytes);const exp=Date.now()+5*60*1000;const token=await seal({source:b.source,form:f,jar,exp,captchaHash,owner:request.headers.get('x-visadesk-session')||''},env);return json({token,expiresAt:exp,captcha:'data:'+mime+';base64,'+b64(bytes).replace(/-/g,'+').replace(/_/g,'/')});
 }
 if(path==='/api/read-captcha'){
 const session=await open(b.token,env,request);if(session.source!==b.source)throw new Error('ক্যাপচা উৎস মেলেনি।');
 const provider=(env.OCR_PROVIDER|| (env.OCR_SPACE_API_KEY?.trim()?'ocr-space':env.OPENAI_API_KEY?.trim()?'openai':'browser')).trim();
 if(!['ocr-space','openai','browser'].includes(provider))throw new Error('OCR_PROVIDER হবে ocr-space, openai অথবা browser।');
 if(provider==='browser'||(provider==='ocr-space'&&!env.OCR_SPACE_API_KEY?.trim())||(provider==='openai'&&!env.OPENAI_API_KEY?.trim()))return json({error:'সার্ভার OCR চালাতে OCR_SPACE_API_KEY সেট করুন।',code:'AI_NOT_CONFIGURED'},503);
 const match=String(b.image||'').match(/^data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!match||b.image.length>32000)return json({error:'ক্যাপচা ছবিটি গ্রহণযোগ্য নয়।'},400);
 const bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));if(await imageHash(bytes)!==session.captchaHash)return json({error:'ক্যাপচা সেশনের ছবি মেলেনি।'},400);
 return json(await (provider==='ocr-space'?readWithOCRSpace(b.image,b.source,env):readWithAI(b.image,b.source,env)));
 }
 if(path==='/api/check-status'){
 if(!/^BGD[A-Z0-9]{7,25}$/.test(String(b.applicationId||''))||! /^[A-Z0-9]{5,20}$/.test(String(b.passportNo||'')))return json({error:'Application ID ও Passport Number ঠিক করুন।'},400);if(!/^[\w -]{1,32}$/.test(String(b.captcha||'')))return json({error:'ক্যাপচা লিখুন।'},400);
 const session=await open(b.token,env,request);if(session.source!==b.source)throw new Error('ক্যাপচা উৎস মেলেনি।');const f=session.form;const params=new URLSearchParams(f.fields);params.set(f.app,b.applicationId);if(f.passport)params.set(f.passport,b.passportNo);params.set(f.captcha,b.captcha);const fetched=await remote(f.action,b.source,session.jar,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Referer:f.referer,Origin:SOURCES[b.source].origin},body:params.toString()});const html=await fetched.response.text();try{return json({result:interpret(html,b.source)});}catch(e){e.sourceMessage=sourceExcerpt(html).replaceAll(b.passportNo,'[passport]').replaceAll(b.applicationId,'[application]');e.pageTitle=plain((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');throw e;}
 }return json({error:'Not found'},404);
 }catch(e){return json({error:e.name==='TimeoutError'?'মূল সাইট সময়মতো সাড়া দেয়নি। আবার চেষ্টা করুন।':e.message||'সংযোগ ব্যর্থ হয়েছে।',verified:false,sourceMessage:e.sourceMessage||null,pageTitle:e.pageTitle||null},422);}
}

const page = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

export default {async fetch(request,env){const path=new URL(request.url).pathname;if(path.startsWith("/api/"))return api(request,env,path);if(path!=="/")return new Response("Not found",{status:404});return new Response(page,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net https://tessdata.projectnaptha.com; base-uri 'none'; form-action 'self'"}});}};
