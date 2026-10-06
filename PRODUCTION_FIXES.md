# Vercel আপডেট — v1.1.3

## সঠিক CAPTCHA দিয়েও Visa ফলাফল না আসা

সঠিক লেখা দেওয়ার পরেও মূল সাইট তার CAPTCHA সেশন চিনতে না পারলে `Invalid Captcha` ফেরত দিতে পারে। তাই এই response একা ইউজার ভুল লিখেছেন এমন প্রমাণ নয়। IVAC সফল হওয়া Visa-র আলাদা source session ঠিক আছে এমন প্রমাণও নয়।

কোডে একটি নির্দিষ্ট cookie দুর্বলতা পাওয়া গেছে: `getSetCookie()` থাকলেও এক header-এ একাধিক cookie পাওয়া গেলে আগে প্রথমটিই রাখা হতো। এখন প্রতিটি header-এর প্রতিটি cookie আলাদা করে সংরক্ষণ হয়; `Expires` তারিখের কমা অক্ষুণ্ণ থাকে। `getSetCookie()` খালি array দিলেও raw header থেকে cookie পড়া হয়।

নতুন regression test-এ Visa-র চারটি cookie একত্রিত header দিয়ে ফেরত দেওয়া হয়েছে। একই test আগের v1.1.2-তে ফলাফলের POST-এ 422 দেয়; সংশোধিত কোডে cookie-সহ POST সফল হয়। এটি কোডের দুর্বলতা প্রমাণ করে। আপনার production request-এ একইভাবে header একত্রিত হচ্ছিল কি না সরাসরি নিশ্চিত করা যায়নি।

## এই সংস্করণে আরও যা বদলেছে

- Browser-এর CAPTCHA আনা, লেখা পড়া ও ফলাফল চেক একই `/api/track?action=...` Vercel function ব্যবহার করে। নতুন `api/track.js` deploy করা জরুরি। আগের `/api/prepare`, `/api/read-captcha`, `/api/check-status` ও `/api/config` URL-গুলো রাখা হয়েছে।
- মূল Visa সাইটের নিজের `refreshCaptcha()` পদ্ধতির মতো `/visa/captcha`-তে নতুন `rand` query যুক্ত হয়। ছবি চাওয়ার সময় no-cache headers পাঠানো হয়।
- CAPTCHA প্রত্যাখ্যানের বার্তা হয়েছে: “মূল সাইট ক্যাপচাটি গ্রহণ করেনি। নতুন ছবি নিয়ে আবার নিশ্চিত করুন।” ক্যাপচা নিজে দেখে নিশ্চিত করার ধাপ আগের মতোই আছে।
- Source cookies encrypted token-এ থাকে। কোনো memory-only session store, custom log file বা logging service লাগে না। অন্য browser-এর token ব্যবহার প্রতিরোধও রাখা হয়েছে।
- আধুনিক UI, বড় ফলাফল কার্ড, বাংলা ব্যাখ্যা, IVAC শতাংশ, নিচের চার ধাপ, loading progress, night mode, suggestions ও PNG save অপরিবর্তিত আছে।

একই function ব্যবহারে একই server instance বা outbound IP নিশ্চিত হয় না। Session-এর সঙ্গে network routing-ও যুক্ত কি না এ তদন্তে প্রমাণিত হয়নি। সঠিক CAPTCHA দিয়েও নতুন deployment ব্যর্থ হলে source session/response আরও পরীক্ষা করতে হবে; এটিকে শুধু OCR-এর সমস্যা ধরে নেওয়া যাবে না।

## Deployment আপডেট

1. ZIP extract করে **পুরো project** আপনার repository-তে দিন। বিশেষ করে নতুন `api/track.js`, `src/worker.js`, `src/handler.js` ও `src/index.html` আপডেট হয়েছে কি না দেখুন। শুধু UI বদলালে backend সংশোধন আসবে না।
2. আগের `.env.local` এবং Vercel-এর Environment Variables রাখুন। `SESSION_ENCRYPTION_KEY` বা OCR key বদলানোর প্রয়োজন নেই। ZIP-এ আসল API key নেই।
3. Vercel-এর Root Directory হবে `package.json` যে ফোল্ডারে আছে। Framework Other, Build Command override খালি এবং Output Directory override বন্ধ রাখুন। Build Command-এ `npm run dev` দেবেন না।
4. Commit/push করে Production deployment দিন। Ready হলে Ctrl+Shift+R দিয়ে refresh করে **নতুন CAPTCHA** নিন। আগে তৈরি token ব্যবহার করবেন না।
5. নিজের `/api/config`-এ `version: "1.1.3"` দেখে নতুন backend যাচাই করতে পারেন। `configured: true` শুধু OCR setting উপস্থিত বোঝায়; ট্র্যাকার চালাতে এই endpoint খোলার প্রয়োজন নেই।

