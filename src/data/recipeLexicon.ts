/**
 * Lexicon used by the recipe analyzer to turn free text ("2 كوب أرز", "3 eggs", "ملعقة زيت زيتون")
 * into foods + grams. Every gram value here is a household-measure weight (USDA FoodData Central
 * portion weights, rounded). Nutrition itself always comes from FOODS.
 */

/** Normalise Arabic/English text for matching: strip diacritics/tatweel, unify alef/ya/ta-marbuta, lowercase, Arabic-Indic digits → ASCII. */
export function norm(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/،/g, ',')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aliases per food id (Arabic and English, matched after norm()). Longest match wins. */
export const FOOD_ALIASES: Record<string, string[]> = {
  chicken_raw: ['صدر دجاج', 'صدور دجاج', 'دجاج', 'فراخ', 'chicken breast', 'chicken breasts', 'chicken'],
  chicken_thigh_raw: ['افخاذ دجاج', 'فخذ دجاج', 'وراك دجاج', 'chicken thigh', 'chicken thighs'],
  beef_raw: ['لحم مفروم', 'لحمه مفرومه', 'لحم بقري', 'لحم', 'كفته', 'ground beef', 'minced beef', 'beef', 'mince'],
  lean_beef_raw: ['لحم مفروم قليل الدهن', 'لحم قليل الدهن', 'lean ground beef', 'lean beef', 'extra lean beef'],
  salmon_raw: ['سلمون', 'سالمون', 'salmon'],
  shrimp_raw: ['روبيان', 'جمبري', 'قريدس', 'ربيان', 'shrimp', 'prawns', 'prawn'],
  tuna: ['تونه', 'tuna'],
  egg_raw: ['بيض', 'بيضه', 'بيضات', 'بيضتين', 'eggs', 'egg'],
  egg_white: ['بياض بيض', 'بياض البيض', 'egg white', 'egg whites'],
  milk_whole: ['حليب كامل الدسم', 'حليب', 'لبن حليب', 'whole milk', 'milk'],
  milk_lowfat: ['حليب قليل الدسم', 'حليب خالي الدسم', 'low fat milk', 'skim milk', 'skimmed milk', 'low-fat milk'],
  heavy_cream: ['كريمه طبخ', 'كريمه خفق', 'كريمه سائله', 'قشطه', 'كريمه', 'heavy cream', 'cooking cream', 'whipping cream', 'double cream', 'cream'],
  cream_cheese: ['جبنه كريميه', 'جبنه كريمي', 'جبنه فيلادلفيا', 'cream cheese'],
  cheddar: ['جبنه شيدر', 'شيدر', 'cheddar', 'cheddar cheese', 'shredded cheese'],
  mozzarella: ['موزاريلا', 'موتزاريلا', 'موزريلا', 'mozzarella'],
  parmesan: ['بارميزان', 'بارمزان', 'parmesan', 'parmigiano'],
  feta: ['فيتا', 'جبنه بيضاء', 'feta'],
  greek_yogurt: ['زبادي يوناني', 'لبنه', 'greek yogurt', 'labneh'],
  yogurt: ['زبادي', 'لبن زبادي', 'روب', 'yogurt', 'yoghurt'],
  cottage: ['جبن قريش', 'كوتيج', 'cottage cheese', 'cottage'],
  butter: ['زبده', 'سمن', 'butter', 'ghee'],
  olive_oil: ['زيت زيتون', 'زيت الزيتون', 'olive oil'],
  veg_oil: ['زيت نباتي', 'زيت ذره', 'زيت دوار الشمس', 'زيت كانولا', 'زيت للقلي', 'زيت', 'vegetable oil', 'sunflower oil', 'canola oil', 'corn oil', 'frying oil', 'oil'],
  mayonnaise: ['مايونيز', 'مايونيزه', 'mayonnaise', 'mayo'],
  rice_white_dry: ['ارز', 'رز', 'ارز بسمتي', 'ارز ابيض', 'rice', 'white rice', 'basmati rice', 'basmati'],
  rice_brown_dry: ['ارز بني', 'رز بني', 'brown rice'],
  pasta_dry: ['معكرونه', 'مكرونه', 'باستا', 'سباغيتي', 'اسباجتي', 'pasta', 'spaghetti', 'penne', 'macaroni', 'fusilli'],
  ww_pasta_dry: ['معكرونه قمح كامل', 'معكرونه بر', 'whole wheat pasta', 'wholewheat pasta', 'whole-wheat pasta'],
  flour_white: ['دقيق', 'طحين', 'دقيق ابيض', 'طحين ابيض', 'flour', 'all purpose flour', 'all-purpose flour', 'white flour'],
  flour_ww: ['دقيق قمح كامل', 'طحين اسمر', 'دقيق بر', 'whole wheat flour', 'wholemeal flour'],
  white_bread: ['خبز ابيض', 'توست', 'خبز توست', 'white bread', 'toast bread', 'bread'],
  ww_bread: ['خبز اسمر', 'خبز بر', 'خبز قمح كامل', 'whole wheat bread', 'wholemeal bread', 'brown bread'],
  pita: ['خبز عربي', 'خبز لبناني', 'pita', 'pita bread'],
  oats: ['شوفان', 'oats', 'rolled oats', 'oatmeal'],
  lentils_dry: ['عدس', 'lentils', 'red lentils', 'lentil'],
  bulgur_dry: ['برغل', 'bulgur', 'burghul'],
  quinoa_dry: ['كينوا', 'quinoa'],
  chickpeas: ['حمص حب', 'حمص مسلوق', 'حمص معلب', 'chickpeas', 'garbanzo'],
  fava: ['فول', 'fava beans', 'foul'],
  hummus: ['حمص بطحينه', 'hummus'],
  potato: ['بطاطس', 'بطاطا', 'potato', 'potatoes'],
  sweet_potato: ['بطاطا حلوه', 'sweet potato', 'sweet potatoes'],
  sugar: ['سكر', 'سكر بني', 'sugar', 'brown sugar', 'caster sugar'],
  honey: ['عسل', 'honey'],
  dates: ['تمر', 'تمور', 'تمرات', 'dates', 'date'],
  banana: ['موز', 'banana', 'bananas'],
  apple: ['تفاح', 'تفاحه', 'apple', 'apples'],
  orange: ['برتقال', 'orange', 'oranges'],
  strawberries: ['فراوله', 'strawberries', 'strawberry'],
  avocado: ['افوكادو', 'avocado'],
  cucumber: ['خيار', 'خياره', 'cucumber', 'cucumbers'],
  tomato: ['طماطم', 'بندوره', 'طماطه', 'tomato', 'tomatoes'],
  tomato_paste: ['معجون طماطم', 'صلصه طماطم', 'معجون', 'tomato paste', 'tomato puree'],
  lettuce: ['خس', 'lettuce'],
  spinach: ['سبانخ', 'spinach'],
  broccoli: ['بروكلي', 'broccoli'],
  carrot: ['جزر', 'جزره', 'carrot', 'carrots'],
  onion: ['بصل', 'بصله', 'onion', 'onions'],
  garlic: ['ثوم', 'فص ثوم', 'فصوص ثوم', 'garlic'],
  bell_pepper: ['فلفل رومي', 'فلفل الوان', 'فليفله', 'bell pepper', 'capsicum', 'peppers'],
  mushrooms: ['فطر', 'مشروم', 'mushrooms', 'mushroom'],
  parsley: ['بقدونس', 'كزبره', 'parsley', 'cilantro', 'coriander leaves'],
  lemon: ['ليمون', 'عصير ليمون', 'lemon', 'lemon juice', 'lime'],
  zucchini: ['كوسا', 'كوسه', 'zucchini', 'courgette'],
  eggplant: ['باذنجان', 'eggplant', 'aubergine'],
  cauliflower: ['قرنبيط', 'زهره', 'cauliflower'],
  tahini: ['طحينه', 'tahini'],
  peanut_butter: ['زبده فول سوداني', 'زبده الفول السوداني', 'peanut butter'],
  almonds: ['لوز', 'almonds', 'almond'],
  walnuts: ['جوز', 'عين جمل', 'walnuts', 'walnut'],
  chia: ['شيا', 'بذور الشيا', 'chia', 'chia seeds'],
  ketchup: ['كاتشب', 'كتشب', 'ketchup'],
  soy_sauce: ['صويا صوص', 'صلصه الصويا', 'صوص صويا', 'soy sauce'],
  coconut_milk: ['حليب جوز الهند', 'coconut milk'],
  salt: ['ملح', 'salt'],
  spices: ['بهارات', 'كمون', 'فلفل اسود', 'كركم', 'قرفه', 'بابريكا', 'هيل', 'زعتر', 'اوريغانو', 'spices', 'cumin', 'black pepper', 'pepper', 'turmeric', 'cinnamon', 'paprika', 'oregano', 'thyme', 'chili flakes', 'cardamom'],
  water: ['ماء', 'مويه', 'water'],
};

