export class OCRSpaceError extends Error{
 constructor(code,retryable=true){super('ছবির লেখাটি নিজে লিখে মিলিয়ে নিন।');this.name='OCRSpaceError';this.code=code;this.retryable=retryable;}
}
function providerFailure(data,status=200){
 // Inspect only to classify; never return or log upstream account details.
 const detail=[data?.ErrorMessage,data?.ErrorDetails,...(Array.isArray(data?.ParsedResults)?data.ParsedResults.flatMap(r=>[r.ErrorMessage,r.ErrorDetails]):[])].flat().filter(v=>typeof v==='string').join(' ');
 if(status===401||/(?:api\s*key|apikey).{0,40}(?:invalid|expired|not\s+valid|not\s+found)|invalid.{0,30}(?:api\s*key|apikey)|unauthori[sz]ed/i.test(detail))return new OCRSpaceError('OCR_KEY_REJECTED',false);
 if(status===429||/rate.?limit|quota|too\s+many|limit.{0,45}(?:reach|exceed)|(?:reach|exceed).{0,45}limit|maximum.{0,35}(?:request|conversion)/i.test(detail))return new OCRSpaceError('OCR_LIMIT_REACHED',false);
 if(status===403)return new OCRSpaceError('OCR_ACCESS_DENIED',false);
 if(/time.?out|timed\s+out/i.test(detail)||(Array.isArray(data?.ParsedResults)&&data.ParsedResults.some(r=>Number(r.FileParseExitCode)===-20)))return new OCRSpaceError('OCR_TIMEOUT');
 if([413,415].includes(status)||/base64|(?:invalid|unsupported|corrupt).{0,25}(?:image|file)|(?:image|file).{0,25}(?:invalid|unsupported|corrupt)/i.test(detail))return new OCRSpaceError('OCR_IMAGE_REJECTED');
 if(/(?:invalid|unsupported).{0,25}engine|engine.{0,30}(?:invalid|unsupported|not\s+supported)/i.test(detail))return new OCRSpaceError('OCR_SETTINGS_INVALID',false);
 return new OCRSpaceError('OCR_SERVICE_UNAVAILABLE');
}
export async function readWithOCRSpace(image,source,env){
 const engine=String(env.OCR_SPACE_ENGINE||'2').trim();
 if(!['2','3'].includes(engine))throw new OCRSpaceError('OCR_SETTINGS_INVALID',false);
 const form=new FormData();form.set('base64Image',image);form.set('language','eng');form.set('OCREngine',engine);form.set('scale','true');form.set('isOverlayRequired','false');form.set('isCreateSearchablePdf','false');
 let response;
 try{response=await fetch('https://api.ocr.space/parse/image',{method:'POST',headers:{apikey:env.OCR_SPACE_API_KEY.trim()},body:form,signal:AbortSignal.timeout(25000)});}catch(e){throw new OCRSpaceError(['AbortError','TimeoutError'].includes(e?.name)?'OCR_TIMEOUT':'OCR_NETWORK');}
 let data;try{data=await response.json();}catch{throw providerFailure(null,response.status);}
 if(!response.ok)throw providerFailure(data,response.status);
 if(!data||typeof data!=='object')throw providerFailure(null,response.status);
 // Never echo upstream error bodies: they may include account or request details.
 if(data.IsErroredOnProcessing||Number(data.OCRExitCode)!==1)throw providerFailure(data);
 if(!Array.isArray(data.ParsedResults)||data.ParsedResults.length!==1||Number(data.ParsedResults[0].FileParseExitCode)!==1)throw providerFailure(data);
 const raw=data.ParsedResults[0].ParsedText;
 const text=typeof raw==='string'?raw.replace(/\s+/g,''):'';
 const valid=source==='visa'?/^[A-Za-z0-9]{6}$/.test(text):/^[a-z]{3,20}$/.test(text);
 // A plausible transcription is an attempt, not proof that the CAPTCHA is correct.
 return {text:valid?text:'',ready:valid,engine:'ocr-space',ocrEngine:Number(engine)};
}
