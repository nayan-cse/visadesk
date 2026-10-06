# VisaDesk — সহজ Visa ও IVAC Tracker

Node.js 22+ দিয়ে লোকালি চালানো এবং Vercel-এ deployment-এর জন্য সম্পূর্ণ কোড।

## দ্রুত শুরু

ZIP extract করে `visadesk-vercel` ফোল্ডারে terminal খুলুন:

```sh
npm install
npm run configure-ocr
npm run doctor
npm run dev
```

Key চাইলে OCR.space-এর ইমেইল থেকে শুধু key paste করে Enter দিন। গোপন input হওয়ায় key দেখা যাবে না। তারপর http://localhost:3000 খুলুন। বিস্তারিত `START_HERE.md`-তে আছে। আগে server চালু থাকলে Ctrl+C দিয়ে বন্ধ করে আবার চালান।

## এই সংস্করণের পরিবর্তন

**v1.1.3 — Visa CAPTCHA সেশন সংশোধন**

- মূল সাইটের এক `Set-Cookie` header-এ একাধিক cookie এলে এখন প্রতিটি cookie রাখা হয়। `Expires` তারিখের কমা cookie আলাদা করার সময় অক্ষুণ্ণ থাকে। আগে কিছু cookie বাদ পড়ে যেতে পারত।
- CAPTCHA আনা, লেখা পড়া ও ফলাফল চেক এখন একই `/api/track` Vercel function দিয়ে হয়। পুরোনো API URL-গুলোও কাজ করে। একই function ব্যবহার হলেও Vercel-এ একই instance বা outbound IP নিশ্চিত হয় না।
- Visa CAPTCHA-র ছবিতে মূল সাইটের নিজের refresh পদ্ধতির মতো নতুন `rand` যুক্ত হয় এবং cache এড়িয়ে ছবি চাওয়া হয়।
- CAPTCHA প্রত্যাখ্যাত হলে বার্তা সরাসরি ইউজারের লেখাকে ভুল বলে না। সঠিক লেখা থাকলেও source session হারালে প্রত্যাখ্যান হতে পারে।
- আগের ডিজাইন, OCR fallback, শতাংশ, নিচের চার ধাপ, night mode, suggestions ও PNG save রাখা হয়েছে। নতুন `api/track.js`-সহ পুরো project deploy করুন।
- Cookie regression test আগের v1.1.2-তে ব্যর্থ এবং এই সংস্করণে সফল। আপনার Vercel-এ নতুন সংস্করণ live পরীক্ষা হয়নি; production সমস্যার একমাত্র কারণ এই cookie সমস্যা ছিল বলে নিশ্চিত করা যায়নি।

- IVAC ট্র্যাকার এখন বড় শতাংশ, চার ভাগের animated progress bar ও বর্তমান ধাপের highlight দেখায়। প্রগ্রেসের নিচে চারটি ধাপ বাংলা নাম, ছোট ব্যাখ্যা ও status badge-সহ সবসময় দেখা যায়। বড় স্ক্রিনে দুই কলাম, মোবাইলে এক কলাম। PNG ছবিতেও progress bar ও চার ধাপ আছে। শুধু source-confirmed Done rows থেকেই ২৫% / ৫০% / ৭৫% / ১০০% হিসাব হয়।

**v1.1.2 — deployed OCR ও CSP সংশোধন**

- CSP-এর `connect-src`-এ `data:` আছে, যাতে browser OCR-এর embedded WebAssembly লোড হয়। অন্য সব উৎসের অনুমতির সীমা রাখা হয়েছে।
- সার্ভারের OCR ব্যর্থ হলে বা খালি লেখা দিলে browser OCR চেষ্টা করে। ফলাফল দেখার আগে ইউজারকে ছবির সঙ্গে লেখা মিলিয়ে নিশ্চিত করতে হয়।
- CAPTCHA ছবিতে standard padded Base64 ব্যবহার করা হয়েছে; encrypted token-এর encoding অপরিবর্তিত।
- সার্ভারের OCR key, limit, timeout, network ও image errors আলাদা safe code দেয়। এসব provider তথ্য বা technical error UI-তে দেখানো হয় না; custom server logs-ও নেই।
- ডিজাইন, বড় ফলাফল কার্ড, শতাংশ, নিচের চার ধাপ, loading progress, night mode, suggestions ও PNG save রাখা হয়েছে।

**v1.1.1 — আগের সরাসরি ফ্লো ও Vercel compatibility**

- নতুন custom server logging ও request ID সরানো হয়েছে। ট্র্যাকার চালাতে আলাদা logging service বা log file লাগে না।
- বাধ্যতামূলক `/api/config` চেক বাদ দেওয়া হয়েছে। আগের মতো পেইজ খুললেই browser session তৈরি হয়; সরাসরি CAPTCHA প্রস্তুতের প্রথম অনুরোধও গ্রহণ করা হয়।
- Vercel-এর included HTML project root থেকে প্রয়োজনের সময় পড়া হয়; API চালু হওয়ার সময় HTML পড়ার কারণে পুরো function ব্যর্থ হবে না।
- নতুন ডিজাইন, চার ধাপের কার্ড, source-confirmed শতাংশ, loading progress, বাংলা ব্যাখ্যা, night mode, suggestions ও PNG save রাখা হয়েছে।

