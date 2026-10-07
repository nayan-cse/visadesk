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

Key চাইলে OCR.space-এর ইমেইল থেকে শুধু key paste করে Enter দিন। গোপন input হওয়ায় key দেখা যাবে না। তারপর http://localhost:3000 খুলুন। Gemini ব্যবহার করতে `npm run configure-ocr`-এর বদলে `npm run configure-gemini` দিন। Gemini key নেওয়া ও Vercel setup-এর জন্য `GEMINI_SETUP.md` পড়ুন। আগে server চালু থাকলে Ctrl+C দিয়ে বন্ধ করে আবার চালান।

## এই সংস্করণের পরিবর্তন

**v1.1.9 — দুটো root cookie না এলে CAPTCHA প্রস্তুতির আগে একবার recovery**

- ইউজারের একটি v1.1.8 local failure-এ `/visa` session cookies ছিল, কিন্তু `IVFRT_Cookie` ও `BNES_IVFRT_Cookie` সব phase-এ absent ছিল। একই সংস্করণের সফল check-এ চারটি cookie-ই ছিল। এই পার্থক্য একটি সূত্র, source cookie-গুলো বাধ্যতামূলক এমন প্রমাণ নয়।
- Visa form পাওয়ার পরে দুই root cookie-ই absent হলে CAPTCHA নেওয়ার আগে একবার নতুন jar দিয়ে landing ও enquiry form আনা হয়। Final form/token/cookies দিয়ে একবারই image তৈরি হয় এবং user confirmation-এর পরে একবারই POST হয়। Healthy/partial cookie pair-এ অতিরিক্ত navigation নেই। একই 45-second budget বজায় থাকে।
- পুনঃপ্রস্তুতিতেও root pair absent হলে মূল সাইটের প্রকৃত check চালানো যায়; কেবল absence দেখে CAPTCHA_INVALID বানানো হয় না। নতুন `visaBootstrap` diagnostics recovery-এর ফল জানায়। দ্বিতীয় প্রস্তুতির HTTP/network failure আগের error policy অনুসরণ করে।
- Transient missing-cookie source fixture-তে v1.1.8 সঠিক CAPTCHA answer-সহ 422 দেয়; v1.1.9 দ্বিতীয় প্রস্তুতিতে root cookies পেয়ে সফল হয়। এটি modeled failure/recovery, আপনার live source-এর কারণ নিশ্চিত করে না। ১৫টি test file পাস করেছে; নতুন সংস্করণ live পরীক্ষা হয়নি।
- পুরো project deploy করুন, আগের settings রাখুন, server restart/page refresh করে নতুন CAPTCHA নিন। UI ও provider setup রাখা হয়েছে। `PRODUCTION_FIXES.md`-তে `visaBootstrap` পড়ার নির্দেশনা আছে।

**v1.1.8 — কোন Visa কুকি বদলাচ্ছে তা শনাক্ত করার আপডেট**

- সফল Visa response-এর `diagnostics` এবং ব্যর্থ response-এ `visaCookieChanges`, `sourceHttpStatus`, `sourceRedirectCount`, `sourceReplySignals` আছে। চারটি পরিচিত cookie-র form → image → submit → response পরিবর্তন আলাদা করে দেখা যায়। মান, hash, source HTML বা personal input প্রকাশ হয় না; custom log file নেই।
- ইউজারের লোকাল restart পরীক্ষায় v1.1.7-এর encrypted session নতুন process-এও সফল হয়েছে। ফলে instance বদল একাই ব্যর্থতার কারণ নয়। Vercel-এর network/IP বিষয়টি এখনও সম্ভাবনা; এই আপডেট তাকে প্রমাণিত কারণ হিসেবে ধরে নেয় না।
- ১৪টি automated test file পাস করেছে। Source/provider responses mocked; v1.1.8 এখনও আপনার production-এ live পরীক্ষা হয়নি। এটি কারণ নির্ণয়ের আপডেট, নিশ্চিত production fix নয়।
- পুরো project deploy করুন, আগের environment settings রাখুন এবং নতুন CAPTCHA নিন। `PRODUCTION_FIXES.md`-তে নতুন response পড়ার নির্দেশনা আছে। আগের user interface এবং manual confirmation flow রাখা হয়েছে।

