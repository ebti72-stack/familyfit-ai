/**
 * Offline translations for recipe documents.
 *  - Labels and units: all seven document languages.
 *  - Filipino (Tagalog): every food name and every built-in recipe (title + steps), written in simple
 *    kitchen language for home helpers. Numbers, times and temperatures are identical to the source.
 * User recipes in other languages go through the translation service (supabase/functions/translate-recipe).
 */
import type { DocLang } from '../lib/recipe';
import type { Unit } from './recipeLexicon';

export const DOC_LANGS: { code: DocLang; native: string; rtl: boolean }[] = [
  { code: 'fil', native: 'Filipino (Tagalog)', rtl: false },
  { code: 'ar', native: 'العربية', rtl: true },
  { code: 'en', native: 'English', rtl: false },
  { code: 'hi', native: 'हिन्दी', rtl: false },
  { code: 'ur', native: 'اردو', rtl: true },
  { code: 'ne', native: 'नेपाली', rtl: false },
  { code: 'fr', native: 'Français', rtl: false },
];

export interface DocLabels {
  ingredients: string; steps: string; nutrition: string; servings: string; prep: string; cook: string; total: string;
  difficulty: string; easy: string; medium: string; hard: string; temperature: string; notes: string; alternatives: string;
  serving: string; perServing: string; whole: string; per100g: string; kcal: string; protein: string; carbs: string; fat: string;
  fiber: string; sugar: string; satFat: string; sodium: string; minutes: string; tools: string; step: string; estimated: string;
  toTaste: string; estimateNote: string; sourceNote: string; generated: string; confidence: string; high: string; low: string;
}

