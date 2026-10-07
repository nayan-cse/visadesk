// Shared by the server and local diagnostics so both show the same selection.
export function resolveOCRProvider(env){
 const selected=env.OCR_PROVIDER?.trim().toLowerCase()||'auto';
 if(!['auto','gemini','ocr-space','openai','browser'].includes(selected))return 'invalid';
 if(selected==='browser'||selected==='openai')return selected;
 // Older .env.local files defaulted to ocr-space. A Gemini key now enables
 // Gemini first without requiring the owner to delete the backup settings.
 if(env.GEMINI_API_KEY?.trim())return 'gemini';
 if(selected==='gemini')return 'gemini';
 if(env.OCR_SPACE_API_KEY?.trim()||selected==='ocr-space')return 'ocr-space';
 return env.OPENAI_API_KEY?.trim()?'openai':'browser';
}

export function ocrConfigured(env,provider){
 const name={gemini:'GEMINI_API_KEY','ocr-space':'OCR_SPACE_API_KEY',openai:'OPENAI_API_KEY'}[provider];
 return !!name&&!!env[name]?.trim();
}
