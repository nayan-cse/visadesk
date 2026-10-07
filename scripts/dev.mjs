import {createServer} from 'node:http';
import {handle} from '../src/handler.js';
import {loadLocalEnv} from './env.mjs';
const {env}=loadLocalEnv();
const port=Number(env.PORT||3000);
createServer(async(req,res)=>{
 try {
  const chunks=[];let bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>40000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
  const headers=new Headers();for(const [name,value]of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(', '):value);
  // Local origin is fixed; forwarded headers cannot override it.
  const url=new URL(req.url,`http://localhost:${port}`);
  const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await handle(request,env);
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Server error');}
}).listen(port,'127.0.0.1',()=>console.log(`VisaDesk: http://localhost:${port} — OCR.space key: ${env.OCR_SPACE_API_KEY?.trim()?'SET':'NOT SET'} — Gemini key: ${env.GEMINI_API_KEY?.trim()?'SET':'NOT SET'}`));