export const DOC_LABELS: Record<DocLang, DocLabels> = {
  ar: {
    ingredients: 'المكونات', steps: 'طريقة التحضير', nutrition: 'القيم الغذائية', servings: 'عدد الحصص', prep: 'وقت التحضير', cook: 'وقت الطهي', total: 'الإجمالي',
    difficulty: 'الصعوبة', easy: 'سهلة', medium: 'متوسطة', hard: 'صعبة', temperature: 'الحرارة', notes: 'ملاحظات', alternatives: 'بدائل', serving: 'طريقة التقديم',
    perServing: 'للحصة', whole: 'للوصفة كاملة', per100g: 'لكل 100 غ', kcal: 'سعرة', protein: 'بروتين', carbs: 'كربوهيدرات', fat: 'دهون', fiber: 'ألياف', sugar: 'سكر',
    satFat: 'دهون مشبعة', sodium: 'صوديوم', minutes: 'دقيقة', tools: 'الأدوات', step: 'الخطوة', estimated: 'تقديري', toTaste: 'حسب الرغبة',
    estimateNote: 'القيم محسوبة من كميات المكونات؛ الكميات المعلّمة "تقديري" ليست دقيقة.', sourceNote: 'المصدر الغذائي: USDA FoodData Central',
    generated: 'أُنشئ بواسطة FamilyFit AI', confidence: 'دقة الحساب', high: 'عالية', low: 'منخفضة',
  },
  en: {
    ingredients: 'Ingredients', steps: 'Method', nutrition: 'Nutrition', servings: 'Servings', prep: 'Prep time', cook: 'Cook time', total: 'Total',
    difficulty: 'Difficulty', easy: 'Easy', medium: 'Medium', hard: 'Hard', temperature: 'Temperature', notes: 'Notes', alternatives: 'Alternatives', serving: 'How to serve',
    perServing: 'Per serving', whole: 'Whole recipe', per100g: 'Per 100 g', kcal: 'kcal', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fiber: 'Fibre', sugar: 'Sugar',
    satFat: 'Saturated fat', sodium: 'Sodium', minutes: 'min', tools: 'Tools', step: 'Step', estimated: 'estimated', toTaste: 'to taste',
    estimateNote: 'Values are calculated from ingredient amounts; amounts marked "estimated" are not exact.', sourceNote: 'Nutrition source: USDA FoodData Central',
    generated: 'Created with FamilyFit AI', confidence: 'Accuracy', high: 'High', low: 'Low',
  },
  fil: {
    ingredients: 'Mga Sangkap', steps: 'Paraan ng Pagluluto', nutrition: 'Nutrisyon', servings: 'Ilang serving', prep: 'Oras ng paghahanda', cook: 'Oras ng pagluluto', total: 'Kabuuan',
    difficulty: 'Hirap', easy: 'Madali', medium: 'Katamtaman', hard: 'Mahirap', temperature: 'Init ng oven/kalan', notes: 'Paalala', alternatives: 'Pamalit', serving: 'Paano ihain',
    perServing: 'Bawat serving', whole: 'Buong recipe', per100g: 'Bawat 100 g', kcal: 'kcal', protein: 'Protina', carbs: 'Carbohydrates', fat: 'Taba', fiber: 'Fiber', sugar: 'Asukal',
    satFat: 'Saturated fat', sodium: 'Sodium', minutes: 'minuto', tools: 'Mga gamit', step: 'Hakbang', estimated: 'tantiya', toTaste: 'ayon sa panlasa',
    estimateNote: 'Kinuwenta ang nutrisyon mula sa dami ng mga sangkap; ang may markang "tantiya" ay hindi eksakto.', sourceNote: 'Pinagmulan ng datos: USDA FoodData Central',
    generated: 'Ginawa gamit ang FamilyFit AI', confidence: 'Katiyakan', high: 'Mataas', low: 'Mababa',
  },
  hi: {
    ingredients: 'सामग्री', steps: 'बनाने की विधि', nutrition: 'पोषण मान', servings: 'सर्विंग्स', prep: 'तैयारी का समय', cook: 'पकाने का समय', total: 'कुल',
    difficulty: 'कठिनाई', easy: 'आसान', medium: 'मध्यम', hard: 'कठिन', temperature: 'तापमान', notes: 'नोट्स', alternatives: 'विकल्प', serving: 'परोसने का तरीका',
    perServing: 'प्रति सर्विंग', whole: 'पूरी रेसिपी', per100g: 'प्रति 100 ग्राम', kcal: 'कैलोरी', protein: 'प्रोटीन', carbs: 'कार्बोहाइड्रेट', fat: 'वसा', fiber: 'फाइबर', sugar: 'चीनी',
    satFat: 'संतृप्त वसा', sodium: 'सोडियम', minutes: 'मिनट', tools: 'उपकरण', step: 'चरण', estimated: 'अनुमानित', toTaste: 'स्वादानुसार',
    estimateNote: 'पोषण मान सामग्री की मात्रा से गणना किए गए हैं; "अनुमानित" मात्राएँ सटीक नहीं हैं।', sourceNote: 'पोषण स्रोत: USDA FoodData Central',
    generated: 'FamilyFit AI द्वारा बनाया गया', confidence: 'सटीकता', high: 'उच्च', low: 'कम',
  },
  ur: {
    ingredients: 'اجزاء', steps: 'ترکیب', nutrition: 'غذائی معلومات', servings: 'سرونگز', prep: 'تیاری کا وقت', cook: 'پکانے کا وقت', total: 'کل',
    difficulty: 'دشواری', easy: 'آسان', medium: 'درمیانی', hard: 'مشکل', temperature: 'درجہ حرارت', notes: 'نوٹس', alternatives: 'متبادل', serving: 'پیش کرنے کا طریقہ',
    perServing: 'فی سرونگ', whole: 'پوری ترکیب', per100g: 'فی 100 گرام', kcal: 'کیلوریز', protein: 'پروٹین', carbs: 'کاربوہائیڈریٹس', fat: 'چکنائی', fiber: 'فائبر', sugar: 'چینی',
    satFat: 'سیر شدہ چکنائی', sodium: 'سوڈیم', minutes: 'منٹ', tools: 'برتن اور اوزار', step: 'مرحلہ', estimated: 'تخمینی', toTaste: 'حسبِ ذائقہ',
    estimateNote: 'غذائی اقدار اجزاء کی مقدار سے حساب کی گئی ہیں؛ "تخمینی" مقداریں درست نہیں ہیں۔', sourceNote: 'غذائی ماخذ: USDA FoodData Central',
    generated: 'FamilyFit AI سے تیار کردہ', confidence: 'درستگی', high: 'زیادہ', low: 'کم',
  },
  ne: {
    ingredients: 'सामग्री', steps: 'बनाउने तरिका', nutrition: 'पोषण मान', servings: 'सर्भिङ', prep: 'तयारी समय', cook: 'पकाउने समय', total: 'जम्मा',
    difficulty: 'कठिनाइ', easy: 'सजिलो', medium: 'मध्यम', hard: 'गाह्रो', temperature: 'तापक्रम', notes: 'टिप्पणी', alternatives: 'विकल्प', serving: 'पस्कने तरिका',
    perServing: 'प्रति सर्भिङ', whole: 'पूरा परिकार', per100g: 'प्रति 100 ग्राम', kcal: 'क्यालोरी', protein: 'प्रोटिन', carbs: 'कार्बोहाइड्रेट', fat: 'बोसो', fiber: 'फाइबर', sugar: 'चिनी',
    satFat: 'संतृप्त बोसो', sodium: 'सोडियम', minutes: 'मिनेट', tools: 'भाँडाकुँडा', step: 'चरण', estimated: 'अनुमानित', toTaste: 'स्वाद अनुसार',
    estimateNote: 'पोषण मान सामग्रीको मात्राबाट गणना गरिएको हो; "अनुमानित" मात्रा ठ्याक्कै होइन।', sourceNote: 'पोषण स्रोत: USDA FoodData Central',
    generated: 'FamilyFit AI द्वारा तयार', confidence: 'शुद्धता', high: 'उच्च', low: 'कम',
  },
  fr: {
    ingredients: 'Ingrédients', steps: 'Préparation', nutrition: 'Valeurs nutritionnelles', servings: 'Portions', prep: 'Préparation', cook: 'Cuisson', total: 'Total',
    difficulty: 'Difficulté', easy: 'Facile', medium: 'Moyenne', hard: 'Difficile', temperature: 'Température', notes: 'Remarques', alternatives: 'Alternatives', serving: 'Service',
    perServing: 'Par portion', whole: 'Recette entière', per100g: 'Pour 100 g', kcal: 'kcal', protein: 'Protéines', carbs: 'Glucides', fat: 'Lipides', fiber: 'Fibres', sugar: 'Sucres',
    satFat: 'Graisses saturées', sodium: 'Sodium', minutes: 'min', tools: 'Ustensiles', step: 'Étape', estimated: 'estimée', toTaste: 'selon le goût',
    estimateNote: 'Valeurs calculées à partir des quantités ; les quantités marquées « estimée » ne sont pas exactes.', sourceNote: 'Source nutritionnelle : USDA FoodData Central',
    generated: 'Créé avec FamilyFit AI', confidence: 'Fiabilité', high: 'Élevée', low: 'Faible',
  },
};

