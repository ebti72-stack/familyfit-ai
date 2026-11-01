import type { MealType } from '../lib/types';

export interface RecipeIngredient {
  food: string; // FoodItem id
  grams: number;
  /** Interchangeable foods offered by the "swap ingredient" button. */
  swaps?: string[];
}

export interface Recipe {
  id: string;
  ar: string;
  en: string;
  emoji: string;
  mealTypes: MealType[];
  style: 'bowl' | 'salad' | 'sandwich' | 'breakfast' | 'snack' | 'soup' | 'pasta' | 'fish' | 'legumes' | 'plate';
  prepMinutes: number;
  cost: 1 | 2 | 3;
  kidFriendly: boolean;
  vegetarian: boolean;
  ingredients: RecipeIngredient[];
  stepsAr: string[];
  stepsEn: string[];
}

const PROTEIN_SWAPS = ['chicken_breast', 'tuna', 'shrimp', 'lean_beef', 'salmon'];
const CARB_SWAPS = ['rice_brown', 'rice_white', 'quinoa', 'bulgur', 'sweet_potato', 'potato'];

export const RECIPES: Recipe[] = [
  // ---------- Breakfast ----------
  {
    id: 'oats_berries', ar: 'شوفان بالحليب والفراولة والشيا', en: 'Oats with milk, berries & chia', emoji: '🥣',
    mealTypes: ['breakfast'], style: 'breakfast', prepMinutes: 7, cost: 1, kidFriendly: true, vegetarian: true,
    ingredients: [
      { food: 'oats', grams: 50 }, { food: 'milk_lowfat', grams: 200, swaps: ['yogurt', 'greek_yogurt'] },
      { food: 'strawberries', grams: 80, swaps: ['banana', 'apple'] }, { food: 'chia', grams: 10, swaps: ['almonds', 'walnuts'] },
      { food: 'honey', grams: 8 },
    ],
    stepsAr: ['اطهُ الشوفان مع الحليب على نار هادئة 4 دقائق.', 'أضف الشيا وقلّب.', 'زيّن بالفراولة ورشة عسل.'],
    stepsEn: ['Simmer oats in milk for 4 minutes.', 'Stir in chia seeds.', 'Top with strawberries and a drizzle of honey.'],
  },
  {
    id: 'foul_plate', ar: 'فول مدمس بزيت الزيتون مع خبز أسمر', en: 'Foul medames with olive oil & pita', emoji: '🫘',
    mealTypes: ['breakfast', 'dinner'], style: 'legumes', prepMinutes: 10, cost: 1, kidFriendly: false, vegetarian: true,
    ingredients: [
      { food: 'fava', grams: 180, swaps: ['chickpeas', 'lentils'] }, { food: 'olive_oil', grams: 8 }, { food: 'lemon', grams: 10 },
      { food: 'tomato', grams: 70 }, { food: 'cucumber', grams: 60 }, { food: 'pita', grams: 50, swaps: ['ww_bread'] },
    ],
    stepsAr: ['سخّن الفول واهرسه قليلاً.', 'أضف الليمون وزيت الزيتون.', 'قدّمه مع الطماطم والخيار والخبز.'],
    stepsEn: ['Warm the beans and lightly mash.', 'Add lemon juice and olive oil.', 'Serve with tomato, cucumber and pita.'],
  },
  {
    id: 'greek_yogurt_bowl', ar: 'زبادي يوناني باللوز والفراولة', en: 'Greek yogurt bowl with almonds & berries', emoji: '🍓',
    mealTypes: ['breakfast', 'snack'], style: 'breakfast', prepMinutes: 3, cost: 2, kidFriendly: true, vegetarian: true,
    ingredients: [
      { food: 'greek_yogurt', grams: 200, swaps: ['cottage', 'yogurt'] }, { food: 'strawberries', grams: 80, swaps: ['banana', 'apple', 'orange'] },
      { food: 'almonds', grams: 15, swaps: ['walnuts', 'chia'] }, { food: 'honey', grams: 8 },
    ],
    stepsAr: ['ضع الزبادي في وعاء.', 'أضف الفاكهة واللوز والعسل.'],
    stepsEn: ['Spoon yogurt into a bowl.', 'Top with fruit, almonds and honey.'],
  },
  {
    id: 'veggie_omelette', ar: 'أومليت بالسبانخ والفيتا مع خبز', en: 'Spinach & feta omelette with toast', emoji: '🍳',
    mealTypes: ['breakfast', 'dinner'], style: 'plate', prepMinutes: 10, cost: 1, kidFriendly: true, vegetarian: true,
    ingredients: [
      { food: 'egg', grams: 120 }, { food: 'spinach', grams: 40, swaps: ['mushrooms', 'bell_pepper'] }, { food: 'tomato', grams: 60 },
      { food: 'feta', grams: 20, swaps: ['mozzarella', 'cottage'] }, { food: 'olive_oil', grams: 5 }, { food: 'ww_bread', grams: 40, swaps: ['pita'] },
    ],
    stepsAr: ['اخفق البيض.', 'شوّح السبانخ في زيت الزيتون دقيقة.', 'أضف البيض والفيتا واطهُ حتى يتماسك.', 'قدّمه مع الطماطم والخبز.'],
    stepsEn: ['Whisk the eggs.', 'Sauté spinach in olive oil for a minute.', 'Add eggs and feta; cook until set.', 'Serve with tomato and toast.'],
  },
  {
    id: 'cottage_plate', ar: 'جبن قريش مع خضار وخبز أسمر', en: 'Cottage cheese plate with veggies', emoji: '🧀',
    mealTypes: ['breakfast', 'dinner'], style: 'plate', prepMinutes: 5, cost: 1, kidFriendly: true, vegetarian: true,
    ingredients: [
      { food: 'cottage', grams: 150, swaps: ['greek_yogurt', 'feta'] }, { food: 'cucumber', grams: 80 }, { food: 'tomato', grams: 80 },
      { food: 'olive_oil', grams: 5 }, { food: 'ww_bread', grams: 50, swaps: ['pita'] },
    ],
    stepsAr: ['قطّع الخضار.', 'رتّب الجبن والخضار مع رشة زيت زيتون.', 'قدّمه مع الخبز.'],
    stepsEn: ['Slice the vegetables.', 'Plate cheese and veggies with a drizzle of olive oil.', 'Serve with bread.'],
  },
  {
    id: 'pb_banana_toast', ar: 'توست بزبدة الفول السوداني والموز', en: 'Peanut butter & banana toast', emoji: '🍞',
    mealTypes: ['breakfast', 'snack'], style: 'sandwich', prepMinutes: 3, cost: 1, kidFriendly: true, vegetarian: true,
    ingredients: [
      { food: 'ww_bread', grams: 60 }, { food: 'peanut_butter', grams: 20, swaps: ['tahini', 'almonds'] }, { food: 'banana', grams: 80, swaps: ['strawberries', 'apple'] },
    ],
    stepsAr: ['حمّص الخبز.', 'ادهنه بزبدة الفول السوداني.', 'أضف شرائح الموز.'],
    stepsEn: ['Toast the bread.', 'Spread peanut butter.', 'Top with banana slices.'],
  },
  // ---------- Lunch / dinner ----------
  {
    id: 'chicken_rice_bowl', ar: 'وعاء دجاج مشوي مع أرز بني وبروكلي', en: 'Grilled chicken, brown rice & broccoli bowl', emoji: '🍗',
    mealTypes: ['lunch', 'dinner'], style: 'bowl', prepMinutes: 25, cost: 2, kidFriendly: true, vegetarian: false,
    ingredients: [
      { food: 'chicken_breast', grams: 150, swaps: PROTEIN_SWAPS.filter((x) => x !== 'chicken_breast') },
      { food: 'rice_brown', grams: 150, swaps: CARB_SWAPS.filter((x) => x !== 'rice_brown') },
      { food: 'broccoli', grams: 100, swaps: ['spinach', 'carrot', 'bell_pepper'] }, { food: 'olive_oil', grams: 5 },
    ],
    stepsAr: ['تبّل الدجاج واشوِه 6–7 دقائق لكل جهة.', 'اطهُ البروكلي على البخار 5 دقائق.', 'قدّمه فوق الأرز مع رشة زيت زيتون.'],
    stepsEn: ['Season and grill chicken 6–7 min per side.', 'Steam broccoli for 5 minutes.', 'Serve over rice with a drizzle of olive oil.'],
  },
  {
    id: 'salmon_sweet_potato', ar: 'سلمون مشوي مع بطاطا حلوة وسبانخ', en: 'Baked salmon, sweet potato & spinach', emoji: '🐟',
    mealTypes: ['lunch', 'dinner'], style: 'fish', prepMinutes: 25, cost: 3, kidFriendly: false, vegetarian: false,
    ingredients: [
      { food: 'salmon', grams: 130, swaps: ['tuna', 'shrimp', 'chicken_breast'] }, { food: 'sweet_potato', grams: 150, swaps: ['potato', 'rice_brown', 'quinoa'] },
      { food: 'spinach', grams: 60, swaps: ['broccoli', 'lettuce'] }, { food: 'lemon', grams: 10 },
    ],
    stepsAr: ['اشوِ البطاطا الحلوة في الفرن 20 دقيقة.', 'أضف السلمون آخر 12 دقيقة.', 'قدّمه مع السبانخ والليمون.'],
    stepsEn: ['Roast sweet potato for 20 minutes.', 'Add salmon for the last 12 minutes.', 'Serve with spinach and lemon.'],
  },
  {
    id: 'lentil_soup', ar: 'شوربة عدس بالجزر مع خبز', en: 'Lentil & carrot soup with pita', emoji: '🍲',
    mealTypes: ['lunch', 'dinner'], style: 'soup', prepMinutes: 30, cost: 1, kidFriendly: true, vegetarian: true,
    ingredients: [
      { food: 'lentils', grams: 220 }, { food: 'carrot', grams: 50 }, { food: 'onion', grams: 40 },
      { food: 'olive_oil', grams: 7 }, { food: 'lemon', grams: 10 }, { food: 'pita', grams: 40, swaps: ['ww_bread'] },
    ],
    stepsAr: ['شوّح البصل والجزر في الزيت.', 'أضف العدس والماء واطهُ 20 دقيقة.', 'اخلطه وأضف الليمون.'],
    stepsEn: ['Sauté onion and carrot in oil.', 'Add lentils and water; simmer 20 minutes.', 'Blend and finish with lemon.'],
  },
  {
    id: 'tuna_salad', ar: 'سلطة تونة بالحمص', en: 'Tuna & chickpea salad', emoji: '🥗',
    mealTypes: ['lunch', 'dinner'], style: 'salad', prepMinutes: 8, cost: 1, kidFriendly: false, vegetarian: false,
    ingredients: [
      { food: 'tuna', grams: 120, swaps: ['chicken_breast', 'egg', 'shrimp'] }, { food: 'lettuce', grams: 80, swaps: ['spinach'] },
      { food: 'tomato', grams: 80 }, { food: 'cucumber', grams: 80 }, { food: 'chickpeas', grams: 60, swaps: ['quinoa', 'fava'] },
      { food: 'olive_oil', grams: 7 }, { food: 'lemon', grams: 10 },
    ],
    stepsAr: ['قطّع الخضار.', 'أضف التونة المصفاة والحمص.', 'تبّل بالليمون وزيت الزيتون.'],
    stepsEn: ['Chop the vegetables.', 'Add drained tuna and chickpeas.', 'Dress with lemon and olive oil.'],
  },
  {
    id: 'chicken_wrap', ar: 'لفافة دجاج بالطحينة والخضار', en: 'Chicken & tahini wrap', emoji: '🌯',
    mealTypes: ['lunch', 'dinner'], style: 'sandwich', prepMinutes: 15, cost: 2, kidFriendly: true, vegetarian: false,
    ingredients: [
      { food: 'chicken_breast', grams: 120, swaps: ['tuna', 'lean_beef', 'egg'] }, { food: 'pita', grams: 70, swaps: ['ww_bread'] },
      { food: 'tomato', grams: 40 }, { food: 'lettuce', grams: 30 }, { food: 'tahini', grams: 15, swaps: ['greek_yogurt', 'hummus'] },
    ],
    stepsAr: ['قطّع الدجاج المشوي شرائح.', 'ادهن الخبز بالطحينة.', 'أضف الدجاج والخضار ولفّه.'],
    stepsEn: ['Slice the grilled chicken.', 'Spread tahini on the pita.', 'Add chicken and veggies; roll up.'],
  },
  {
    id: 'beef_bulgur', ar: 'برغل باللحم والطماطم', en: 'Bulgur with lean beef & tomato', emoji: '🥘',
    mealTypes: ['lunch', 'dinner'], style: 'plate', prepMinutes: 30, cost: 2, kidFriendly: true, vegetarian: false,
    ingredients: [
      { food: 'lean_beef', grams: 120, swaps: ['chicken_breast', 'lentils'] }, { food: 'bulgur', grams: 160, swaps: ['rice_brown', 'quinoa'] },
      { food: 'tomato', grams: 80 }, { food: 'onion', grams: 30 }, { food: 'olive_oil', grams: 5 },
    ],
    stepsAr: ['شوّح البصل واللحم حتى ينضج.', 'أضف الطماطم والبرغل والماء.', 'اتركه على نار هادئة 15 دقيقة.'],
    stepsEn: ['Brown onion and beef.', 'Add tomato, bulgur and water.', 'Simmer for 15 minutes.'],
  },
  {
    id: 'shrimp_quinoa', ar: 'روبيان مع كينوا وفلفل', en: 'Shrimp, quinoa & pepper bowl', emoji: '🍤',
    mealTypes: ['lunch', 'dinner'], style: 'bowl', prepMinutes: 20, cost: 3, kidFriendly: false, vegetarian: false,
    ingredients: [
      { food: 'shrimp', grams: 150, swaps: ['chicken_breast', 'salmon', 'tuna'] }, { food: 'quinoa', grams: 150, swaps: ['rice_brown', 'bulgur'] },
      { food: 'bell_pepper', grams: 70, swaps: ['broccoli', 'mushrooms'] }, { food: 'olive_oil', grams: 7 }, { food: 'lemon', grams: 10 },
    ],
    stepsAr: ['اطهُ الكينوا 15 دقيقة.', 'شوّح الروبيان والفلفل 4 دقائق.', 'اجمعها مع الليمون.'],
    stepsEn: ['Cook quinoa for 15 minutes.', 'Sauté shrimp and pepper for 4 minutes.', 'Combine with lemon.'],
  },
  {
    id: 'chickpea_salad', ar: 'سلطة حمص بالفيتا والبقدونس', en: 'Chickpea, feta & parsley salad', emoji: '🥙',
    mealTypes: ['lunch', 'dinner'], style: 'salad', prepMinutes: 10, cost: 1, kidFriendly: false, vegetarian: true,
    ingredients: [
      { food: 'chickpeas', grams: 160, swaps: ['lentils', 'fava'] }, { food: 'cucumber', grams: 80 }, { food: 'tomato', grams: 80 },
      { food: 'parsley', grams: 15 }, { food: 'feta', grams: 30, swaps: ['mozzarella', 'cottage'] }, { food: 'olive_oil', grams: 7 }, { food: 'lemon', grams: 10 },
    ],
    stepsAr: ['اخلط الحمص مع الخضار المقطعة.', 'أضف الفيتا المفتتة.', 'تبّل بالليمون وزيت الزيتون.'],
    stepsEn: ['Toss chickpeas with chopped vegetables.', 'Crumble feta on top.', 'Dress with lemon and olive oil.'],
  },
  {
    id: 'chicken_pasta', ar: 'معكرونة أسمر بالدجاج والطماطم', en: 'Whole-wheat pasta with chicken & tomato', emoji: '🍝',
    mealTypes: ['lunch', 'dinner'], style: 'pasta', prepMinutes: 20, cost: 1, kidFriendly: true, vegetarian: false,
    ingredients: [
      { food: 'ww_pasta', grams: 180 }, { food: 'chicken_breast', grams: 100, swaps: ['tuna', 'lean_beef', 'shrimp'] },
      { food: 'tomato', grams: 100 }, { food: 'mushrooms', grams: 50, swaps: ['spinach', 'bell_pepper'] },
      { food: 'mozzarella', grams: 20, swaps: ['feta'] }, { food: 'olive_oil', grams: 5 },
    ],
    stepsAr: ['اسلق المعكرونة.', 'اطهُ الدجاج والفطر ثم أضف الطماطم.', 'اخلطها مع المعكرونة ورشّ الجبن.'],
    stepsEn: ['Boil the pasta.', 'Cook chicken and mushrooms, then add tomato.', 'Toss with pasta and top with cheese.'],
  },
  {
    id: 'potato_tuna', ar: 'بطاطس مشوية محشوة بالتونة والزبادي', en: 'Baked potato with tuna & yogurt', emoji: '🥔',
    mealTypes: ['lunch', 'dinner'], style: 'plate', prepMinutes: 15, cost: 1, kidFriendly: true, vegetarian: false,
    ingredients: [
      { food: 'potato', grams: 220, swaps: ['sweet_potato'] }, { food: 'tuna', grams: 100, swaps: ['chicken_breast', 'egg'] },
      { food: 'greek_yogurt', grams: 50, swaps: ['yogurt', 'cottage'] }, { food: 'parsley', grams: 5 },
    ],
    stepsAr: ['اشوِ البطاطس في الميكروويف 8 دقائق أو في الفرن.', 'اخلط التونة بالزبادي.', 'احشُ البطاطس وزيّن بالبقدونس.'],
    stepsEn: ['Bake the potato (microwave 8 min or oven).', 'Mix tuna with yogurt.', 'Fill the potato and garnish with parsley.'],
  },
  {
    id: 'egg_avocado_sandwich', ar: 'ساندويتش بيض وأفوكادو', en: 'Egg & avocado sandwich', emoji: '🥑',
    mealTypes: ['breakfast', 'dinner'], style: 'sandwich', prepMinutes: 8, cost: 2, kidFriendly: true, vegetarian: true,
    ingredients: [
      { food: 'ww_bread', grams: 60, swaps: ['pita'] }, { food: 'egg', grams: 100, swaps: ['egg_white', 'cottage'] },
      { food: 'avocado', grams: 50 }, { food: 'tomato', grams: 40 },
    ],
    stepsAr: ['اسلق البيض 9 دقائق.', 'اهرس الأفوكادو على الخبز.', 'أضف البيض والطماطم.'],
    stepsEn: ['Boil eggs for 9 minutes.', 'Mash avocado onto bread.', 'Add sliced egg and tomato.'],
  },
  {
    id: 'chicken_salad_light', ar: 'سلطة دجاج خفيفة', en: 'Light chicken salad', emoji: '🥬',
    mealTypes: ['lunch', 'dinner'], style: 'salad', prepMinutes: 10, cost: 2, kidFriendly: false, vegetarian: false,
    ingredients: [
      { food: 'chicken_breast', grams: 110, swaps: ['tuna', 'shrimp', 'egg'] }, { food: 'lettuce', grams: 100, swaps: ['spinach'] },
      { food: 'cucumber', grams: 80 }, { food: 'tomato', grams: 80 }, { food: 'olive_oil', grams: 5 }, { food: 'lemon', grams: 10 },
    ],
    stepsAr: ['قطّع الدجاج المشوي.', 'اخلطه مع الخضار.', 'تبّل بالليمون وزيت الزيتون.'],
    stepsEn: ['Slice grilled chicken.', 'Toss with vegetables.', 'Dress with lemon and olive oil.'],
  },
  // ---------- Snacks ----------
  {
    id: 'apple_pb', ar: 'تفاح مع زبدة الفول السوداني', en: 'Apple with peanut butter', emoji: '🍎',
    mealTypes: ['snack'], style: 'snack', prepMinutes: 2, cost: 1, kidFriendly: true, vegetarian: true,
    ingredients: [{ food: 'apple', grams: 150, swaps: ['banana'] }, { food: 'peanut_butter', grams: 15, swaps: ['almonds', 'tahini'] }],
    stepsAr: ['قطّع التفاح شرائح.', 'قدّمه مع زبدة الفول السوداني.'],
    stepsEn: ['Slice the apple.', 'Serve with peanut butter.'],
  },
  {
    id: 'yogurt_dates', ar: 'زبادي يوناني مع تمرة', en: 'Greek yogurt with a date', emoji: '🌴',
    mealTypes: ['snack'], style: 'snack', prepMinutes: 1, cost: 1, kidFriendly: true, vegetarian: true,
    ingredients: [{ food: 'greek_yogurt', grams: 150, swaps: ['yogurt', 'cottage'] }, { food: 'dates', grams: 24 }],
    stepsAr: ['قدّم الزبادي مع تمرة مقطعة.'],
    stepsEn: ['Serve yogurt with a chopped date.'],
  },
  {
    id: 'hummus_veg', ar: 'حمص مع أصابع الجزر والخيار', en: 'Hummus with carrot & cucumber sticks', emoji: '🥕',
    mealTypes: ['snack'], style: 'snack', prepMinutes: 4, cost: 1, kidFriendly: true, vegetarian: true,
    ingredients: [{ food: 'hummus', grams: 60 }, { food: 'carrot', grams: 80, swaps: ['bell_pepper'] }, { food: 'cucumber', grams: 80 }],
    stepsAr: ['قطّع الخضار أصابع.', 'قدّمها مع الحمص.'],
    stepsEn: ['Cut vegetables into sticks.', 'Serve with hummus.'],
  },
  {
    id: 'almonds_orange', ar: 'برتقالة مع حفنة لوز', en: 'Orange with a handful of almonds', emoji: '🍊',
    mealTypes: ['snack'], style: 'snack', prepMinutes: 1, cost: 2, kidFriendly: true, vegetarian: true,
    ingredients: [{ food: 'orange', grams: 130, swaps: ['apple', 'banana'] }, { food: 'almonds', grams: 20, swaps: ['walnuts'] }],
    stepsAr: ['قشّر البرتقالة وقدّمها مع اللوز.'],
    stepsEn: ['Peel the orange and serve with almonds.'],
  },
  {
    id: 'eggs_cucumber', ar: 'بيضتان مسلوقتان مع خيار', en: 'Two boiled eggs with cucumber', emoji: '🥚',
    mealTypes: ['snack', 'breakfast'], style: 'snack', prepMinutes: 10, cost: 1, kidFriendly: true, vegetarian: true,
    ingredients: [{ food: 'egg', grams: 100, swaps: ['egg_white'] }, { food: 'cucumber', grams: 80 }],
    stepsAr: ['اسلق البيض 9 دقائق.', 'قدّمه مع الخيار.'],
    stepsEn: ['Boil eggs for 9 minutes.', 'Serve with cucumber.'],
  },
  {
    id: 'cottage_berries', ar: 'جبن قريش مع فراولة', en: 'Cottage cheese with strawberries', emoji: '🫐',
    mealTypes: ['snack'], style: 'snack', prepMinutes: 2, cost: 2, kidFriendly: true, vegetarian: true,
    ingredients: [{ food: 'cottage', grams: 150, swaps: ['greek_yogurt'] }, { food: 'strawberries', grams: 100, swaps: ['banana', 'orange'] }],
    stepsAr: ['ضع الجبن في وعاء وأضف الفراولة.'],
    stepsEn: ['Spoon cottage cheese into a bowl and add strawberries.'],
  },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
