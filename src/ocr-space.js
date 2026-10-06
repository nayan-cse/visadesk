export async function readWithOCRSpace(image,source,env){
 const engine=String(env.OCR_SPACE_ENGINE||'2');
 if(!['2','3'].includes(engine))throw new Error('OCR_SPACE_ENGINE হবে 2 অথবা 3।');
 const form=new FormData();form.set('base64Image',image);form.set('language','eng');form.set('OCREngine',engine);form.set('scale','true');form.set('isOverlayRequired','false');form.set('isCreateSearchablePdf','false');
 let response;
 try{response=await fetch('https://api.ocr.space/parse/image',{method:'POST',headers:{apikey:env.OCR_SPACE_API_KEY.trim()},body:form,signal:AbortSignal.timeout(25000)});}catch{throw new Error('OCR.space সময়মতো সাড়া দেয়নি। ক্যাপচা নিজে লিখুন।');}
 if(!response.ok){await response.body?.cancel();throw new Error('OCR.space HTTP '+response.status+' দিয়েছে। API key ও quota যাচাই করুন।');}
 let data;try{data=await response.json();}catch{throw new Error('OCR.space গ্রহণযোগ্য ফলাফল দেয়নি।');}
 // Never echo upstream error bodies: they may include account or request details.
 if(data.IsErroredOnProcessing||Number(data.OCRExitCode)!==1)throw new Error('OCR.space ছবিটি পড়তে পারেনি। API key, quota বা engine পরিবর্তন করে দেখুন।');
 if(!Array.isArray(data.ParsedResults)||data.ParsedResults.length!==1||Number(data.ParsedResults[0].FileParseExitCode)!==1)throw new Error('OCR.space ক্যাপচাটির পূর্ণ ফলাফল দেয়নি।');
 const raw=data.ParsedResults[0].ParsedText;
 const text=typeof raw==='string'?raw.replace(/\s+/g,''):'';
 const valid=source==='visa'?/^[A-Za-z0-9]{6}$/.test(text):/^[a-z]{3,20}$/.test(text);
 // A plausible transcription is an attempt, not proof that the CAPTCHA is correct.
 return {text:valid?text:'',ready:valid,engine:'ocr-space',ocrEngine:Number(engine)};
}
