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
- ইতিহাস, saved application, passport সংরক্ষণ, import/export সরানো হয়েছে। অ্যাপের পুরোনো `visadesk.records` ও `visadesk.history` storage প্রথমবার খোলার সময় মুছে যায়। এরপর application বা ফলাফল browser storage-এ লেখা হয় না। বর্তমানে খোলা পেজে ফলাফল সাময়িকভাবে থাকে; reload করলে সরে যায়।
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

Source/OCR integration tests mocked responses ব্যবহার করে। সাধারণ test image-এ OCR.space key কাজ করার পরীক্ষা আগে সফল হয়েছে; আসল distorted CAPTCHA-র নির্ভুলতা নিশ্চিত নয়। ভুল হলে manual correction আছে। Server OCR-তে শুধু CAPTCHA ছবি যায়; BGD/passport/name/source cookie যায় না। Source site form বা server access বদলালে status query ব্যর্থ হতে পারে।

IVAC progress source table-এর Done rows থেকে হিসাব হয়। এটি visa approval probability নয়। Granted but Not-Printed ও Granted and Printed আলাদা। Printed এবং একই আবেদনের Ready For Delivery পাওয়া গেলে সংগ্রহের ছোট নির্দেশনা দেখানো হয়।

Official implementation references:
https://ocr.space/ocrapi
https://developers.openai.com/api/docs/guides/images-vision
https://vercel.com/docs/functions/functions-api-reference
