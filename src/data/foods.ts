import type { Nutrients } from '../lib/types';

/**
 * Generic foods with nutrition per 100 g.
 * Values are taken from USDA FoodData Central (SR Legacy / Foundation), rounded.
 * The AI layer never generates nutrition numbers: every calorie and macro shown in the app
 * is computed from this table or from Open Food Facts product data.
 */
export type Allergen = 'milk' | 'eggs' | 'fish' | 'shellfish' | 'tree_nuts' | 'peanuts' | 'gluten' | 'soy' | 'sesame';

export interface FoodItem {
  id: string;
  ar: string;
  en: string;
  category: 'protein' | 'grain' | 'dairy' | 'fruit' | 'vegetable' | 'legume' | 'fat' | 'nuts' | 'sweet';
  per100: Nutrients;
  allergens: Allergen[];
  /** Typical cost tier 1 (cheap) – 3 (premium), used for the "economical" suggestion. */
  cost: 1 | 2 | 3;
  aisle: 'produce' | 'meat_fish' | 'dairy_eggs' | 'bakery_grains' | 'pantry';
}

const n = (
  kcal: number, protein: number, carbs: number, fat: number,
  fiber = 0, sugar = 0, satFat = 0, sodium = 0,
): Nutrients => ({ kcal, protein, carbs, fat, fiber, sugar, satFat, sodium });

