# Vercel আপডেট — v1.1.7

বর্তমান package v1.1.7। Gemini আগে ও OCR.space ব্যাকআপ setup আগের মতো আছে; `GEMINI_SETUP.md` পড়ুন।

## লোকালে কাজ করে, Vercel-এ মাঝেমধ্যে 422

Console-এর `422` একা কারণ জানায় না। API-এর Response-এ `code: "CAPTCHA_INVALID"` থাকলে আমাদের parser মূল সাইটের উত্তরে CAPTCHA প্রত্যাখ্যানের বার্তা পেয়েছে। এটি source-এর HTTP status 422 ছিল এমন দাবি নয়, আর ইউজার ভুল লিখেছেন এমন প্রমাণও নয়।

Vercel-এর [Functions documentation](https://vercel.com/docs/functions) অনুযায়ী আলাদা request-এর জন্য আলাদা invocation হয় এবং instance reuse সবসময় নিশ্চিত নয়। [Networking documentation](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address) অনুযায়ী default outbound IP dynamic pool থেকে আসে এবং request-এর মধ্যে বদলাতে পারে। এটি hosting-এর একটি জানা পার্থক্য; Indian Visa Online-এর session IP-তে বাঁধা কি না এখানে প্রমাণিত হয়নি। Region pin করলে একই instance/IP নিশ্চিত হয় না।

এই সংস্করণ diagnosis ও parser correctness-এর আপডেট। এটি নিশ্চিত production সমাধান হিসেবে দাবি করা হচ্ছে না। কোনো routing/proxy/IP পরিবর্তন, নতুন paid service বা storage দরকার নেই। একই UI ও আগের settings দিয়ে deploy করা যায়।

## সফল ও ব্যর্থ Visa response তুলনা করুন

পুরো project deploy → পেইজ refresh → নতুন CAPTCHA নিয়ে নিজে লেখা মিলিয়ে submit করুন। DevTools → Network → `track?action=check-status` → Response-এ `source: "visa"` দেখুন।

- সফল query-তে **শুধু `diagnostics` object** কপি করুন; পুরো result কপি করার প্রয়োজন নেই।
- ব্যর্থ query-তে নিচের safe fields/error object কপি করুন। Token, request body, cookie, API key বা ব্যক্তিগত নম্বর পাঠাবেন না।

| Field | কী মাপা হয়েছে |
|---|---|
| version / source | `1.1.7` / সংশ্লিষ্ট tracker |
| runtimeContinuity | Prepare ও check একই module instance-এ হলে `same-instance`, অন্য হলে `different-instance`; পুরোনো token হলে `unknown` |
| prepareRegion / checkRegion | Vercel runtime region; লোকালে `local`; পাওয়া না গেলে `unknown` |
| formImageCookieState | Form আনার পর এবং image আনার পর POST-এ প্রযোজ্য সব cookie-র মান বদলেছে কি না |
| imageSubmitCookieState | Image নেওয়ার সময়কার cookie এবং submit-এর আগে প্রযোজ্য cookie বদলেছে কি না; review-এর সময় expiry-ও এতে ধরা পড়ে |
| submitResponseCookieState | Submit-এর আগে ও response-এর পরে POST-এ প্রযোজ্য সব cookie-র পরিবর্তন |
| sessionCookieState | আগের মতো, submit-এর আগে ও response-এর পরে পরিচিত session cookie-র মান পরিবর্তন |
| captchaAgeSeconds / captchaLength | ছবি প্রস্তুতির পর সময় / জমা দেওয়া লেখার দৈর্ঘ্য |
| sourceReplyKind | CAPTCHA error হলে `captcha-error-notice`: error/alert markup-এর বার্তা; `captcha-page-text`: page text-এর বার্তা |

এই state-গুলো পরিবর্তন পর্যবেক্ষণ করে; মূল সাইটের server-side session কার্যকর ছিল বা CAPTCHA ঠিক ছিল এমন নিশ্চয়তা দেয় না। `different-instance` মানে IP বদলেছে এমনও নয়; `same-instance` মানে IP একই ছিল এমন নয়। Cookie বদল সফল request-এও হতে পারে। তাই দুই outcome তুলনা প্রয়োজন।

কোনো cookie/token/hash/instance ID API-তে ফেরত আসে না। Diagnostic fields UI-তে দেখানো হয় না, কোনো source HTML বা custom log file রাখা হয় না।

## Parser-এর ভুল CAPTCHA error সংশোধন

Test-এ valid status-এর পাশে HTML comment-এ `<ul class="errorMessage">Invalid Captcha</ul>` থাকলে পুরোনো parser CAPTCHA error দিচ্ছিল। এখন comment বাদ দিয়ে status পড়া হয়; commented form/script markup-ও parse করা হয় না। আসল visible error থাকলে সেটি এখনও error হয়। আপনার live failure-এ এই পরিস্থিতি ছিল কি না জানা যায়নি।

১৩টি automated test file সফল হয়েছে। Cold-start simulation-এ অন্য worker instance থেকেও একই encrypted source cookie/token দিয়ে query সফল হয়েছে। Source/provider responses mocked; v1.1.7 আপনার Vercel-এ live পরীক্ষা হয়নি।

## আগের v1.1.6 cookie সংশোধনও অন্তর্ভুক্ত

## নতুন cookie সংশোধন ও পরীক্ষা

আগের cookie jar শুধু নাম দিয়ে cookie রাখত। একই নামের `/visa` এবং `/` cookie এলে একটি অন্যটি মুছে দিত। এখন domain/path-সহ পৃথকভাবে রাখা হয়। Request-এর উপযুক্ত path অনুযায়ী পাঠানো হয়, বেশি নির্দিষ্ট পথ আগে আসে, মেয়াদ শেষ হলে বাদ পড়ে এবং cookie deletion শুধু সংশ্লিষ্ট domain/path-এ কাজ করে। নিয়মের ভিত্তি: [RFC 6265](https://datatracker.ietf.org/doc/html/rfc6265), sections 5.3–5.4।

Fixture-তে status form `/visa` session দেয় এবং image response একই নামের root cookie বদলায়। আগের কোড session হারায়; নতুন কোডে পূর্ণ check সফল হয়। এটি কোডের একটি প্রমাণিত দুর্বলতা। আপনার production-এর ব্যর্থ request-এ ঠিক এই পরিস্থিতি ঘটেছিল কি না এখনও জানা যায়নি।

আগের cookie regression test এই সংস্করণেও আছে। পুরো project deploy করুন, বিশেষ করে `src/worker.js` ও `src/cookies.js` রাখুন। আগের `.env.local`/Vercel environment variables রাখুন। Deploy শেষে পেইজ refresh করে নতুন CAPTCHA নিন।

## এখনও CAPTCHA_INVALID এলে

DevTools → Network → `track?action=check-status` → Response দেখুন। নতুন response-এ নিচের safe fields থাকবে:

| Field | অর্থ |
|---|---|
| version | নতুন backend হলে `1.1.7` |
| source | `visa` অথবা `ivac`: কোন উৎস প্রত্যাখ্যান করেছে |
| sessionCookieState | `changed`: জমা দেওয়ার response-এ পরিচিত session cookie বদলেছে/বাদ গেছে; `unchanged`: cookie মান একই; `unknown`: পরিচিত session cookie পাওয়া যায়নি |
| captchaAgeSeconds | ছবি প্রস্তুতের পর কত সেকেন্ড কেটেছে |

`unchanged` মূল সাইটে session কার্যকর ছিল এমন প্রমাণ নয়। `changed`-ও session বদলই ব্যর্থতার কারণ এমন নিশ্চয়তা নয়। মূল সাইট নিজের session মুছে ফেলতে পারে অথবা rejection-এর পরে cookie বদলাতে পারে। তাই `CAPTCHA_INVALID` code রাখা হয়েছে; ইউজার ভুল লিখেছেন ধরে নেওয়া হয় না।

সমস্যা থাকলে উপরের safe diagnostic fields জানান। Request body, token, cookie, passport number বা key পাঠাবেন না। UI-তে এই technical fields দেখানো হয় না এবং কোনো source HTML বা custom diagnostic log রাখা হয় না। প্রত্যাখ্যানের পরে নিজে থেকে আর submit করা হয় না; নতুন ছবি নিয়ে user confirmation প্রয়োজন।

## আগের v1.1.3 সংশোধনও অন্তর্ভুক্ত

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
5. নিজের `/api/config`-এ `version: "1.1.7"` দেখে নতুন backend যাচাই করতে পারেন। `configured: true` শুধু OCR setting উপস্থিত বোঝায়; ট্র্যাকার চালাতে এই endpoint খোলার প্রয়োজন নেই। CAPTCHA error response-এর `version` বা সফল response-এর `diagnostics.version` দিয়েও backend version দেখা যায়।

`/api/track`-এ 404 হলে নতুন API file commit হয়েছে কি না দেখুন। First-party cookies চালু রাখুন। ব্যর্থ request-এর response থেকে শুধু উপরে উল্লেখ করা safe fields শেয়ার করুন।

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
