# Gemini আগে, OCR.space ব্যাকআপ — v1.1.5

Gemini-এর image-input API যুক্ত আছে। Default model `gemini-3.5-flash-lite`। এটি ছবি থেকে লেখা পড়ার চেষ্টা করবে; CAPTCHA সঠিক হয়েছে বা মূল সাইট গ্রহণ করবে—এমন নিশ্চয়তা দেয় না। ইউজার ছবির সঙ্গে লেখা মিলিয়ে সংশোধন করে “ঠিক আছে, ফলাফল দেখুন” চাপবেন। মডেল নিজে স্ট্যাটাসের ফর্ম জমা দেয় না।

## নিজের API key নিন

1. https://aistudio.google.com/api-keys খুলে Google account দিয়ে প্রবেশ করুন।
2. প্রয়োজন হলে শর্ত মেনে project বেছে API key তৈরি করুন।
3. Project-এ Free tier আছে কি না এবং model-এর quota আছে কি না AI Studio-তে দেখুন। Free tier-এর ব্যবহার সীমিত; সব account/project-এ একই quota নয়। এই কোড billing বা paid plan চালু করে না।

অক্টোবর ২০২৬-এ Google-এর pricing অনুযায়ী এই model-এর Standard API-তে free input/output আছে। Pricing ও availability বদলাতে পারে। Key frontend, GitHub বা চ্যাটে দেবেন না।

## Vercel-এ বর্তমান সাইট আপডেট

এই ZIP-এর **পুরো project** GitHub-এ update করুন। শুধু `src/index.html` বদলালে Gemini যুক্ত হবে না; নতুন `src/gemini.js` ও অন্য backend/settings ফাইলও লাগবে। নিজের `.env.local` GitHub-এ দেবেন না।

Vercel → Project → Settings → Environment Variables → Production-এ সেট করুন; Preview-তেও চাইলে দিন:

| Name | Value |
|---|---|
| OCR_PROVIDER | `auto` |
| GEMINI_API_KEY | AI Studio থেকে পাওয়া নিজের API key |
| GEMINI_MODEL | `gemini-3.5-flash-lite` |
| OCR_SPACE_API_KEY | ব্যাকআপের জন্য নিজের OCR.space key |
| OCR_SPACE_ENGINE | `2` |

আগের `SESSION_ENCRYPTION_KEY` অপরিবর্তিত রাখুন। `OCR_SPACE_API_KEY` ও `OCR_SPACE_ENGINE` থাকলে রেখে দিন; Gemini ব্যর্থ হলে আগের service ব্যাকআপ হিসেবে ব্যবহার হবে। এই দুটো না থাকলেও Gemini ব্যবহার করা যায়। তারপর **Redeploy** করুন, পেইজ refresh করে নতুন CAPTCHA নিন।

Settings যাচাই করতে নিজের সাইটের `/api/config` খুলুন। `version: "1.1.9"`, `provider: "gemini"`, `configured: true` থাকলে deployment নতুন code এবং key-এর উপস্থিতি পেয়েছে। এটি key-এর বৈধতা, quota বা আসল CAPTCHA পড়ার নির্ভুলতা প্রমাণ করে না। Key response-এ ফেরত আসে না। `OCR_PROVIDER=auto` থাকা অবস্থায়ও `provider` কার্যকর প্রথম service হিসেবে `gemini` দেখাবে।

লোকালি আগে থেকে `.env.local` থাকলে session/login settings রেখে এই পাঁচটি variable রাখুন:

```dotenv
OCR_PROVIDER=auto
GEMINI_API_KEY=YOUR_GEMINI_KEY
GEMINI_MODEL=gemini-3.5-flash-lite
OCR_SPACE_API_KEY=YOUR_OCR_SPACE_KEY
OCR_SPACE_ENGINE=2
```

