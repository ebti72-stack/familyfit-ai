# FamilyFit AI

**معاً لحياة أكثر صحة وسعادة** — مساعد صحي عائلي: تغذية ذكية، ماء، نشاط، ومنافسة عائلية قائمة على العادات.

Expo (React Native, iOS / Android / Web) · TypeScript · Supabase (Postgres + Auth + RLS) · Open Food Facts.

| | | |
|---|---|---|
| ![](docs/screenshots/18-dashboard.png) | ![](docs/screenshots/09-next-meal.png) | ![](docs/screenshots/12-product.png) |
| ![](docs/screenshots/22-family.png) | ![](docs/screenshots/21-ai.png) | ![](docs/screenshots/30-dark-dashboard.png) |

## ما الذي يعمل الآن (المراحل 1–3 + الميزات ذات الأولوية)

- **الهوية والتصميم:** Premium HealthTech (الأخضر الغابي، الذهبي، الأزرق المائي، المرجاني)، خط IBM Plex Sans Arabic، العربية افتراضياً مع RTL كامل (الحلقات والأشرطة والتنقل)، الإنجليزية LTR، الوضع الداكن، Bottom Sheets، Skeleton loading، حركات دقيقة، Haptics.
- **الحسابات والعائلة:** تسجيل بالبريد، إنشاء عائلة أو الانضمام برمز دعوة، مدير العائلة، أفراد بإشراف ولي الأمر (مع تسجيل الموافقة)، تبديل عرض بيانات الطفل.
- **الملف الصحي والأهداف:** Mifflin-St Jeor للبالغين، معادلة IOM للأطفال 3–18، مرجع عمري عند غياب الوزن، **بلا أي عجز حراري للقُصّر**، حد أدنى آمن للبالغين، أهداف قابلة للتخصيص.
- **محرك التغذية وسجل الوجبات:** 8 عناصر غذائية، بيانات من USDA FoodData Central، تحديث فوري للمتبقي، منع الاحتساب المزدوج (`dedupe_key` فريد).
- **ماذا آكل الآن؟** ثلاثة اقتراحات (الأنسب للماكرونات / صحي ومتنوع / سريع واقتصادي) من 24 وصفة. يوازن البروتين والكربوهيدرات والدهون، يحترم الحساسية والتفضيلات والأطعمة غير المرغوبة (مع استبدال تلقائي)، يتعلم من المفضلة والمرفوض والوجبات الأخيرة، ولا يدفع المستخدم لاستهلاك كل المتبقي. تعديل الكمية واستبدال المكون يعيدان الحساب فوراً.
- **ماسح الباركود:** EAN-13 / EAN-8 / UPC-A / UPC-E / QR (GS1 Digital Link) عبر `expo-camera`، بحث في Open Food Facts، بطاقة منتج كاملة، تقييم إرشادي غير قطعي، كميات 30/50/100/حصة/مخصص، وإدخال يدوي يُحفظ في قاعدة بيانات العائلة عند عدم وجود المنتج.
- **المنافسة العائلية:** نقاط للعادات فقط (الماء، الوجبات، النشاط، الخطوات)، يتحقق منها الخادم ولا تُمنح إلا مرة يومياً، لوحة متصدرين (يوم/أسبوع/شهر/الكل) مع منصة تتويج وسلاسل أيام وشارات، وقواعد نقاط يعدّلها المدير.
- **الماء والنشاط:** أزرار 150/250/350/500/مخصص، تسجيل نشاط يدوي مع تقدير سعرات قائم على MET (يظهر كتقدير، ولا يُحسب دون وزن).

## ما يحتاج مفاتيحك أو حساباتك (غير مفعّل وموضح في الواجهة)

| الخدمة | الحالة | ما المطلوب |
|---|---|---|
| Supabase | بدونها يعمل التطبيق في **وضع تجريبي محلي** مع شريط واضح | مشروع Supabase + `EXPO_PUBLIC_SUPABASE_URL` و`EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| الدخول برقم الجوال | الزر معطّل | مزوّد SMS (مثل Twilio) في Supabase، ثم `EXPO_PUBLIC_AUTH_PHONE=true` |
| Apple Sign In | الزر معطّل | حساب Apple Developer + مزوّد Apple في Supabase، ثم `EXPO_PUBLIC_AUTH_APPLE=true` |
| Google Sign In | الزر معطّل | Google OAuth client + مزوّد Google في Supabase، ثم `EXPO_PUBLIC_AUTH_GOOGLE=true` |
| تحليل صور الطعام / OCR / المساعد الصحي | معلّمة "المرحلة 4/8" وغير قابلة للضغط | مفتاح خدمة رؤية/LLM يوضع في أسرار Edge Functions (وليس في التطبيق) |
| Apple Health / Health Connect | الخطوات تُدخل يدوياً مع توضيح | بناء تطوير (development build) + الصلاحيات، المرحلة 6 |

## التشغيل

```bash
npm install
cp .env.example .env        # اتركه فارغاً لتجربة الوضع المحلي
npx expo start              # iOS / Android عبر Expo Go أو development build
npx expo start --web        # الويب (المسح بالكاميرا متاح على الهاتف فقط)
```

### ربط Supabase

```bash
supabase link --project-ref <ref>
supabase db push                       # supabase/migrations
psql "$DATABASE_URL" -f supabase/seed.sql   # الأطعمة والوصفات
supabase functions deploy delete-account
```

## الاختبارات

```bash
npm test                     # 27 اختباراً: محرك السعرات، الوجبة التالية، Open Food Facts، النقاط
npm run typecheck
PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run.sh   # الهجرة + اختبارات عزل RLS على Postgres
npm run seed                 # يعيد توليد supabase/seed.sql من src/data
```

اختبارات RLS تتحقق من: عزل العائلات تماماً، عدم رؤية البالغ لبيانات بالغ آخر الصحية، رؤية المدير لملفات الأطفال، منع كتابة النقاط مباشرة، النقاط مرة واحدة يومياً، ورفض تسجيل الوجبة نفسها مرتين.

## البنية

```
src/app/            الشاشات (Expo Router)
src/lib/            nutrition.ts · nextMeal.ts · openFoodFacts.ts · points.ts  (منطق نقي ومختبَر)
src/data/           foods.ts (USDA) · recipes.ts
src/backend/        supabase.ts · local.ts  (نفس الواجهة)
src/components/     نظام التصميم الموحد
supabase/           migrations · seed.sql · tests · functions
```

## المراحل القادمة

4) تحليل صور الطعام وOCR للملصق · 5) مخطط الوجبات الأسبوعي وقائمة المشتريات ومساعد الثلاجة · 6) النوم وربط Apple Health / Health Connect · 7) التحديات ومتجر المكافآت · 8) المساعد الصحي والتقارير وPDF والإشعارات · 9) اختبار شامل وتحسين الأداء والأمان.

> FamilyFit AI لا يقدّم تشخيصاً طبياً ولا يصف أدوية ولا يغني عن الطبيب.