export const UNIT_LABELS: Record<DocLang, Record<Unit, string>> = {
  ar: { g: 'غ', kg: 'كغ', ml: 'مل', l: 'لتر', tsp: 'ملعقة صغيرة', tbsp: 'ملعقة كبيرة', cup: 'كوب', piece: 'حبة', clove: 'فص', slice: 'شريحة', can: 'علبة', pinch: 'رشة', handful: 'حفنة' },
  en: { g: 'g', kg: 'kg', ml: 'ml', l: 'L', tsp: 'tsp', tbsp: 'tbsp', cup: 'cup', piece: 'piece', clove: 'clove', slice: 'slice', can: 'can', pinch: 'pinch', handful: 'handful' },
  fil: { g: 'g', kg: 'kg', ml: 'ml', l: 'litro', tsp: 'kutsarita (tsp)', tbsp: 'kutsara (tbsp)', cup: 'tasa (cup)', piece: 'piraso', clove: 'butil', slice: 'hiwa', can: 'lata', pinch: 'kurot', handful: 'dakot' },
  hi: { g: 'ग्राम', kg: 'कि.ग्रा.', ml: 'मि.ली.', l: 'लीटर', tsp: 'छोटा चम्मच', tbsp: 'बड़ा चम्मच', cup: 'कप', piece: 'नग', clove: 'कली', slice: 'स्लाइस', can: 'डिब्बा', pinch: 'चुटकी', handful: 'मुट्ठी' },
  ur: { g: 'گرام', kg: 'کلو', ml: 'ملی لیٹر', l: 'لیٹر', tsp: 'چائے کا چمچ', tbsp: 'کھانے کا چمچ', cup: 'کپ', piece: 'عدد', clove: 'جوا', slice: 'سلائس', can: 'ڈبہ', pinch: 'چٹکی', handful: 'مٹھی' },
  ne: { g: 'ग्राम', kg: 'के.जी.', ml: 'मि.लि.', l: 'लिटर', tsp: 'सानो चम्चा', tbsp: 'ठूलो चम्चा', cup: 'कप', piece: 'वटा', clove: 'केस्रा', slice: 'टुक्रा', can: 'डिब्बा', pinch: 'चिम्टी', handful: 'मुठी' },
  fr: { g: 'g', kg: 'kg', ml: 'ml', l: 'l', tsp: 'c. à café', tbsp: 'c. à soupe', cup: 'tasse', piece: 'pièce', clove: 'gousse', slice: 'tranche', can: 'boîte', pinch: 'pincée', handful: 'poignée' },
};