/** Words meaning the ingredient is already cooked → switch raw/dry form to cooked form. */
export const COOKED_WORDS = ['مطبوخ', 'مطبوخه', 'مسلوق', 'مسلوقه', 'مشوي', 'مشويه', 'cooked', 'boiled', 'grilled', 'leftover'];
export const COOKED_FORM: Record<string, string> = {
  rice_white_dry: 'rice_white', rice_brown_dry: 'rice_brown', pasta_dry: 'white_pasta', ww_pasta_dry: 'ww_pasta',
  lentils_dry: 'lentils', bulgur_dry: 'bulgur', quinoa_dry: 'quinoa', chicken_raw: 'chicken_breast', egg_raw: 'egg',
  salmon_raw: 'salmon', shrimp_raw: 'shrimp', lean_beef_raw: 'lean_beef',
};

export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup' | 'piece' | 'clove' | 'slice' | 'can' | 'pinch' | 'handful';

/** Unit words (normalised). Dual forms carry an implicit quantity of 2. */
export const UNIT_WORDS: { re: RegExp; unit: Unit; dual?: boolean }[] = [
  { re: /^(كيلو ?غرام|كيلو ?جرام|كيلو|كغ|كجم|kg|kgs|kilograms?|kilo)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'kg' },
  { re: /^(غرام|جرام|غم|جم|غ|grams?|gr|gms?|g)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'g' },
  { re: /^(مليلتر|ملليلتر|مل|ml|milliliters?|millilitres?)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'ml' },
  { re: /^(لتر|ليتر|l|liters?|litres?)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'l' },
  { re: /^(ملعقتين صغيرتين|ملعقتان صغيرتان)/, unit: 'tsp', dual: true },
  { re: /^(ملعقتين كبيرتين|ملعقتان كبيرتان|ملعقتين|ملعقتان)/, unit: 'tbsp', dual: true },
  { re: /^(ملاعق صغيره|ملعقه صغيره|م ص|tsp|teaspoons?|t)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'tsp' },
  { re: /^(ملاعق كبيره|ملعقه كبيره|ملاعق|ملعقه|م ك|tbsp|tbs|tablespoons?|tbl)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'tbsp' },
  { re: /^(كوبين|كاسين)/, unit: 'cup', dual: true },
  { re: /^(اكواب|كوب|كاسات|كاس|كاسه|cups?|c)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'cup' },
  { re: /^(فصين)/, unit: 'clove', dual: true },
  { re: /^(فصوص|فص|cloves?)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'clove' },
  { re: /^(شريحتين)/, unit: 'slice', dual: true },
  { re: /^(شرائح|شريحه|slices?)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'slice' },
  { re: /^(علبتين)/, unit: 'can', dual: true },
  { re: /^(علب|علبه|cans?|tins?)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'can' },
  { re: /^(رشه|رشات|pinch|dash)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'pinch' },
  { re: /^(حفنه|حفنات|قبضه|handfuls?)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'handful' },
  { re: /^(حبتين|قطعتين)/, unit: 'piece', dual: true },
  { re: /^(حبات|حبه|قطع|قطعه|اصابع|اصبع|pieces?|pcs|whole|large|medium|small)(?=$|[^a-z0-9\u0600-\u06ff])/, unit: 'piece' },
];