**আগের প্রোডাকশন সংশোধনও রয়েছে**

- ফলাফল থাকা অবস্থায় সাধারণ “valid captcha / correct code” নির্দেশনাকে ভুল ক্যাপচা হিসেবে ধরা হয় না।
- ভুল ক্যাপচা, মেয়াদ শেষ হওয়া সেশন, মূল সাইটের ধীর/ব্যর্থ সংযোগ এবং ফলাফল না ফেরত দেওয়া—প্রতিটির আলাদা বাংলা বার্তা আছে।
- source requests-এর মোট budget ৪৫ সেকেন্ড। ব্যর্থ GET একবার retry হতে পারে; CAPTCHA জমা দেওয়ার POST নিজে থেকে replay হয় না।
- Visa CAPTCHA-তে browser OCR বড়/ছোট অক্ষর বজায় রাখে; মোবাইল keyboard-এর auto-capitalization বন্ধ।
- একটি উৎসের সফল ফলাফল রেখেই ব্যর্থ উৎসে নতুন ছবি নিয়ে আবার নিশ্চিত করা যায়।
- পুরোনো production আপডেটের জন্য পুরো package deploy করুন। শুধু `src/index.html` বদলালে backend fix আসবে না। `PRODUCTION_FIXES.md` পড়ুন।

- পরিমার্জিত indigo/cyan ডিজাইন, নরম gradient background এবং night mode।
- আগে চেক করা সর্বশেষ ৮টি BGD/passport জোড়া browser-এ থাকে। দুই ইনপুটের যেকোনোটিতে focus/typing করলে সাজেশন দেখায়। বেছে নিলে দুই ঘর পূরণ হয়; নিজে CAPTCHA নিশ্চিত না করা পর্যন্ত নতুন query হয় না।
- প্রতিটি সাজেশনের × দিয়ে একটি জোড়া মুছুন, “সব মুছুন” দিয়ে সব জোড়া সরান। শুধু BGD/passport রাখা হয়; applicant name, result, source cookie, session token বা key রাখা হয় না।

- নতুন teal ও navy ডিজাইন, হালকা/নাইট মোডের বাটন। প্রথমে ডিভাইসের রঙের পছন্দ অনুযায়ী মোড আসে; বাটন দিয়ে বদলানো যায়।
- ছবি আনা, লেখা পড়া এবং স্ট্যাটাস চেকের সম্পন্ন কাজ অনুযায়ী লোডিং প্রগ্রেস বার। এটি চেকের কাজের অগ্রগতি; নিচের IVAC শতাংশ পাসপোর্টের সম্পন্ন ধাপ বোঝায়।
- নাইট মোডেও ক্যাপচা ছবির আসল রঙ রাখা হয়। PNG ছবি আগের পরিষ্কার light design-এ সেভ হয়।

- মূল সাইটের নিচের লিংক সরানো হয়েছে। “BGD / পাসপোর্ট বদলান” আগের নম্বরসহ ইনপুট ফর্ম খুলবে; “ঘর খালি করুন” ইনপুট মুছবে।
- Vercel-এর পূর্ণ নির্দেশনা `VERCEL_GUIDE.md`-তে আছে।

- ফলাফল, ট্র্যাকারের ধাপ ও ব্যাখ্যার ফন্ট বড় করা হয়েছে। PNG-তেও বড় ফন্ট, সম্পন্ন ধাপের শতাংশ ও প্রগ্রেস বার আছে। শতাংশ শুধু মূল উৎসের চার ধাপের Done তথ্য থাকলে দেখানো হয়।

- ফলাফল দেখানোর সময় বড় hero ও stepper লুকায়, ফলে ফলাফল ওপরেই দেখা যায়।
- “ছবি সেভ করুন” বাটনে দুই উৎসের ফলাফল, বাংলা অর্থ, BGD ও যাচাইয়ের সময়সহ PNG ডাউনলোড হয়। ছবিটি browser canvas-এ তৈরি হয়; কোনো image service-এ ফলাফল পাঠানো হয় না। পাসপোর্ট নম্বর ছবিতে যুক্ত হয় না।