export const FOODS: Record<string, FoodItem> = {
  chicken_breast: { id: 'chicken_breast', ar: 'صدر دجاج مشوي', en: 'Grilled chicken breast', category: 'protein', per100: n(165, 31, 0, 3.6, 0, 0, 1, 74), allergens: [], cost: 2, aisle: 'meat_fish' },
  lean_beef: { id: 'lean_beef', ar: 'لحم بقري مفروم قليل الدهن (مطبوخ)', en: 'Lean ground beef, cooked', category: 'protein', per100: n(217, 26, 0, 11.8, 0, 0, 4.6, 72), allergens: [], cost: 3, aisle: 'meat_fish' },
  salmon: { id: 'salmon', ar: 'سلمون مشوي', en: 'Baked salmon', category: 'protein', per100: n(206, 22.1, 0, 12.4, 0, 0, 2.5, 61), allergens: ['fish'], cost: 3, aisle: 'meat_fish' },
  tuna: { id: 'tuna', ar: 'تونة معلبة بالماء', en: 'Canned tuna in water', category: 'protein', per100: n(116, 25.5, 0, 0.8, 0, 0, 0.2, 338), allergens: ['fish'], cost: 1, aisle: 'pantry' },
  shrimp: { id: 'shrimp', ar: 'روبيان مطبوخ', en: 'Cooked shrimp', category: 'protein', per100: n(99, 24, 0.2, 0.3, 0, 0, 0.1, 111), allergens: ['shellfish'], cost: 3, aisle: 'meat_fish' },
  egg: { id: 'egg', ar: 'بيض مسلوق', en: 'Boiled egg', category: 'protein', per100: n(155, 12.6, 1.1, 10.6, 0, 1.1, 3.3, 124), allergens: ['eggs'], cost: 1, aisle: 'dairy_eggs' },
  egg_white: { id: 'egg_white', ar: 'بياض بيض', en: 'Egg white', category: 'protein', per100: n(52, 10.9, 0.7, 0.2, 0, 0.7, 0, 166), allergens: ['eggs'], cost: 1, aisle: 'dairy_eggs' },

  milk_lowfat: { id: 'milk_lowfat', ar: 'حليب قليل الدسم', en: 'Low-fat milk (1%)', category: 'dairy', per100: n(42, 3.4, 5, 1, 0, 5, 0.6, 44), allergens: ['milk'], cost: 1, aisle: 'dairy_eggs' },
  greek_yogurt: { id: 'greek_yogurt', ar: 'زبادي يوناني خالي الدسم', en: 'Greek yogurt, nonfat', category: 'dairy', per100: n(59, 10.2, 3.6, 0.4, 0, 3.2, 0.1, 36), allergens: ['milk'], cost: 2, aisle: 'dairy_eggs' },
  yogurt: { id: 'yogurt', ar: 'لبن زبادي كامل الدسم', en: 'Plain whole-milk yogurt', category: 'dairy', per100: n(61, 3.5, 4.7, 3.3, 0, 4.7, 2.1, 46), allergens: ['milk'], cost: 1, aisle: 'dairy_eggs' },
  cottage: { id: 'cottage', ar: 'جبن قريش قليل الدسم', en: 'Low-fat cottage cheese', category: 'dairy', per100: n(84, 11, 4.3, 2.3, 0, 4.1, 1.2, 321), allergens: ['milk'], cost: 2, aisle: 'dairy_eggs' },
  feta: { id: 'feta', ar: 'جبنة فيتا', en: 'Feta cheese', category: 'dairy', per100: n(264, 14.2, 4.1, 21.3, 0, 4.1, 14.9, 1116), allergens: ['milk'], cost: 2, aisle: 'dairy_eggs' },
  mozzarella: { id: 'mozzarella', ar: 'موزاريلا قليلة الدسم', en: 'Part-skim mozzarella', category: 'dairy', per100: n(254, 24.3, 2.8, 15.9, 0, 1.1, 10.1, 619), allergens: ['milk'], cost: 2, aisle: 'dairy_eggs' },

  rice_brown: { id: 'rice_brown', ar: 'أرز بني مطبوخ', en: 'Cooked brown rice', category: 'grain', per100: n(123, 2.7, 25.6, 1, 1.6, 0.2, 0.3, 4), allergens: [], cost: 1, aisle: 'bakery_grains' },
  rice_white: { id: 'rice_white', ar: 'أرز أبيض مطبوخ', en: 'Cooked white rice', category: 'grain', per100: n(130, 2.7, 28.2, 0.3, 0.4, 0.1, 0.1, 1), allergens: [], cost: 1, aisle: 'bakery_grains' },
  quinoa: { id: 'quinoa', ar: 'كينوا مطبوخة', en: 'Cooked quinoa', category: 'grain', per100: n(120, 4.4, 21.3, 1.9, 2.8, 0.9, 0.2, 7), allergens: [], cost: 3, aisle: 'bakery_grains' },
  bulgur: { id: 'bulgur', ar: 'برغل مطبوخ', en: 'Cooked bulgur', category: 'grain', per100: n(83, 3.1, 18.6, 0.2, 4.5, 0.1, 0, 5), allergens: ['gluten'], cost: 1, aisle: 'bakery_grains' },
  oats: { id: 'oats', ar: 'شوفان', en: 'Rolled oats (dry)', category: 'grain', per100: n(379, 13.2, 67.7, 6.5, 10.1, 1, 1.1, 6), allergens: ['gluten'], cost: 1, aisle: 'bakery_grains' },
  ww_bread: { id: 'ww_bread', ar: 'خبز قمح كامل', en: 'Whole-wheat bread', category: 'grain', per100: n(247, 13, 41, 3.4, 7, 5.6, 0.7, 450), allergens: ['gluten'], cost: 1, aisle: 'bakery_grains' },
  pita: { id: 'pita', ar: 'خبز عربي أسمر', en: 'Whole-wheat pita', category: 'grain', per100: n(266, 9.8, 55, 2.6, 7.4, 0.3, 0.4, 527), allergens: ['gluten'], cost: 1, aisle: 'bakery_grains' },
  ww_pasta: { id: 'ww_pasta', ar: 'معكرونة قمح كامل مطبوخة', en: 'Cooked whole-wheat pasta', category: 'grain', per100: n(124, 5.3, 26.5, 0.5, 4.5, 0.8, 0.1, 3), allergens: ['gluten'], cost: 1, aisle: 'bakery_grains' },
  potato: { id: 'potato', ar: 'بطاطس مشوية', en: 'Baked potato', category: 'grain', per100: n(93, 2.5, 21.2, 0.1, 2.2, 1.2, 0, 10), allergens: [], cost: 1, aisle: 'produce' },
  sweet_potato: { id: 'sweet_potato', ar: 'بطاطا حلوة مشوية', en: 'Baked sweet potato', category: 'grain', per100: n(90, 2, 20.7, 0.2, 3.3, 6.5, 0, 36), allergens: [], cost: 1, aisle: 'produce' },

  lentils: { id: 'lentils', ar: 'عدس مطبوخ', en: 'Cooked lentils', category: 'legume', per100: n(116, 9, 20, 0.4, 7.9, 1.8, 0.1, 2), allergens: [], cost: 1, aisle: 'pantry' },
  chickpeas: { id: 'chickpeas', ar: 'حمص حب مطبوخ', en: 'Cooked chickpeas', category: 'legume', per100: n(164, 8.9, 27.4, 2.6, 7.6, 4.8, 0.3, 7), allergens: [], cost: 1, aisle: 'pantry' },
  fava: { id: 'fava', ar: 'فول مدمس', en: 'Cooked fava beans', category: 'legume', per100: n(110, 7.6, 19.7, 0.4, 5.4, 1.8, 0.1, 5), allergens: [], cost: 1, aisle: 'pantry' },
  hummus: { id: 'hummus', ar: 'حمص بالطحينة', en: 'Hummus', category: 'legume', per100: n(166, 7.9, 14.3, 9.6, 6, 0.3, 1.4, 379), allergens: ['sesame'], cost: 1, aisle: 'pantry' },

  banana: { id: 'banana', ar: 'موز', en: 'Banana', category: 'fruit', per100: n(89, 1.1, 22.8, 0.3, 2.6, 12.2, 0.1, 1), allergens: [], cost: 1, aisle: 'produce' },
  apple: { id: 'apple', ar: 'تفاح', en: 'Apple', category: 'fruit', per100: n(52, 0.3, 13.8, 0.2, 2.4, 10.4, 0, 1), allergens: [], cost: 1, aisle: 'produce' },
  orange: { id: 'orange', ar: 'برتقال', en: 'Orange', category: 'fruit', per100: n(47, 0.9, 11.8, 0.1, 2.4, 9.4, 0, 0), allergens: [], cost: 1, aisle: 'produce' },
  strawberries: { id: 'strawberries', ar: 'فراولة', en: 'Strawberries', category: 'fruit', per100: n(32, 0.7, 7.7, 0.3, 2, 4.9, 0, 1), allergens: [], cost: 2, aisle: 'produce' },
  dates: { id: 'dates', ar: 'تمر', en: 'Dates', category: 'fruit', per100: n(277, 1.8, 75, 0.2, 6.7, 66, 0, 1), allergens: [], cost: 1, aisle: 'produce' },
  avocado: { id: 'avocado', ar: 'أفوكادو', en: 'Avocado', category: 'fat', per100: n(160, 2, 8.5, 14.7, 6.7, 0.7, 2.1, 7), allergens: [], cost: 2, aisle: 'produce' },

  cucumber: { id: 'cucumber', ar: 'خيار', en: 'Cucumber', category: 'vegetable', per100: n(15, 0.7, 3.6, 0.1, 0.5, 1.7, 0, 2), allergens: [], cost: 1, aisle: 'produce' },
  tomato: { id: 'tomato', ar: 'طماطم', en: 'Tomato', category: 'vegetable', per100: n(18, 0.9, 3.9, 0.2, 1.2, 2.6, 0, 5), allergens: [], cost: 1, aisle: 'produce' },
  lettuce: { id: 'lettuce', ar: 'خس', en: 'Romaine lettuce', category: 'vegetable', per100: n(17, 1.2, 3.3, 0.3, 2.1, 1.2, 0, 8), allergens: [], cost: 1, aisle: 'produce' },
  spinach: { id: 'spinach', ar: 'سبانخ', en: 'Spinach', category: 'vegetable', per100: n(23, 2.9, 3.6, 0.4, 2.2, 0.4, 0.1, 79), allergens: [], cost: 1, aisle: 'produce' },
  broccoli: { id: 'broccoli', ar: 'بروكلي مطهو', en: 'Steamed broccoli', category: 'vegetable', per100: n(35, 2.4, 7.2, 0.4, 3.3, 1.4, 0.1, 41), allergens: [], cost: 2, aisle: 'produce' },
  carrot: { id: 'carrot', ar: 'جزر', en: 'Carrot', category: 'vegetable', per100: n(41, 0.9, 9.6, 0.2, 2.8, 4.7, 0, 69), allergens: [], cost: 1, aisle: 'produce' },
  onion: { id: 'onion', ar: 'بصل', en: 'Onion', category: 'vegetable', per100: n(40, 1.1, 9.3, 0.1, 1.7, 4.2, 0, 4), allergens: [], cost: 1, aisle: 'produce' },
  bell_pepper: { id: 'bell_pepper', ar: 'فلفل رومي أحمر', en: 'Red bell pepper', category: 'vegetable', per100: n(31, 1, 6, 0.3, 2.1, 4.2, 0, 4), allergens: [], cost: 1, aisle: 'produce' },
  mushrooms: { id: 'mushrooms', ar: 'فطر', en: 'Mushrooms', category: 'vegetable', per100: n(22, 3.1, 3.3, 0.3, 1, 2, 0, 5), allergens: [], cost: 2, aisle: 'produce' },
  parsley: { id: 'parsley', ar: 'بقدونس', en: 'Parsley', category: 'vegetable', per100: n(36, 3, 6.3, 0.8, 3.3, 0.9, 0.1, 56), allergens: [], cost: 1, aisle: 'produce' },
  lemon: { id: 'lemon', ar: 'عصير ليمون', en: 'Lemon juice', category: 'vegetable', per100: n(22, 0.4, 6.9, 0.2, 0.3, 2.5, 0, 1), allergens: [], cost: 1, aisle: 'produce' },

  olive_oil: { id: 'olive_oil', ar: 'زيت زيتون', en: 'Olive oil', category: 'fat', per100: n(884, 0, 0, 100, 0, 0, 13.8, 2), allergens: [], cost: 2, aisle: 'pantry' },
  tahini: { id: 'tahini', ar: 'طحينة', en: 'Tahini', category: 'fat', per100: n(595, 17, 21.2, 53.8, 9.3, 0.5, 7.5, 115), allergens: ['sesame'], cost: 2, aisle: 'pantry' },
  peanut_butter: { id: 'peanut_butter', ar: 'زبدة فول سوداني', en: 'Peanut butter', category: 'nuts', per100: n(588, 25, 20, 50, 6, 9.2, 10.3, 459), allergens: ['peanuts'], cost: 2, aisle: 'pantry' },
  almonds: { id: 'almonds', ar: 'لوز', en: 'Almonds', category: 'nuts', per100: n(579, 21.2, 21.6, 49.9, 12.5, 4.4, 3.8, 1), allergens: ['tree_nuts'], cost: 2, aisle: 'pantry' },
  walnuts: { id: 'walnuts', ar: 'جوز', en: 'Walnuts', category: 'nuts', per100: n(654, 15.2, 13.7, 65.2, 6.7, 2.6, 6.1, 2), allergens: ['tree_nuts'], cost: 3, aisle: 'pantry' },
  chia: { id: 'chia', ar: 'بذور الشيا', en: 'Chia seeds', category: 'nuts', per100: n(486, 16.5, 42.1, 30.7, 34.4, 0, 3.3, 16), allergens: [], cost: 2, aisle: 'pantry' },
  honey: { id: 'honey', ar: 'عسل', en: 'Honey', category: 'sweet', per100: n(304, 0.3, 82.4, 0, 0.2, 82.1, 0, 4), allergens: [], cost: 2, aisle: 'pantry' },
};

export const FOOD_SOURCE = 'USDA FoodData Central';

export function foodName(id: string, lang: 'ar' | 'en'): string {
  const f = FOODS[id];
  return f ? f[lang] : id;
}
