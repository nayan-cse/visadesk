# OCR.space — আপনার জন্য সেটআপ

**Gemini আগে এবং OCR.space ব্যাকআপ চাইলে** `GEMINI_SETUP.md` পড়ুন। বর্তমান v1.1.9-তে দুইটি key রাখা যায়। `npm run configure-gemini` ও `npm run configure-ocr` দুটোই চালালে দুইটি key গোপনে সেট হবে এবং Gemini আগে চেষ্টা করবে। পুরোনো session ও login settings রাখা হয়। নিচের OCR.space-only setup-ও ব্যবহার করা যায়।

## ১. ফোল্ডার খুলুন

নতুন ZIP extract করুন। `visadesk-vercel` ফোল্ডারে Terminal / Git Bash খুলুন। Node.js 22+ লাগবে।

## ২. Key গোপন রেখে setup করুন

```sh
npm install
npm run configure-ocr
```

Terminal “Paste ONLY your OCR.space API key” বললে ইমেইলের **শুধু key** paste করে Enter চাপুন। লেখা দেখা না গেলেও input নেওয়া হচ্ছে। পুরো email বা key-এর Markdown ** চিহ্ন paste করবেন না।

এই কমান্ড সঠিক project ফোল্ডারের `.env.local` তৈরি/আপডেট করবে। Key গোপন থাকবে, `OCR_PROVIDER=auto` এবং engine 2 সেট হবে। Gemini key থাকলে Gemini আগে চলবে, OCR.space হবে ব্যাকআপ। আগে থেকে থাকা session key রাখা হবে।

## ৩. Settings পরীক্ষা করুন

```sh
npm run doctor
```

`OCR_SPACE_API_KEY: SET (value hidden)` দেখালে local setting পাওয়া গেছে। MISSING হলে `npm run configure-ocr` আবার চালান। `.env.local.txt` থাকলে Windows ভুল extension-এ save করেছে; configure command সঠিক ফাইল তৈরি করবে।

## ৪. সাইট চালান

```sh
npm run dev
```

খুলুন: http://localhost:3000

আগের server চালু থাকলে Ctrl+C দিয়ে আগে বন্ধ করুন। নতুন setting পুরোনো চলমান server-এ নিজে থেকে ঢোকে না। Startup-এ `OCR.space key: SET` দেখাবে।

BGD ও passport number লিখে “ক্যাপচা প্রস্তুত করুন” চাপুন। দুই উৎসের ছবি এবং স্বয়ংক্রিয়ভাবে পড়া লেখাটি দেখাবে। ছবির সঙ্গে মিলিয়ে প্রয়োজন হলে লেখা ঠিক করুন। তারপর “ঠিক আছে, ফলাফল দেখুন” চাপলে ফলাফল দুটি কার্ডে আসবে। শুধু ছবি পড়ার পর স্ট্যাটাস জমা দেওয়া হয় না; আপনার নিশ্চিতকরণ প্রয়োজন। ক্যাপচা ভুল হলে বা সময় শেষ হলে নতুন ছবি আবার যাচাই করুন।

## ৫. Engine 2 ভালো না পড়লে

`.env.local`-এ `OCR_SPACE_ENGINE=3` করুন। Terminal-এ Ctrl+C দিয়ে server বন্ধ করে আবার `npm run dev` চালান। Engine 3-এর আলাদা free quota আছে। এক ছবিতে দুই engine একসঙ্গে ডাকা হয় না।

## Vercel-এ

নতুন কোড push/import করুন। Settings → Environment Variables-এ সেট করুন:

| Name | Value |
|---|---|
| SESSION_ENCRYPTION_KEY | আপনার `.env.local`-এ তৈরি হওয়া মান |
| OCR_PROVIDER | auto |
| OCR_SPACE_API_KEY | ইমেইলে পাওয়া আপনার আসল key |
| OCR_SPACE_ENGINE | 2 |

তারপর Redeploy করুন। Engine বদলালেও Redeploy লাগবে। `PORT` Vercel-এ প্রয়োজন নেই। ব্যক্তিগত login চাইলে `APP_USERNAME` এবং `APP_PASSWORD` দুটোই সেট করুন।

## সমস্যা বুঝবেন যেভাবে

- “OCR_SPACE_API_KEY সেট করুন”: variable খালি/অনুপস্থিত। Key বসিয়ে restart/redeploy করুন।
- “API key ও quota যাচাই করুন”: key-এ পুরো ইমেইল কপি হয়েছে কি না, ভুল key বা free quota শেষ হয়েছে কি না দেখুন।
- “ছবিটি পড়তে পারেনি”: অন্য engine চেষ্টা করুন বা হাতে লিখুন।
- “ক্যাপচা সঠিক হয়নি”: OCR অক্ষর ভুল পড়েছে; নতুন ক্যাপচা নিয়ে ছবির সঙ্গে মিলিয়ে সংশোধন করুন।
- Key ও secret frontend HTML-এ বসাবেন না; `.env.local` GitHub-এ আপলোড করবেন না।

কোডের পরীক্ষায় mocked OCR.space responses ব্যবহার করা হয়েছে। সাধারণ test image-এ key কাজ করার পরীক্ষা আগে সফল হয়েছে; দুই উৎসের আসল CAPTCHA শতভাগ পড়বে এমন নিশ্চয়তা নেই।

## Vercel সার্ভারে key আছে কি না দেখুন

Deploy করা সাইটের URL-এর শেষে `/api/config` যোগ করে খুলুন। `provider: ocr-space` এবং `configured: true` মানে সেই চলমান server variable পেয়েছে; এটি key-এর বৈধতা বা CAPTCHA accuracy যাচাই করে না। Production deployment হলে Production environment-এর variable সেট করতে হবে। Variable যোগ করার পর অবশ্যই Redeploy করুন।
