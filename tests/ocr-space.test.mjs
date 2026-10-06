import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {handle} from '../src/handler.js';
import {readWithOCRSpace} from '../src/ocr-space.js';
const savedFetch=globalThis.fetch;
const env={SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url'),OCR_SPACE_API_KEY:'mock-key',OCR_PROVIDER:'ocr-space'};
let text='abC12d\r\n',failure=false,calls=0,expectedEngine='2';
globalThis.fetch=async(url,options)=>{
 if(url==='https://api.ocr.space/parse/image'){
  calls++;assert.equal(options.headers.apikey,'mock-key');assert(options.body instanceof FormData);assert.equal(options.body.get('OCREngine'),expectedEngine);assert.equal(options.body.get('scale'),'true');assert(options.body.get('base64Image').startsWith('data:image/png;base64,'));assert(!options.body.has('passportNo'));assert(!options.body.has('token'));
  return Response.json(failure?{IsErroredOnProcessing:true,OCRExitCode:4,ErrorMessage:'secret account detail'}:{IsErroredOnProcessing:false,OCRExitCode:1,ParsedResults:[{FileParseExitCode:1,ParsedText:text}]});
 }
 if(url.endsWith('captcha.php'))return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});
 return new Response('<form method="post"><input name="appref1"><input name="captcha"><img src="captcha.php"></form>');
};
const image='data:image/png;base64,iVBORw==';
let answer=await readWithOCRSpace(image,'visa',env);assert.equal(answer.text,'abC12d');assert(answer.ready);
text='a?b123';answer=await readWithOCRSpace(image,'visa',env);assert(!answer.ready);assert.equal(answer.text,'');
text='abcdef\n';expectedEngine='3';answer=await readWithOCRSpace(image,'ivac',{...env,OCR_SPACE_ENGINE:'3'});assert(answer.ready);assert.equal(answer.ocrEngine,3);expectedEngine='2';
const call=(path,body,cookie='')=>handle(new Request('https://demo.test'+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)}),env);
let r=await call('/api/prepare',{source:'ivac'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();assert.equal(data.captcha,'data:image/png;base64,iVBORw==');
r=await call('/api/read-captcha',{source:'ivac',token:data.token,image:data.captcha},cookie);assert.equal(r.status,200);assert.equal((await r.json()).engine,'ocr-space');
const before=calls;r=await call('/api/read-captcha',{source:'ivac',token:data.token,image:'data:image/png;base64,YWJj'},cookie);assert.equal(r.status,400);assert.equal(calls,before);
failure=true;await assert.rejects(()=>readWithOCRSpace(image,'ivac',env),e=>e.code==='OCR_SERVICE_UNAVAILABLE'&&!e.message.includes('secret account detail'));
// Provider failures are classified without echoing their account/error bodies.
for(const [status,payload,code] of [
 [401,{ErrorMessage:'private key invalid'},'OCR_KEY_REJECTED'],
 [403,{ErrorMessage:'private access denial'},'OCR_ACCESS_DENIED'],
 [429,{ErrorMessage:'private account quota'},'OCR_LIMIT_REACHED'],
 [200,{IsErroredOnProcessing:true,OCRExitCode:4,ErrorMessage:['API key invalid: private-key']},'OCR_KEY_REJECTED'],
 [200,{IsErroredOnProcessing:true,OCRExitCode:4,ErrorMessage:['The daily rate limit has been exceeded. private detail']},'OCR_LIMIT_REACHED'],
 [200,{IsErroredOnProcessing:true,OCRExitCode:4,ErrorMessage:['Invalid base64 image: private detail']},'OCR_IMAGE_REJECTED'],
 [200,{IsErroredOnProcessing:true,OCRExitCode:4,ParsedResults:[{FileParseExitCode:-20}]},'OCR_TIMEOUT'],
 [200,{IsErroredOnProcessing:true,OCRExitCode:4,ParsedResults:{}},'OCR_SERVICE_UNAVAILABLE'],
 [200,null,'OCR_SERVICE_UNAVAILABLE']
]){
 globalThis.fetch=async()=>Response.json(payload,{status});
 await assert.rejects(()=>readWithOCRSpace(image,'visa',env),e=>e.code===code&&!e.message.includes('private'));
 r=await call('/api/read-captcha',{source:'ivac',token:data.token,image:data.captcha},cookie);assert.equal(r.status,503);const result=await r.json();assert.equal(result.code,code);assert(!JSON.stringify(result).includes('private'));
}
globalThis.fetch=async()=>{throw Object.assign(new Error('private network detail'),{name:'TimeoutError'});};
await assert.rejects(()=>readWithOCRSpace(image,'visa',env),e=>e.code==='OCR_TIMEOUT');
await assert.rejects(()=>readWithOCRSpace(image,'visa',{...env,OCR_SPACE_ENGINE:'unknown'}),e=>e.code==='OCR_SETTINGS_INVALID');
globalThis.fetch=async(url,options)=>{assert.equal(options.body.get('OCREngine'),'2');return Response.json({OCRExitCode:1,ParsedResults:[{FileParseExitCode:1,ParsedText:'AbC123'}]});};
assert((await readWithOCRSpace(image,'visa',{...env,OCR_SPACE_ENGINE:' 2 '})).ready);
globalThis.fetch=savedFetch;
console.log('PASS: OCR.space form/header, engine selection, text validation, provider routing, bound image and safe errors (mocked).');