**v1.1.7 — Vercel-এর অনিয়মিত ব্যর্থতা নির্ণয়ের আপডেট**

- সম্পূর্ণ হওয়া status check-এর সফল response-এ `diagnostics`, আর source-result error response-এ safe diagnostic fields আছে। Prepare ও submit একই runtime instance/region-এ হয়েছে কি না, form → image → submit-এর cookie বদল, ছবির বয়স ও CAPTCHA-র দৈর্ঘ্য তুলনা করা যায়। এগুলো UI-তে দেখানো হয় না; কোনো secret, cookie value, instance identifier বা custom server log ফেরত আসে না।
- HTML comment-এ রাখা error markup-কে আগে কখনও সত্যিকারের `CAPTCHA_INVALID` ধরা হতো। সেই ভুল শনাক্তকরণ সংশোধন হয়েছে; commented form/script markup-ও form হিসেবে নেওয়া হয় না। Test-এ দুর্বলতাটি পুনরুৎপাদন হয়েছে, তবে আপনার production ব্যর্থতার কারণ এটিই কি না প্রমাণিত নয়।
- Cold-start simulation-এ অন্য module instance থেকেও encrypted session দিয়ে source query সফল হয়েছে। Instance বদলকে একা ব্যর্থতার কারণ ধরা হয় না। একই instance থাকাও একই outbound IP-এর নিশ্চয়তা দেয় না।
- ১৩টি automated test file সফল হয়েছে; source/provider responses mocked। নতুন সংস্করণ আপনার Vercel production-এ live পরীক্ষা হয়নি। বর্তমান production-এর মূল কারণ এখনও অনিশ্চিত। সফল ও ব্যর্থ Visa response তুলনা করার নির্দেশনা `PRODUCTION_FIXES.md`-তে আছে।
- পুরো project deploy করুন; আগের environment settings রাখুন এবং নতুন CAPTCHA নিন। UI, Gemini/OCR.space fallback, manual confirmation, শতাংশ ও PNG save আগের মতো আছে।

**v1.1.6 — CAPTCHA সেশনের cookie সংরক্ষণ সংশোধন**

- একই নামের cookie আলাদা domain/path-এ থাকলে দুটোই সংরক্ষণ হয়। উপযুক্ত পথের cookie-ই পাঠানো হয়; একটি cookie মুছলে অন্য পথের cookie হারায় না। মেয়াদ শেষ হলে সেটি আর পাঠানো হয় না।
- পূর্ণ prepare → image → submit regression test-এ `/visa`-র session cookie ছবির response-এর root cookie দিয়ে মুছে যাচ্ছিল। পুরোনো কোডে test ব্যর্থ, নতুন কোডে সফল। আপনার production-এর ব্যর্থতার কারণ একই ছিল কি না এখনও নিশ্চিত নয়।
- `CAPTCHA_INVALID` response-এ শুধু `source`, `version`, `sessionCookieState` ও `captchaAgeSeconds` যোগ হয়েছে। Cookie/token/আবেদন বা পাসপোর্ট নম্বর ফেরত আসে না; custom server logs নেই। `changed` মানে response-এ cookie বদলেছে, এটি একা ব্যর্থতার কারণ প্রমাণ করে না।
- **পুরো project deploy করুন**, নতুন `src/cookies.js`-সহ। আগের settings রাখুন। Deploy শেষে নতুন CAPTCHA নিন। ডিজাইন, user confirmation, Gemini/OCR.space fallback ও PNG save আগের মতো আছে।
- ১২টি automated test file সফল হয়েছে। Source/provider responses test-এ mocked; v1.1.6 আপনার Vercel production-এ live পরীক্ষা হয়নি। সমস্যা থাকলে `PRODUCTION_FIXES.md`-এর নির্দেশনায় safe response fields দেখুন।

**v1.1.5 — Gemini আগে, OCR.space ব্যাকআপ**