- নতুন নীল ও সবুজ কমপ্যাক্ট কার্ড ডিজাইন, বড় touch controls এবং মোবাইলে এক কলামের লেআউট।
- নতুন তিন ধাপের ডিজাইন: আবেদনের তথ্য → ক্যাপচা যাচাই → ফলাফল।
- ক্যাপচার ছবি ও পড়া লেখা পাশাপাশি দেখায়। ইউজার লেখাটি ঠিক করে নিশ্চিত করার পরেই status query হয়।
- মেয়াদ শেষ বা ভুল ক্যাপচায় নতুন ছবি আবার নিশ্চিত করতে হয়; স্বয়ংক্রিয়ভাবে পুনরায় submit হয় না।
- বড় ফলাফল কার্ড এবং Granted but Not-Printed-এর স্পষ্ট বাংলা ব্যাখ্যা।
- চার ধাপের visual milestone tracker, বাংলা ধাপের ব্যাখ্যা এবং source-confirmed progress।
- অনুমোদন, প্রিন্ট বাকি, প্রক্রিয়া চলমান, কেন্দ্রে গ্রহণ, সংগ্রহের জন্য প্রস্তুত ও হস্তান্তর সম্পন্ন—সব শনাক্ত করা স্ট্যাটাসের বাংলা অর্থ। অপরিচিত স্ট্যাটাসে মূল লেখা দেখিয়ে স্পষ্ট জানাবে নির্দিষ্ট ব্যাখ্যা এখনো নেই।
- Loading state, passport দেখানো/লুকানো এবং নম্বর পরিবর্তনের button।
- ফলাফলের ইতিহাস, import/export নেই। পুরোনো `visadesk.records` ও `visadesk.history` মুছে যায়। `visadesk.recentInputs`-এ শুধু সর্বশেষ নম্বরের জোড়া থাকে। ফলাফল reload করলে সরে যায়। Browser data মুছলে সাজেশনও মুছে যাবে; অন্য browser/device-এ sync হয় না।
- OCR provider-এর নাম, API key/quota errors ও developer diagnostics ইউজারকে দেখানো হয় না। প্রয়োজন হলে শুধু CAPTCHA সংশোধনের সহজ নির্দেশনা দেখায়।

## Vercel

1. কোড GitHub repository-তে push করে Vercel-এ import করুন।
2. Framework Preset **Other**, Node.js **22.x** বা নতুন সমর্থিত সংস্করণ। Root directory হবে এই package-এর ফোল্ডার। Build Command খালি রাখুন; Output Directory override বন্ধ রাখুন।
3. Environment Variables:

| Name | Value |
|---|---|
| SESSION_ENCRYPTION_KEY | লোকালের `.env.local`-এ তৈরি হওয়া মান |
| OCR_PROVIDER | ocr-space |
| OCR_SPACE_API_KEY | আপনার নিজের key |
| OCR_SPACE_ENGINE | 2 |

4. Deploy/Redeploy করুন। Key environment অনুযায়ী Production/Preview-তে সেট করুন। `PORT` Vercel-এ প্রয়োজন নেই।

ব্যক্তিগত login চাইলে `APP_USERNAME` ও `APP_PASSWORD` দুটোই সেট করুন। `.env.local` GitHub-এ commit করবেন না। এই প্যাকেজ আপনার Vercel account-এ সরাসরি deploy করে পরীক্ষা করা হয়নি।

## Admin settings

- `npm run configure-ocr`: key গোপন রেখে local settings তৈরি/আপডেট।
- `npm run doctor`: key প্রকাশ না করে settings পরীক্ষা।
- `OCR_SPACE_ENGINE=3`: অন্য engine পরীক্ষা; এরপর restart/redeploy লাগবে।
- ঐচ্ছিক OpenAI Vision: `OCR_PROVIDER=openai`, `OPENAI_API_KEY` এবং `OPENAI_VISION_MODEL` সেট করুন। ডিফল্ট model `gpt-4.1-mini`।
- `<your-site-url>/api/config`: provider ও configured boolean; key-এর মান বা CAPTCHA accuracy দেখায় না। Admin troubleshooting-এর জন্য।

## কোড

- `src/index.html`: সম্পূর্ণ frontend ও dynamic interaction।
- `src/worker.js`: source form/session, CAPTCHA submission ও status parsing।
- `src/ocr-space.js`: OCR.space server integration।
- `src/vision.js`: ঐচ্ছিক AI Vision।
- `src/handler.js`: Node adapter, cookie-bound session ও ঐচ্ছিক login।
- `api/`: Vercel handlers।
- `scripts/`: local server ও setup।
- `tests/`: parser, complete client flow, source steps, session, provider ও environment checks।

```sh
npm test
```

Source/OCR integration tests mocked responses ব্যবহার করে। এই workspace থেকে দুই উৎসে live prepare চালিয়ে CAPTCHA ছবি পাওয়া গেছে; কোনো আবেদন/পাসপোর্ট পাঠানো হয়নি। এই সংস্করণে আপনার production-এর live end-to-end query চালানো হয়নি; deployment URL ও Vercel logs দেওয়া হয়নি। আসল distorted CAPTCHA-র নির্ভুলতা নিশ্চিত নয়। ভুল হলে manual correction আছে। Server OCR-তে শুধু CAPTCHA ছবি যায়; BGD/passport/name/source cookie যায় না। Source site form বা server access বদলালে status query ব্যর্থ হতে পারে।

IVAC progress source table-এর Done rows থেকে হিসাব হয়। এটি visa approval probability নয়। Granted but Not-Printed ও Granted and Printed আলাদা। Printed এবং একই আবেদনের Ready For Delivery পাওয়া গেলে সংগ্রহের ছোট নির্দেশনা দেখানো হয়।

Official implementation references:
https://ocr.space/ocrapi
https://developers.openai.com/api/docs/guides/images-vision
https://vercel.com/docs/functions/functions-api-reference