/** Filipino food names for every FOODS id. */
export const FIL_FOODS: Record<string, string> = {
  chicken_breast: 'Inihaw na pitso ng manok', lean_beef: 'Giniling na baka na kaunti ang taba (luto)', salmon: 'Inihurnong salmon', tuna: 'De-latang tuna sa tubig',
  shrimp: 'Lutong hipon', egg: 'Nilagang itlog', egg_white: 'Puti ng itlog', milk_lowfat: 'Low-fat na gatas', greek_yogurt: 'Greek yogurt (walang taba)',
  yogurt: 'Plain yogurt', cottage: 'Cottage cheese (low-fat)', feta: 'Feta cheese', mozzarella: 'Mozzarella cheese', rice_brown: 'Lutong brown rice',
  rice_white: 'Lutong puting kanin', quinoa: 'Lutong quinoa', bulgur: 'Lutong bulgur', oats: 'Oats (hilaw)', ww_bread: 'Whole wheat na tinapay',
  pita: 'Whole wheat na pita bread', ww_pasta: 'Lutong whole wheat pasta', potato: 'Inihurnong patatas', sweet_potato: 'Inihurnong kamote',
  lentils: 'Lutong lentils', chickpeas: 'Lutong chickpeas (garbanzos)', fava: 'Lutong fava beans (foul)', hummus: 'Hummus', banana: 'Saging',
  apple: 'Mansanas', orange: 'Dalandan (orange)', strawberries: 'Strawberry', dates: 'Datiles (dates)', avocado: 'Abokado', cucumber: 'Pipino',
  tomato: 'Kamatis', lettuce: 'Litsugas (romaine)', spinach: 'Spinach', broccoli: 'Lutong broccoli', carrot: 'Karot', onion: 'Sibuyas',
  bell_pepper: 'Pulang bell pepper', mushrooms: 'Kabute', parsley: 'Parsley', lemon: 'Katas ng lemon', olive_oil: 'Olive oil',
  tahini: 'Tahini (sesame paste)', peanut_butter: 'Peanut butter', almonds: 'Almendras (almonds)', walnuts: 'Walnuts', chia: 'Chia seeds',
  honey: 'Pulot (honey)', chicken_raw: 'Hilaw na pitso ng manok', chicken_thigh_raw: 'Hilaw na hita ng manok (walang balat)',
  beef_raw: 'Hilaw na giniling na baka', lean_beef_raw: 'Hilaw na giniling na baka (kaunti ang taba)', salmon_raw: 'Hilaw na salmon',
  shrimp_raw: 'Hilaw na hipon', egg_raw: 'Itlog', milk_whole: 'Full cream na gatas', heavy_cream: 'Heavy cream / all-purpose cream',
  cream_cheese: 'Cream cheese', cheddar: 'Cheddar cheese', parmesan: 'Parmesan cheese', butter: 'Mantikilya (butter)', veg_oil: 'Mantika (vegetable oil)',
  mayonnaise: 'Mayonnaise', rice_white_dry: 'Hilaw na puting bigas', rice_brown_dry: 'Hilaw na brown rice', pasta_dry: 'Hilaw na pasta',
  ww_pasta_dry: 'Hilaw na whole wheat pasta', white_pasta: 'Lutong pasta', flour_white: 'Harina (all-purpose)', flour_ww: 'Whole wheat na harina',
  white_bread: 'Puting tinapay (loaf bread)', lentils_dry: 'Hilaw na lentils', bulgur_dry: 'Hilaw na bulgur', quinoa_dry: 'Hilaw na quinoa',
  sugar: 'Asukal', garlic: 'Bawang', zucchini: 'Zucchini', eggplant: 'Talong', cauliflower: 'Cauliflower', tomato_paste: 'Tomato paste',
  ketchup: 'Ketchup', soy_sauce: 'Toyo', coconut_milk: 'Gata ng niyog', salt: 'Asin', spices: 'Mga pampalasa (spices)', water: 'Tubig',
};