- Default `OCR_PROVIDER=auto`। দুইটি key থাকলে Gemini আগে চেষ্টা হয়। পুরোনো `OCR_PROVIDER=ocr-space` থাকলেও Gemini key পাওয়া গেলে Gemini আগে চলবে; backup settings মুছতে হবে না।
- Gemini-এর API error/limit, খালি বা অস্পষ্ট উত্তর হলে OCR.space চেষ্টা হয়। Gemini পরিষ্কার উত্তর দিলে দ্বিতীয় service ডাকা হয় না। ব্যাকআপ ব্যর্থ হলে আগের অস্পষ্ট Gemini লেখা সংশোধনের জন্য রাখা হয়।
- Network response-এর `requestedProvider`, `fallback` এবং `fallbackReason` দিয়ে service বদলানোর কারণ দেখা যায়। সাধারণ ইউজারকে technical/provider তথ্য দেখানো হয় না।
- Local setup ও doctor একই selection নিয়ম ব্যবহার করে। দুই configure command-ই অন্য service-এর key ও আগের session/login settings রাখে। বিস্তারিত `GEMINI_SETUP.md`-তে আছে।
- এই আপডেটে **পুরো project** deploy করতে হবে। UI অপরিবর্তিত। Sequential fallback, shared budget, key privacy ও Vercel bundle tests আছে; আসল key দিয়ে নতুন সংস্করণ live পরীক্ষা করা হয়নি।

**v1.1.4 — Gemini image transcription**

- Server-এ `gemini-3.5-flash-lite` দিয়ে CAPTCHA পড়ে ঘরে বসানোর ব্যবস্থা। Gemini-এর API key নিজের AI Studio account থেকে নিতে হবে; free tier quota সীমিত। `GEMINI_SETUP.md`-তে ধাপে ধাপে নির্দেশনা আছে।
- `OCR_PROVIDER=gemini`, `GEMINI_API_KEY` এবং `GEMINI_MODEL` দিয়ে Vercel-এ সক্রিয় করুন। আগের OCR.space key থাকলে Gemini ব্যর্থ হওয়া বা unsupported GIF-এর ক্ষেত্রে সেটি চেষ্টা করবে।
- API-তে শুধু CAPTCHA ছবি যায়। JSON যাচাই, অক্ষরের case, অনিশ্চিত লেখা, provider errors ও shared timeout সামলানো হয়। Backend কোনো CAPTCHA দিয়ে নিজে স্ট্যাটাস জমা দেয় না; আগের user confirmation আছে।
- **এই আপডেটে পুরো project deploy করতে হবে।** নিচের UI আপডেটগুলো আগের সংস্করণের পরিবর্তন; শুধু HTML বদলানোর পুরোনো নির্দেশনা এই Gemini আপডেটে প্রযোজ্য নয়। ডিফল্ট নাইট মোড, ফলাফলের প্যানেল, শতাংশ ও ছবি সেভ আগের মতো আছে।
- Mocked provider ও deployment tests আছে; নিজের Gemini key ছাড়া এই আপডেটে live CAPTCHA accuracy বা আপনার Vercel deployment পরীক্ষা করা হয়নি।

**ডিফল্ট নাইট মোড**

- প্রথমবার সাইট খুললে ডিভাইসের theme যাই থাকুক নাইট মোড আসে। “দিনের মোড” বাটনে light mode বেছে নেওয়া যায়।
- ইউজারের পছন্দ এই ব্রাউজারে মনে থাকে; পরেরবার খোলার সময় সেই মোড আসে। Browser storage বন্ধ থাকলেও theme toggle কাজ করে।
- এই আপডেটের জন্য শুধু `src/index.html` বদলে deploy করুন।

**স্ট্যাটাসের রং ও সংগ্রহের নির্দেশনা**