দুইটি placeholder-এর জায়গায় নিজের key বসাবেন। OCR.space-এর তিনটি লাইন মুছবেন না। পুরোনো `OCR_PROVIDER=ocr-space` থাকলেও v1.1.5-তে Gemini key পাওয়া গেলে Gemini আগে চেষ্টা হয়; নতুন সেটআপে `auto` ব্যবহার করুন।

## লোকালি চালানো

ZIP extract করে `visadesk-vercel` ফোল্ডারের terminal-এ:

```sh
npm install
npm run configure-gemini
npm run doctor
npm run dev
```

Key চাইলে শুধু key paste করে Enter দিন। Input গোপন থাকবে। এই command `.env.local`-এ Gemini নির্বাচন করে; আগে থেকে থাকা session, login এবং OCR.space settings রাখে। খুলুন http://localhost:3000। আগের server চালু থাকলে বন্ধ করে আবার চালান।

## কীভাবে কাজ করে

- BGD ও passport দিলে দুই উৎসের নতুন CAPTCHA প্রস্তুত হয়। মূল ছবি এবং browser-bound session মিললেই server ছবি পড়ার API ডাকে।
- Gemini সম্ভাব্য লেখাটি ঘরে বসায়। বড়/ছোট অক্ষর বদলে বা অক্ষর অনুমান করে পূরণ করা হয় না; অস্পষ্ট লেখা নিশ্চিত হিসেবে ধরা হয় না।
- Gemini আগে চলে। গ্রহণযোগ্য লেখা এবং `ready: true` পেলে সেটিই ব্যবহার হয়; OCR.space ডাকা হয় না। খালি/অগ্রহণযোগ্য বা অস্পষ্ট লেখা, API error, quota limit বা unsupported GIF হলে OCR.space key থাকলে সেটি চেষ্টা করে। দুটো server attempt মিলে সর্বোচ্চ ৪৫ সেকেন্ডের budget; Gemini-তে প্রতি attempt ২৫ সেকেন্ড।
- OCR.space-ও ব্যর্থ বা খালি উত্তর দিলে Gemini-এর আগের অস্পষ্ট লেখাটি থাকলে সংশোধনের জন্য রাখা হয়, `ready: false` থাকে। দুটোতেই ব্যবহারযোগ্য লেখা না থাকলে browser OCR/হাতে লেখার ব্যবস্থা আসে।
- Server পদ্ধতি ব্যর্থ হলে আগের browser OCR ও হাতে লেখার ব্যবস্থা থাকে। শুধু প্রস্তুত হওয়া ছবিটি পড়ার জন্য পাঠানো যায়; arbitrary image upload endpoint নয়।
- Gemini সরাসরি PNG/JPEG/WebP নেয়। GIF হলে OCR.space বা browser পদ্ধতি ব্যবহার হবে; format পরিবর্তনের জন্য session-এর মূল ছবি বদলানো হয় না।
- ইউজার ছবি দেখে মিলিয়ে তারপর ফলাফল আনেন। সাধারণ ইউজারকে provider, key বা technical error দেখানো হয় না।

## সীমা ও তথ্য ব্যবহার

Gemini-তে শুধু CAPTCHA ছবি এবং ছোট transcription নির্দেশনা যায়। BGD, passport number, applicant name, result, source cookie ও session token যায় না। Free tier-এ Google জমা দেওয়া content product improvement-এ ব্যবহার করতে পারে; Google-এর বর্তমান terms/privacy দেখে ব্যবহার করুন। CAPTCHA কখনও ভুল পড়তে পারে; key ছাড়া এই সংস্করণের আসল CAPTCHA accuracy বা আপনার production deployment live পরীক্ষা করা হয়নি।

একটি query-তে সাধারণত দুই উৎসের জন্য দুইটি Gemini request হয়। নতুন ছবি নিলে নতুন request হতে পারে। Account-এর quota দেখুন; model নিজে থেকে পাল্টিয়ে বা paid endpoint-এ গিয়ে সীমা এড়ানোর চেষ্টা হয় না।

