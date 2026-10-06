import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';
import worker from './worker.js';
const compare = (a,b) => timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
const error = (message,status,code='SERVER_SETUP') => new Response(JSON.stringify({error:message,code}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export async function handle(request, env=process.env, path=new URL(request.url).pathname) {
 try {
  // All browser steps use one Vercel function. Legacy URLs remain compatible.
  if(path==='/api/track'){
   const action=new URL(request.url).searchParams.get('action');
   if(!['prepare','read-captcha','check-status','config'].includes(action))return error('অনুরোধের তথ্য গ্রহণযোগ্য নয়।',400,'INVALID_INPUT');
   path='/api/'+action;
  }
  if (!!env.APP_USERNAME !== !!env.APP_PASSWORD) return error('সার্ভারের লগইন সেটআপ অসম্পূর্ণ।',503);
  if(env.APP_USERNAME) {
   const auth=request.headers.get('authorization')||'';
   const decoded=/^Basic /i.test(auth)?Buffer.from(auth.slice(6),'base64').toString('utf8'):'';
   if(!compare(decoded,env.APP_USERNAME+':'+env.APP_PASSWORD))return new Response('Login required',{status:401,headers:{'WWW-Authenticate':'Basic realm="VisaDesk", charset="UTF-8"','Cache-Control':'no-store'}});
  }
  if(path.startsWith('/api/')&&!/^[A-Za-z0-9_-]{43}$/.test(env.SESSION_ENCRYPTION_KEY||''))return error('SESSION_ENCRYPTION_KEY সেট করুন। লোকালি npm run setup চালান।',503);
  if(!['GET','POST','HEAD'].includes(request.method))return error('Method not allowed',405);
  const url=new URL(request.url);url.pathname=path;url.search='';
  const headers=new Headers(request.headers);
  if(path.startsWith('/api/')&&headers.get('origin')&&headers.get('origin')!==url.origin)return error('অনুরোধ গ্রহণযোগ্য নয়।',403,'REQUEST_REJECTED');
  const cookie=(headers.get('cookie')||'').match(/(?:^|;\s*)visadesk_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const session=cookie||randomBytes(32).toString('hex');
  // Never trust client-supplied identity headers.
  headers.delete('oai-authenticated-user-id');headers.set('x-visadesk-session',session);
  let body;
  if(request.method==='POST') {
   body=await request.text();
   if(Buffer.byteLength(body)>40000)return error('Request too large',413);
  }
  const forwarded=new Request(url,{method:request.method==='HEAD'?'GET':request.method,headers,body});
  // The home response establishes the browser cookie, as in the earlier flow.
  // A direct first prepare request is also accepted and receives its cookie.
  const response=await worker.fetch(forwarded,env);
  const out=new Headers(response.headers);out.set('X-Frame-Options','DENY');
  if(!cookie)out.append('Set-Cookie',`visadesk_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${url.protocol==='https:'?'; Secure':''}`);
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:out});
 } catch {return error('সার্ভারে সমস্যা হয়েছে। সেটআপ যাচাই করে আবার চেষ্টা করুন।',500);}
}