- Granted and Printed-এর ভিসা কার্ড ও শিরোনামে হালকা সবুজ ব্যবহার করা হয়েছে। Granted but Not-Printed-এর আগের রং ও অর্থ আছে।
- একই আবেদনে Visa Under Processing এবং IVAC Ready For Delivery একসঙ্গে থাকলে দুই স্ট্যাটাসে হালকা লাল চিহ্ন, পাসপোর্ট সংগ্রহ করে ভিসা হয়েছে কি না যাচাই করার নির্দেশনা এবং সাইটের মালিকের দেওয়া ৫০% / ৫০% ধারণা দেখায়। সংখ্যাটি মূল উৎসের তথ্য বা হিসাব করা সম্ভাবনা নয়; ইউজারের সামনে “আনুমানিক ধারণা — যাচাইকৃত সম্ভাবনা নয়” লেখা থাকে।
- পাসপোর্টের সম্পন্ন ধাপের প্রকৃত শতাংশ আগের মতো থাকে। সেই শতাংশ ভিসা অনুমোদনের সম্ভাবনা বোঝায় না।
- Save করা PNG-তেও একই নির্দেশনা, আনুমানিক ধারণার ব্যাখ্যা ও রং আছে। অন্য স্ট্যাটাস, অনুপস্থিত ফলাফল, source error বা আলাদা আবেদন নম্বর হলে এই বিশেষ লাল চিহ্ন দেখায় না।
- এই আপডেটের জন্য শুধু `src/index.html` বদলিয়ে deploy করতে হবে। Backend, session/cookie ও API অপরিবর্তিত; backend version 1.1.3 আছে। Conditional UI ও PNG পরীক্ষাগুলো পাস করেছে।

**ইন্টারফেস আপডেট — এক প্যানেলে ফলাফল**

- ভিসা ও পাসপোর্টের ফলাফল, বাংলা ব্যাখ্যা, শতাংশ ও চার ধাপ এখন একই ফলাফলের প্যানেলের মধ্যে থাকে। ওপরেই নম্বর বদলানো এবং ছবি সেভ করার বাটন আছে।
- বড় স্ক্রিনে স্ট্যাটাস ও ব্যাখ্যা পাশাপাশি; মোবাইলে একটির নিচে অন্যটি। হালকা ও নাইট মোডের জন্য একই লেআউট আছে।
- এই আপডেটে শুধু `src/index.html`-এর HTML attributes ও CSS বদলেছে। কোনো লেখা, application JavaScript, API, cookie/session বা backend পরিবর্তন হয়নি। বর্তমান সাইটে শুধু এই ফাইল বদলিয়ে deploy করলেই নতুন ডিজাইন আসবে। Backend version 1.1.3-ই আছে।
- বিদ্যমান UI test পাস করেছে এবং আগের ZIP-এর সঙ্গে তুলনা করে কন্টেন্ট ও কার্যকারিতা অপরিবর্তিত যাচাই হয়েছে। এই পরিবেশে browser preview যাচাই সম্পন্ন হয়নি।

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

- নতুন teal ও navy ডিজাইন, হালকা/নাইট মোডের বাটন। প্রথমবার নাইট মোড আসে; বাটন দিয়ে বদলানো যায় এবং ব্রাউজারে ইউজারের পছন্দ মনে থাকে।
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

Source/OCR integration tests mocked responses ব্যবহার করে। v1.1.9 আপনার production-এ live পরীক্ষা হয়নি। ইউজারের v1.1.7 production response-এ Visa ও IVAC সফল হয়েছে, আবার Visa ব্যর্থও হয়েছে; লোকাল restart-এও Visa সফল হওয়ার diagnostics পাওয়া গেছে। আগের deployment-এর একটি অনুমোদিত live পরীক্ষায় Visa ফলাফল পাওয়া গেছে, কিন্তু IVAC CAPTCHA প্রত্যাখ্যান করেছে; সেটি নতুন সংশোধনের verification নয়। আসল distorted CAPTCHA-র নির্ভুলতা নিশ্চিত নয়। ভুল হলে manual correction আছে। Server OCR-তে শুধু CAPTCHA ছবি যায়; BGD/passport/name/source cookie যায় না। Source site form বা server access বদলালে status query ব্যর্থ হতে পারে।

IVAC progress source table-এর Done rows থেকে হিসাব হয়। এটি visa approval probability নয়। Granted but Not-Printed ও Granted and Printed আলাদা। Printed এবং একই আবেদনের Ready For Delivery পাওয়া গেলে সংগ্রহের ছোট নির্দেশনা দেখানো হয়।

Official implementation references:
https://ocr.space/ocrapi
https://developers.openai.com/api/docs/guides/images-vision
https://vercel.com/docs/functions/functions-api-reference