## সমস্যা হলে

Network → `track?action=read-captcha` → Response দেখে কোন service উত্তর দিয়েছে বোঝা যায়। Gemini সফল হলে `engine: "gemini-vision"`, `requestedProvider: "gemini"`, `fallback: false` আসে। ব্যাকআপ উত্তর দিলে `engine: "ocr-space"`, `requestedProvider: "gemini"`, `fallback: true` ও `fallbackReason` থাকে। সাধারণ ইউজারের পেইজে এগুলো দেখানো হয় না।

| fallbackReason | Gemini-এর পর ব্যাকআপ চালানোর কারণ |
|---|---|
| OCR_UNCERTAIN | Gemini পাওয়া লেখাটির বিষয়ে অনিশ্চিত ছিল। |
| OCR_NO_TEXT | খালি বা গ্রহণযোগ্য অক্ষরের লেখা ফেরত পাওয়া যায়নি। |
| OCR_LIMIT_REACHED | API limit/quota শেষ বা rate limit হয়েছে। |
| OCR_TIMEOUT / OCR_NETWORK | Gemini সময়মতো সাড়া দেয়নি বা সংযোগ হয়নি। |
| OCR_RESULT_INVALID | গ্রহণযোগ্য JSON উত্তর পাওয়া যায়নি। |
| OCR_IMAGE_REJECTED | ছবির format সরাসরি Gemini নেয় না, যেমন GIF। |

ব্যাকআপেও সমস্যা হলে `fallbackAttempted: true` আসে; Gemini-এর অস্পষ্ট লেখা রাখা গেলে `backupError`-এ ব্যাকআপের সমস্যার code থাকে। এতে key, cookie বা provider-এর raw error ফেরত আসে না।

সাধারণ ইউজারকে হাতে লেখা বা নতুন ছবি নেওয়ার সুযোগ দিন। Admin হিসেবে browser Network-এ `track?action=read-captcha` response-এর code দেখা যায়:

| Code | করণীয় |
|---|---|
| AI_NOT_CONFIGURED | Gemini নির্বাচন করা থাকলে GEMINI_API_KEY সেট করুন; Production environment ও Redeploy দেখুন। |
| OCR_LIMIT_REACHED | AI Studio-তে quota দেখুন; পরে চেষ্টা করুন বা হাতে লিখুন। |
| OCR_ACCESS_DENIED / OCR_KEY_REJECTED | Key-এর project/API restriction ও account access যাচাই করুন। |
| OCR_SETTINGS_INVALID | GEMINI_MODEL ও key সঠিক কি না দেখুন; default model ব্যবহার করুন। ব্যাকআপ service হলে OCR_SPACE_ENGINE-এ 2 বা 3 দিন। |
| OCR_RESULT_INVALID | মডেল পরিষ্কার JSON transcription দেয়নি, উত্তর বন্ধ হয়েছে বা অসম্পূর্ণ। হাতে সংশোধন করুন। |
| OCR_TIMEOUT / OCR_NETWORK / OCR_SERVICE_UNAVAILABLE | API-তে সংযোগ হয়নি বা সময় শেষ হয়েছে; পরে চেষ্টা বা হাতে লিখুন। |
| OCR_IMAGE_REJECTED | Format গ্রহণযোগ্য নয়; GIF হলে OCR.space key রাখুন বা browser/manual পদ্ধতি ব্যবহার করুন। |

শুধু OCR.space ব্যবহার করতে Gemini key খালি করুন এবং `OCR_PROVIDER=auto` রাখুন। `openai` ও `browser` explicit mode আগের মতো আছে। Settings পরিবর্তনের পরে local server restart বা Vercel Redeploy করুন।

Official references:

- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- https://ai.google.dev/gemini-api/docs/api-key
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/image-understanding
- https://ai.google.dev/api/generate-content
