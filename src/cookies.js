// Source cookies stay inside the encrypted token. Names alone are not unique:
// identity is name + domain + path, including when a root cookie is renewed.
function store(jar,url){
 if(!Array.isArray(jar.cookies)){
  const host=new URL(url).hostname;
  const legacy=Object.entries(jar);
  for(const name of Object.keys(jar))delete jar[name];
  jar.cookies=legacy.filter(([,value])=>typeof value==='string').map(([name,value],creation)=>({name,value,domain:host,hostOnly:true,path:'/',secure:false,expires:null,creation}));
  jar.nextId=jar.cookies.length;
 }
 return jar.cookies;
}
const domainMatches=(host,domain)=>host===domain||host.endsWith('.'+domain);
const pathMatches=(path,scope)=>path===scope||path.startsWith(scope)&&(scope.endsWith('/')||path[scope.length]==='/');
function defaultPath(path){const index=path.lastIndexOf('/');return index>0?path.slice(0,index):'/';}
function matching(jar,url){
 const u=new URL(url),now=Date.now();
 const cookies=store(jar,url);
 return cookies.filter(c=>(c.expires===null||c.expires>now)&&(c.hostOnly?c.domain===u.hostname:domainMatches(u.hostname,c.domain))&&pathMatches(u.pathname,c.path)&&(!c.secure||u.protocol==='https:')).sort((a,b)=>b.path.length-a.path.length||a.creation-b.creation);
}
export function cookieHeader(jar,url){return matching(jar,url).map(c=>c.name+'='+c.value).join('; ');}
// Internal only: include cookie identity so duplicate names at different paths
// remain distinguishable. The worker hashes and seals this; raw values never
// become public diagnostics.
export function selectedCookieSnapshot(jar,url,names){
 const cookies=matching(jar,url);
 return Object.fromEntries(names.map(name=>[name,cookies.filter(c=>c.name===name).map(c=>JSON.stringify([c.domain,c.path,c.value])).join('|')]));
}
export function acceptCookies(jar,url,headers){
 const u=new URL(url),cookies=store(jar,url),now=Date.now();
 const values=headers.flatMap(value=>value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/));
 for(const raw of values){
  const parts=raw.split(';'),pair=parts.shift().match(/^\s*([^=;,\s]+)=([^;]*)/);if(!pair)continue;
  const [,name,value]=pair;
  if(!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)||/[\r\n]/.test(value))continue;
  const attrs={};for(const part of parts){const index=part.indexOf('=');attrs[(index<0?part:part.slice(0,index)).trim().toLowerCase()]=index<0?'':part.slice(index+1).trim();}
  const domain=attrs.domain?attrs.domain.replace(/^\./,'').toLowerCase():u.hostname;
  if(!domainMatches(u.hostname,domain)||domain.endsWith('.'))continue;
  const path=attrs.path?.startsWith('/')?attrs.path:defaultPath(u.pathname);
  let expires=null;
  if(attrs.expires&&Number.isFinite(Date.parse(attrs.expires)))expires=Date.parse(attrs.expires);
  if(/^-?\d+$/.test(attrs['max-age']||'')){const seconds=Number(attrs['max-age']);expires=seconds<=0?0:Math.min(8640000000000000,now+seconds*1000);}
  const index=cookies.findIndex(c=>c.name===name&&c.domain===domain&&c.path===path);
  if(expires!==null&&expires<=now){if(index>=0)cookies.splice(index,1);continue;}
  const creation=index>=0?cookies[index].creation:jar.nextId++;
  const cookie={name,value,domain,hostOnly:!attrs.domain,path,secure:Object.hasOwn(attrs,'secure'),expires,creation};
  if(index>=0)cookies[index]=cookie;else cookies.push(cookie);
 }
 // Expired cookies cannot be submitted, including ones expiring during review.
 jar.cookies=cookies.filter(c=>c.expires===null||c.expires>now);
}
// This snapshot is compared locally only; no cookie names/values leave the API.
export function sessionCookieSnapshot(jar,url){
 return matching(jar,url).filter(c=>/^(?:JSESSIONID|PHPSESSID|ASP\.NET_SessionId)$/i.test(c.name)).map(c=>JSON.stringify([c.name,c.domain,c.path,c.value])).sort().join('|');
}