export const NUMBER_WORDS: [RegExp, number][] = [
  [/^(نصف|نص|half|1\/2|½)(?=$|[^a-z0-9\u0600-\u06ff])/, 0.5],
  [/^(ربع|quarter|1\/4|¼)(?=$|[^a-z0-9\u0600-\u06ff])/, 0.25],
  [/^(ثلاثه ارباع|three quarters|3\/4|¾)(?=$|[^a-z0-9\u0600-\u06ff])/, 0.75],
  [/^(ثلث|third|1\/3|⅓)(?=$|[^a-z0-9\u0600-\u06ff])/, 1 / 3],
  [/^(ثلثين|two thirds|2\/3|⅔)(?=$|[^a-z0-9\u0600-\u06ff])/, 2 / 3],
  [/^(واحد|واحده|one|a|an)(?=$|[^a-z0-9\u0600-\u06ff])/, 1],
  [/^(اثنين|اثنان|two)(?=$|[^a-z0-9\u0600-\u06ff])/, 2],
  [/^(ثلاث|ثلاثه|three)(?=$|[^a-z0-9\u0600-\u06ff])/, 3],
  [/^(اربع|اربعه|four)(?=$|[^a-z0-9\u0600-\u06ff])/, 4],
  [/^(خمس|خمسه|five)(?=$|[^a-z0-9\u0600-\u06ff])/, 5],
  [/^(ست|سته|six)(?=$|[^a-z0-9\u0600-\u06ff])/, 6],
];