/** Filipino titles and steps for the built-in recipes (same numbers as the English source). */
export const FIL_RECIPES: Record<string, { title: string; steps: string[] }> = {
  oats_berries: { title: 'Oats na may gatas, strawberry at chia', steps: ['Pakuluan nang mahina ang oats sa gatas nang 4 na minuto.', 'Ihalo ang chia seeds.', 'Lagyan sa ibabaw ng strawberry at kaunting pulot.'] },
  foul_plate: { title: 'Foul (fava beans) na may olive oil at pita', steps: ['Painitin ang fava beans at bahagyang durugin.', 'Lagyan ng katas ng lemon at olive oil.', 'Ihain kasama ang kamatis, pipino at pita bread.'] },
  greek_yogurt_bowl: { title: 'Greek yogurt na may almendras at strawberry', steps: ['Ilagay ang yogurt sa mangkok.', 'Lagyan sa ibabaw ng prutas, almendras at pulot.'] },
  veggie_omelette: { title: 'Omelette na may spinach at feta, at tinapay', steps: ['Batihin ang mga itlog.', 'Igisa ang spinach sa olive oil nang isang minuto.', 'Idagdag ang itlog at feta; lutuin hanggang mabuo.', 'Ihain kasama ang kamatis at tinapay.'] },
  cottage_plate: { title: 'Cottage cheese na may gulay', steps: ['Hiwain ang mga gulay.', 'Ilagay sa plato ang keso at gulay, at patakan ng kaunting olive oil.', 'Ihain kasama ang tinapay.'] },
  pb_banana_toast: { title: 'Tinapay na may peanut butter at saging', steps: ['I-toast ang tinapay.', 'Palamanan ng peanut butter.', 'Lagyan sa ibabaw ng hiniwang saging.'] },
  chicken_rice_bowl: { title: 'Inihaw na manok, brown rice at broccoli', steps: ['Timplahan ang manok at ihawin nang 6–7 minuto bawat side.', 'I-steam ang broccoli nang 5 minuto.', 'Ihain sa ibabaw ng kanin at patakan ng kaunting olive oil.'] },
  salmon_sweet_potato: { title: 'Inihurnong salmon, kamote at spinach', steps: ['I-bake ang kamote nang 20 minuto.', 'Idagdag ang salmon sa huling 12 minuto.', 'Ihain kasama ang spinach at lemon.'] },
  lentil_soup: { title: 'Sabaw ng lentils at karot, may pita', steps: ['Igisa ang sibuyas at karot sa mantika.', 'Idagdag ang lentils at tubig; pakuluan nang mahina nang 20 minuto.', 'I-blender at lagyan ng katas ng lemon.'] },
  tuna_salad: { title: 'Salad na tuna at chickpeas', steps: ['Hiwain ang mga gulay.', 'Idagdag ang tuna (tinanggalan ng tubig) at chickpeas.', 'Timplahan ng lemon at olive oil.'] },
  chicken_wrap: { title: 'Wrap na manok at tahini', steps: ['Hiwain ang inihaw na manok.', 'Palamanan ng tahini ang pita bread.', 'Ilagay ang manok at gulay; irolyo.'] },
  beef_bulgur: { title: 'Bulgur na may baka at kamatis', steps: ['Igisa ang sibuyas at baka hanggang pumula.', 'Idagdag ang kamatis, bulgur at tubig.', 'Pakuluan nang mahina nang 15 minuto.'] },
  shrimp_quinoa: { title: 'Hipon, quinoa at bell pepper', steps: ['Lutuin ang quinoa nang 15 minuto.', 'Igisa ang hipon at bell pepper nang 4 na minuto.', 'Paghaluin at lagyan ng lemon.'] },
  chickpea_salad: { title: 'Salad na chickpeas, feta at parsley', steps: ['Ihalo ang chickpeas sa hiniwang gulay.', 'Durugin ang feta sa ibabaw.', 'Timplahan ng lemon at olive oil.'] },
  chicken_pasta: { title: 'Whole wheat pasta na may manok at kamatis', steps: ['Pakuluan ang pasta.', 'Lutuin ang manok at kabute, saka idagdag ang kamatis.', 'Ihalo sa pasta at budburan ng keso.'] },
  potato_tuna: { title: 'Inihurnong patatas na may tuna at yogurt', steps: ['Lutuin ang patatas (microwave nang 8 minuto o sa oven).', 'Ihalo ang tuna sa yogurt.', 'Palamanan ang patatas at budburan ng parsley.'] },
  egg_avocado_sandwich: { title: 'Sandwich na itlog at abokado', steps: ['Pakuluan ang itlog nang 9 na minuto.', 'Durugin ang abokado at ipahid sa tinapay.', 'Ilagay ang hiniwang itlog at kamatis.'] },
  chicken_salad_light: { title: 'Magaan na salad na manok', steps: ['Hiwain ang inihaw na manok.', 'Ihalo sa mga gulay.', 'Timplahan ng lemon at olive oil.'] },
  apple_pb: { title: 'Mansanas na may peanut butter', steps: ['Hiwain ang mansanas.', 'Ihain kasama ang peanut butter.'] },
  yogurt_dates: { title: 'Greek yogurt na may datiles', steps: ['Ihain ang yogurt na may hiniwang datiles.'] },
  hummus_veg: { title: 'Hummus na may karot at pipino', steps: ['Hiwain nang pahaba ang mga gulay.', 'Ihain kasama ang hummus.'] },
  almonds_orange: { title: 'Dalandan at isang dakot na almendras', steps: ['Balatan ang dalandan at ihain kasama ang almendras.'] },
  eggs_cucumber: { title: 'Dalawang nilagang itlog na may pipino', steps: ['Pakuluan ang itlog nang 9 na minuto.', 'Ihain kasama ang pipino.'] },
  cottage_berries: { title: 'Cottage cheese na may strawberry', steps: ['Ilagay ang cottage cheese sa mangkok at lagyan ng strawberry.'] },
};