`/api/track`-এ 404 হলে নতুন API file commit হয়েছে কি না দেখুন। First-party cookies চালু রাখুন। ব্যর্থ Visa request-এর response দেখার পথ: DevTools → Network → `track?action=check-status` → Response। শুধু `code` শেয়ার করুন; token, cookie বা API key পাঠাবেন না।

## আগের OCR ও CSP সংশোধনও আছে

v1.1.2-তে browser OCR-এর WebAssembly data URL-এর জন্য CSP `connect-src`-এ `data:` যোগ হয়েছে। সার্ভারের OCR ব্যর্থ হলে বা খালি লেখা দিলে browser OCR চেষ্টা করে। ছবিতে standard padded Base64 দেওয়া হয়। এসব পরিবর্তন এবং নিরাপদ error codes এই সংস্করণে আছে।

OCR-এর 503 হলে DevTools → Network → `track?action=read-captcha` → Response দেখুন:

| Code | কী বোঝায় |
|---|---|
| OCR_KEY_REJECTED | OCR সেবা authentication/key গ্রহণ করেনি। Vercel-এর Production key যাচাই করুন। |
| OCR_LIMIT_REACHED | OCR ব্যবহারের সীমা বা rate limit এসেছে। পরে চেষ্টা করুন বা ছবির লেখা নিজে মিলিয়ে লিখুন। |
| OCR_ACCESS_DENIED | OCR সেবা access গ্রহণ করেনি; শুধু এই code থেকে key ভুল নিশ্চিত হয় না। |
| OCR_TIMEOUT / OCR_NETWORK | OCR সেবার সঙ্গে যোগাযোগ সময়মতো শেষ হয়নি বা সংযোগ ব্যর্থ হয়েছে। |
| OCR_SETTINGS_INVALID | Engine setting গ্রহণযোগ্য নয়। OCR_SPACE_ENGINE-এ 2 দিন এবং Redeploy করুন। |
| OCR_IMAGE_REJECTED | ছবির format/data গ্রহণ করেনি। নতুন ছবি নিন। |
| OCR_SERVICE_UNAVAILABLE | OCR সেবা গ্রহণযোগ্য সফল response দেয়নি। ছবির লেখা নিজে মিলিয়ে ব্যবহার করুন। |

Provider-এর নাম ও technical diagnostics সাধারণ ইউজারকে দেখানো হয় না। Custom server logging নেই।

## পরীক্ষা ও সীমা

`npm test`-এর নয়টি test file পাস করেছে। Cookie regression, unified API flow, browser-token binding, fresh CAPTCHA nonce, parsing, timeouts, retry, OCR fallback, CSP, deployment HTML loading, চার ধাপের UI, PNG save ও suggestions পরীক্ষা হয়েছে। Source/provider responses automated tests-এ mock করা হয়েছে।

তদন্তের সময় আপনার চলমান deployment-এর version ছিল 1.1.2। আলাদা পরীক্ষামূলক নম্বর দিয়ে Visa request-এ CAPTCHA প্রত্যাখ্যাত হওয়ার response পাওয়া গেছে; প্রকৃত আবেদনকারীর নম্বর ব্যবহার করা হয়নি। এই ফলাফল দিয়ে production সমস্যার একমাত্র কারণ নিশ্চিত করা যায়নি। নতুন 1.1.3 আপনার Vercel account-এ live deploy করে পরীক্ষা করা হয়নি।

Source requests-এর মোট budget ৪৫ সেকেন্ড, client timeout ৫৫ সেকেন্ড ও Vercel function duration ৬০ সেকেন্ড। CAPTCHA জমা দেওয়ার POST নিজে থেকে replay হয় না। একটি উৎসের সফল ফলাফল রেখেই ব্যর্থ উৎসে নতুন ছবি নিয়ে আবার নিশ্চিত করা যায়।