export const TO_TASTE = /(حسب الرغبه|حسب الذوق|رشه|قليل من|to taste|as needed|optional|for garnish|للتزيين)/;

/** Grams in one US cup (≈240 ml) of each food, from USDA portion data (rounded). */
export const CUP_GRAMS: Record<string, number> = {
  flour_white: 125, flour_ww: 120, sugar: 200, honey: 340, rice_white_dry: 185, rice_brown_dry: 190, rice_white: 158, rice_brown: 195,
  oats: 90, milk_whole: 244, milk_lowfat: 244, heavy_cream: 238, yogurt: 245, greek_yogurt: 245, cottage: 226, cream_cheese: 232,
  cheddar: 113, mozzarella: 112, parmesan: 100, feta: 150, lentils_dry: 192, lentils: 198, bulgur_dry: 140, bulgur: 182, quinoa_dry: 170, quinoa: 185,
  pasta_dry: 100, ww_pasta_dry: 100, white_pasta: 140, ww_pasta: 140, chickpeas: 164, fava: 170, hummus: 246, olive_oil: 216, veg_oil: 218,
  butter: 227, mayonnaise: 220, tahini: 240, peanut_butter: 258, almonds: 143, walnuts: 117, chia: 168, dates: 147, strawberries: 152,
  onion: 160, tomato: 180, cucumber: 120, carrot: 128, spinach: 30, lettuce: 47, parsley: 60, broccoli: 91, mushrooms: 70, bell_pepper: 150,
  cauliflower: 107, zucchini: 124, eggplant: 82, potato: 150, sweet_potato: 133, tomato_paste: 262, ketchup: 240, soy_sauce: 255,
  coconut_milk: 226, water: 237, lemon: 244, chicken_raw: 140, chicken_breast: 140, beef_raw: 225, lean_beef: 135, tuna: 154, banana: 150, apple: 125,
  salt: 292, spices: 100,
};

/** Grams per piece/clove/slice/can for countable foods. */
export const PIECE_GRAMS: Record<string, number> = {
  egg_raw: 50, egg: 50, egg_white: 33, banana: 118, apple: 182, orange: 131, tomato: 123, onion: 110, cucumber: 200, carrot: 61,
  garlic: 3, bell_pepper: 119, potato: 213, sweet_potato: 130, lemon: 48, avocado: 136, dates: 8, pita: 60, white_bread: 25, ww_bread: 32,
  zucchini: 196, eggplant: 458, mushrooms: 18, cheddar: 21, mozzarella: 28, chicken_raw: 200, chicken_thigh_raw: 110, salmon_raw: 170,
  strawberries: 12, shrimp_raw: 15, cauliflower: 575, broccoli: 150,
};
export const CAN_GRAMS: Record<string, number> = { tuna: 120, chickpeas: 240, fava: 240, tomato_paste: 170, coconut_milk: 400, tomato: 400 };
export const HANDFUL_GRAMS: Record<string, number> = { almonds: 28, walnuts: 28, spinach: 30, lettuce: 30, parsley: 15, strawberries: 75, dates: 40, chickpeas: 40 };

/** Liquids where 1 ml ≈ density g. */
export const LIQUID_DENSITY: Record<string, number> = {
  water: 1, milk_whole: 1.03, milk_lowfat: 1.03, heavy_cream: 0.99, olive_oil: 0.91, veg_oil: 0.92, lemon: 1.02, soy_sauce: 1.08,
  coconut_milk: 0.97, honey: 1.42, yogurt: 1.03, greek_yogurt: 1.03, ketchup: 1.0, tahini: 1.0,
};
