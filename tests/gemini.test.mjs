import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {handle} from '../src/handler.js';
import {readWithGemini,DEFAULT_GEMINI_MODEL} from '../src/gemini.js';
import {readWithOCRSpace} from '../src/ocr-space.js';
import {readCaptcha} from '../src/worker.js';
import {resolveOCRProvider} from '../src/ocr-config.js';

const savedFetch=globalThis.fetch;
const image='data:image/png;base64,iVBORw==';
const env={SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url'),OCR_PROVIDER:'gemini',GEMINI_API_KEY:'  mock-gemini-private-key  '};
let geminiCalls=0,ocrCalls=0,status=200,ocrStatus=200,ocrText='abcdef',answer={text:'abcdef',uncertain:false},finish='STOP',mode='valid',mime='image/png';
const providerOrder=[];
globalThis.fetch=async(url,options)=>{
 if(String(url).startsWith('https://generativelanguage.googleapis.com/')){
  geminiCalls++;providerOrder.push('gemini');
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/'+DEFAULT_GEMINI_MODEL+':generateContent');
  assert.equal(options.headers['x-goog-api-key'],'mock-gemini-private-key');
  assert.equal(options.redirect,'error');assert(options.signal instanceof AbortSignal);
  assert(!String(url).includes('key='));
  const body=JSON.parse(options.body);
  assert.equal(body.contents[0].parts[1].inlineData.mimeType,'image/png');
  assert.equal(body.contents[0].parts[1].inlineData.data,'iVBORw==');
  assert.equal(body.generationConfig.responseFormat.text.mimeType,'APPLICATION_JSON');
  assert.deepEqual(body.generationConfig.responseFormat.text.schema.required,['text','uncertain']);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'MINIMAL');
  for(const privateValue of ['passportNo','applicationId','token','source-cookie','mock-gemini-private-key','BGDZZ0000000','P00000000'])assert(!options.body.includes(privateValue));
  if(mode==='timeout')throw new DOMException('private-provider-details','TimeoutError');
  if(mode==='network')throw new Error('private-provider-details');
  if(status!==200)return new Response('private-provider-details '+env.GEMINI_API_KEY,{status});
  if(mode==='bad-json')return new Response('private-provider-details');
  if(mode==='blocked')return Response.json({promptFeedback:{blockReason:'SAFETY'}});
  if(mode==='missing')return Response.json({});
  const text=mode==='prose'?'Here is the code: abcdef':JSON.stringify(answer);
  return Response.json({candidates:[{finishReason:finish,content:{parts:[{thought:true,text:'Ignore this reasoning summary.'},{text}]}}]});
 }
 if(url==='https://api.ocr.space/parse/image'){
  ocrCalls++;providerOrder.push('ocr-space');assert.equal(options.headers.apikey,'mock-ocr-key');assert(options.signal instanceof AbortSignal);
  assert.equal(options.body.get('base64Image'),'data:'+mime+';base64,iVBORw==');
  if(ocrStatus!==200)return Response.json({ErrorMessage:'private provider detail and private account key'},{status:ocrStatus});
  return Response.json({IsErroredOnProcessing:false,OCRExitCode:1,ParsedResults:[{FileParseExitCode:1,ParsedText:ocrText}]});
 }
 if(new URL(url).pathname==='/captcha.php')return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':mime}});
 return new Response('<form method="post"><input name="appref1"><input name="captcha"><img src="captcha.php"></form>',{headers:{'Set-Cookie':'source-cookie=private; Path=/'}});
};
const call=(path,body,cookie='',settings=env)=>handle(new Request('https://demo.test'+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)}),settings);
try{
 let result=await readWithGemini(image,'ivac',env);assert.equal(result.text,'abcdef');assert(result.ready);
 answer={text:'aB9dE2',uncertain:false};result=await readWithGemini(image,'visa',env);assert.equal(result.text,'aB9dE2');assert(result.ready);
 answer.uncertain=true;result=await readWithGemini(image,'visa',env);assert.equal(result.text,'aB9dE2');assert(!result.ready);
 for(const invalid of [{text:'a-b-c',uncertain:false},{text:'abcdefg',uncertain:false},{text:'aB9dE2',uncertain:'false'},{text:'aB9dE2',uncertain:false,extra:'guess'},null]){
  answer=invalid;
  try{result=await readWithGemini(image,'visa',env);assert.equal(result.text,'');assert(!result.ready);}
  catch(error){assert.equal(error.code,'OCR_RESULT_INVALID');}
 }
 answer={text:'Abcdef',uncertain:false};result=await readWithGemini(image,'ivac',env);assert.equal(result.text,'');assert(!result.ready);
 answer={text:'abcdef',uncertain:false};
 for(const [code,http] of [['OCR_LIMIT_REACHED',429],['OCR_KEY_REJECTED',401],['OCR_ACCESS_DENIED',403],['OCR_SETTINGS_INVALID',400],['OCR_SETTINGS_INVALID',404],['OCR_SERVICE_UNAVAILABLE',503]]){
  status=http;await assert.rejects(()=>readWithGemini(image,'ivac',env),error=>error.code===code&&!error.message.includes('private-provider-details')&&!error.message.includes(env.GEMINI_API_KEY.trim()));
 }
 status=200;
 for(mode of ['timeout','network','bad-json','blocked','missing','prose'])await assert.rejects(()=>readWithGemini(image,'ivac',env),error=>['OCR_TIMEOUT','OCR_NETWORK','OCR_RESULT_INVALID'].includes(error.code)&&!error.message.includes('private-provider-details'));
 mode='valid';finish='MAX_TOKENS';await assert.rejects(()=>readWithGemini(image,'ivac',env),error=>error.code==='OCR_RESULT_INVALID');finish='STOP';
 let before=geminiCalls;
 for(const settings of [{...env,GEMINI_API_KEY:' '},{...env,GEMINI_MODEL:'../other?key=secret'},{...env,GEMINI_MODEL:'https://other.invalid/model'}])await assert.rejects(()=>readWithGemini(image,'ivac',settings));
 await assert.rejects(()=>readWithGemini('data:image/gif;base64,iVBORw==','ivac',env),error=>error.code==='OCR_IMAGE_REJECTED');assert.equal(geminiCalls,before);
 const stopped=new AbortController();stopped.abort();
 await assert.rejects(()=>readWithGemini(image,'ivac',env,{signal:stopped.signal}),error=>error.code==='OCR_TIMEOUT');
 await assert.rejects(()=>readWithOCRSpace(image,'ivac',{OCR_SPACE_API_KEY:'mock-ocr-key'},{signal:stopped.signal}),error=>error.code==='OCR_TIMEOUT');assert.equal(geminiCalls,before);assert.equal(ocrCalls,0);
 let response=await handle(new Request('https://demo.test/api/config'),env);let config=await response.json();assert.equal(config.provider,'gemini');assert(config.configured);assert(!JSON.stringify(config).includes(env.GEMINI_API_KEY.trim()));
 config=await (await handle(new Request('https://demo.test/api/config'),{SESSION_ENCRYPTION_KEY:env.SESSION_ENCRYPTION_KEY,GEMINI_API_KEY:env.GEMINI_API_KEY})).json();assert.equal(config.provider,'gemini');
 config=await (await handle(new Request('https://demo.test/api/config'),{...env,OCR_PROVIDER:'ocr-space',OCR_SPACE_API_KEY:'mock-ocr-key'})).json();assert.equal(config.provider,'gemini');assert(config.configured);
 for(const selected of [undefined,'auto','ocr-space','gemini',' OCR-SPACE '])assert.equal(resolveOCRProvider({...env,OCR_PROVIDER:selected,OCR_SPACE_API_KEY:'mock-ocr-key'}),'gemini');
 assert.equal(resolveOCRProvider({OCR_PROVIDER:'auto',OCR_SPACE_API_KEY:'mock-ocr-key',GEMINI_API_KEY:'  '}),'ocr-space');
 assert.equal(resolveOCRProvider({OCR_PROVIDER:'browser',GEMINI_API_KEY:'mock-key'}),'browser');
 assert.equal(resolveOCRProvider({OCR_PROVIDER:'openai',GEMINI_API_KEY:'mock-key'}),'openai');
 assert.equal(resolveOCRProvider({OCR_PROVIDER:'unknown-private-setting'}),'invalid');
 response=await call('/api/track?action=prepare',{source:'ivac'});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];const prepared=await response.json();
 const body={source:'ivac',token:prepared.token,image:prepared.captcha,applicationId:'BGDZZ0000000',passportNo:'P00000000'};
 response=await call('/api/track?action=read-captcha',body,cookie);assert.equal(response.status,200);result=await response.json();assert.equal(result.text,'abcdef');assert(result.ready);
 before=geminiCalls;
 response=await call('/api/read-captcha',{...body,image:'data:image/png;base64,YWJj'},cookie);assert.equal(response.status,400);
 response=await call('/api/read-captcha',body);assert.equal(response.status,409);
 response=await call('/api/read-captcha',{...body,source:'visa'},cookie);assert.equal(response.status,409);assert.equal(geminiCalls,before);
 response=await call('/api/read-captcha',body,cookie,{...env,GEMINI_API_KEY:''});assert.equal(response.status,503);assert.equal((await response.json()).code,'AI_NOT_CONFIGURED');assert.equal(geminiCalls,before);
 status=429;response=await call('/api/read-captcha',body,cookie);assert.equal(response.status,503);result=await response.json();assert.equal(result.code,'OCR_LIMIT_REACHED');assert(!JSON.stringify(result).includes('private-provider-details'));
 const bothKeys={...env,OCR_PROVIDER:'ocr-space',OCR_SPACE_API_KEY:'mock-ocr-key'};
 providerOrder.length=0;
 response=await call('/api/read-captcha',body,cookie,bothKeys);assert.equal(response.status,200);result=await response.json();assert.equal(result.engine,'ocr-space');assert(result.ready);assert.equal(ocrCalls,1);assert(result.fallback);assert.equal(result.requestedProvider,'gemini');assert.equal(result.fallbackReason,'OCR_LIMIT_REACHED');assert.deepEqual(providerOrder,['gemini','ocr-space']);
 status=200;providerOrder.length=0;
 response=await call('/api/read-captcha',body,cookie,bothKeys);result=await response.json();assert.equal(result.engine,'gemini-vision');assert.equal(result.fallback,false);assert.equal(ocrCalls,1);assert.deepEqual(providerOrder,['gemini']);
 answer.uncertain=true;providerOrder.length=0;
 response=await call('/api/read-captcha',body,cookie,bothKeys);result=await response.json();assert(result.ready);assert.equal(result.text,'abcdef');assert.equal(result.engine,'ocr-space');assert.equal(result.fallbackReason,'OCR_UNCERTAIN');assert.equal(ocrCalls,2);assert.deepEqual(providerOrder,['gemini','ocr-space']);
 ocrStatus=429;
 response=await call('/api/read-captcha',body,cookie,bothKeys);result=await response.json();assert.equal(response.status,200);assert.equal(result.engine,'gemini-vision');assert(!result.ready);assert.equal(result.text,'abcdef');assert.equal(result.fallback,false);assert(result.fallbackAttempted);assert.equal(result.backupError,'OCR_LIMIT_REACHED');
 ocrStatus=200;ocrText='???';
 response=await call('/api/read-captcha',body,cookie,bothKeys);result=await response.json();assert.equal(result.engine,'gemini-vision');assert(!result.ready);assert.equal(result.text,'abcdef');assert.equal(result.backupError,'OCR_NO_TEXT');
 ocrText='abcdef';answer={text:'',uncertain:true};
 response=await call('/api/read-captcha',body,cookie,bothKeys);result=await response.json();assert.equal(result.engine,'ocr-space');assert(result.ready);assert.equal(result.fallbackReason,'OCR_NO_TEXT');
 answer={text:'???',uncertain:false};
 response=await call('/api/read-captcha',body,cookie,bothKeys);result=await response.json();assert.equal(result.engine,'ocr-space');assert.equal(result.fallbackReason,'OCR_NO_TEXT');
 answer={text:'abcdef',uncertain:false};
 for(const [condition,http] of [['timeout',200],['network',200],['blocked',200],['bad-json',200],['valid',503]]){
  mode=condition;status=http;providerOrder.length=0;
  response=await call('/api/read-captcha',body,cookie,bothKeys);result=await response.json();assert.equal(response.status,200);assert.equal(result.engine,'ocr-space');assert(result.fallback);assert.deepEqual(providerOrder,['gemini','ocr-space']);
 }
 mode='valid';status=429;ocrStatus=429;
 response=await call('/api/read-captcha',body,cookie,bothKeys);result=await response.json();assert.equal(response.status,503);assert.equal(result.code,'OCR_LIMIT_REACHED');assert(result.fallbackAttempted);assert.equal(result.fallbackReason,'OCR_LIMIT_REACHED');assert(!JSON.stringify(result).includes('private'));
 status=200;ocrStatus=200;providerOrder.length=0;
 await assert.rejects(()=>readCaptcha(image,'ivac',bothKeys,'gemini',stopped.signal),error=>error.code==='OCR_TIMEOUT');assert.deepEqual(providerOrder,[]);
 response=await call('/api/read-captcha',body,cookie,{...bothKeys,OCR_PROVIDER:'auto',GEMINI_API_KEY:' '});result=await response.json();assert.equal(response.status,200);assert.equal(result.engine,'ocr-space');assert.deepEqual(providerOrder,['ocr-space']);
 mime='image/gif';response=await call('/api/prepare',{source:'ivac'});const gif=await response.json();const gifCookie=response.headers.get('set-cookie').split(';')[0];before=geminiCalls;
 response=await call('/api/read-captcha',{source:'ivac',token:gif.token,image:gif.captcha},gifCookie,bothKeys);assert.equal(response.status,200);result=await response.json();assert.equal(result.engine,'ocr-space');assert.equal(result.fallbackReason,'OCR_IMAGE_REJECTED');assert.equal(geminiCalls,before);
}finally{globalThis.fetch=savedFetch;}
console.log('PASS: Gemini-first selection with both keys/legacy settings, sequential success/uncertain/empty/quota/error fallback, preserved uncertain candidates, safe reasons, shared abort, image/session binding and GIF backup (mocked).');
