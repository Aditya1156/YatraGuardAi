import type { Allergen } from '@/types';

/**
 * Allergen reference for dishes commonly on Bengaluru menus.
 *
 * Two deliberate choices, both erring toward the allergic user:
 *
 * 1. Standard accompaniments count. South Indian coconut chutney is normally
 *    thickened with roasted groundnut, so idli and dosa carry a peanut flag
 *    with a note explaining it can be ordered without.
 * 2. "Usually contains" is treated as "contains". A missed flag is dangerous;
 *    an extra flag is only inconvenient.
 */

export interface SeedAllergenItem {
  dishName: string;
  allergens: Allergen[];
  aliases: string[];
  note: string;
}

export const BENGALURU_ALLERGEN_ITEMS: SeedAllergenItem[] = [
  { dishName: 'Idli', allergens: ['peanuts'], aliases: ['idly', 'iddli'], note: 'The rice cake itself is safe. The coconut chutney served with it is usually thickened with roasted groundnut — ask for sambar only.' },
  { dishName: 'Medu Vada', allergens: ['peanuts'], aliases: ['vada', 'uddina vada'], note: 'Urad dal fritter, no wheat. Chutney is the groundnut risk.' },
  { dishName: 'Masala Dosa', allergens: ['dairy', 'peanuts'], aliases: ['masala dose', 'masaala dosa'], note: 'Cooked in ghee or butter at most darshinis; ask for oil instead. Chutney usually has groundnut.' },
  { dishName: 'Plain Dosa', allergens: ['peanuts'], aliases: ['sada dosa', 'plain dose'], note: 'Rice and urad batter. Ask for oil rather than ghee if you also avoid dairy.' },
  { dishName: 'Benne Dosa', allergens: ['dairy', 'peanuts'], aliases: ['butter dosa', 'benne dose'], note: '"Benne" is butter — this one cannot be made dairy-free.' },
  { dishName: 'Rava Dosa', allergens: ['gluten', 'dairy', 'peanuts'], aliases: ['rave dosa'], note: 'Rava is semolina, which is wheat.' },
  { dishName: 'Set Dosa', allergens: ['dairy', 'peanuts'], aliases: ['set dose'], note: 'Served with ghee and chutney as standard.' },
  { dishName: 'Neer Dosa', allergens: [], aliases: ['neer dose'], note: 'Rice and coconut only — one of the safest options on a coastal Karnataka menu.' },
  { dishName: 'Rava Idli', allergens: ['gluten', 'dairy', 'peanuts'], aliases: ['rave idli'], note: 'Semolina base, tempered with ghee and cashew.' },
  { dishName: 'Kesari Bath', allergens: ['gluten', 'dairy'], aliases: ['kesari', 'sheera'], note: 'Semolina cooked in ghee.' },
  { dishName: 'Khara Bath', allergens: ['gluten', 'dairy', 'peanuts'], aliases: ['upma', 'uppittu'], note: 'Semolina, usually with a groundnut tempering.' },
  { dishName: 'Chow Chow Bath', allergens: ['gluten', 'dairy', 'peanuts'], aliases: ['chowchow bath'], note: 'Kesari bath and khara bath on one plate — both are semolina.' },
  { dishName: 'Bisi Bele Bath', allergens: ['peanuts', 'dairy'], aliases: ['bisibelebath', 'bisi bele huli anna'], note: 'Finished with ghee and a fried groundnut topping.' },
  { dishName: 'Puliyogare', allergens: ['peanuts'], aliases: ['tamarind rice', 'puliogare'], note: 'The gojju paste is groundnut- and sesame-based.' },
  { dishName: 'Chitranna', allergens: ['peanuts'], aliases: ['lemon rice'], note: 'Groundnut is in the standard tempering.' },
  { dishName: 'Curd Rice', allergens: ['dairy', 'peanuts'], aliases: ['mosaranna', 'thayir sadam'], note: 'Curd base; often tempered with groundnut.' },
  { dishName: 'Ragi Mudde', allergens: [], aliases: ['ragi ball', 'ragi mudde saaru'], note: 'Finger millet and water. Check the saaru it is served with.' },
  { dishName: 'Akki Roti', allergens: ['peanuts'], aliases: ['akki rotti'], note: 'Rice flour, so no gluten. Often served with groundnut chutney.' },
  { dishName: 'Chapati', allergens: ['gluten'], aliases: ['roti', 'phulka'], note: 'Wheat flour.' },
  { dishName: 'Butter Naan', allergens: ['gluten', 'dairy'], aliases: ['naan'], note: 'Maida dough, brushed with butter; the dough often contains curd too.' },
  { dishName: 'Poori Sagu', allergens: ['gluten', 'dairy'], aliases: ['puri sagu'], note: 'Deep-fried wheat bread; sagu is often finished with milk or ghee.' },
  { dishName: 'Paneer Butter Masala', allergens: ['dairy'], aliases: ['pbm', 'paneer makhani'], note: 'Paneer, butter and cream — heavily dairy.' },
  { dishName: 'Palak Paneer', allergens: ['dairy'], aliases: ['saag paneer'], note: 'Paneer and usually cream.' },
  { dishName: 'Paneer Tikka', allergens: ['dairy'], aliases: ['panner tikka'], note: 'Paneer marinated in curd.' },
  { dishName: 'Veg Biryani', allergens: ['dairy'], aliases: ['vegetable biryani'], note: 'Cooked with ghee and curd; the raita alongside is dairy.' },
  { dishName: 'Chicken Biryani', allergens: ['dairy'], aliases: ['donne biryani', 'chicken dum biryani'], note: 'Curd marinade and ghee are standard.' },
  { dishName: 'Gobi Manchurian', allergens: ['gluten', 'soy'], aliases: ['gobi manchuri', 'cauliflower manchurian'], note: 'Maida batter and soy sauce.' },
  { dishName: 'Veg Noodles', allergens: ['gluten', 'soy'], aliases: ['hakka noodles', 'chow mein'], note: 'Wheat noodles in soy sauce.' },
  { dishName: 'Veg Fried Rice', allergens: ['soy'], aliases: ['fried rice'], note: 'Soy sauce is standard; ask them to leave it out.' },
  { dishName: 'Egg Bhurji', allergens: ['eggs', 'dairy'], aliases: ['anda bhurji', 'egg burji'], note: 'Scrambled egg, often finished with butter.' },
  { dishName: 'Omelette', allergens: ['eggs'], aliases: ['omlet', 'omlette', 'egg omelette'], note: 'Egg.' },
  { dishName: 'Egg Rice', allergens: ['eggs', 'soy'], aliases: ['egg fried rice'], note: 'Egg plus soy sauce in the fried-rice base.' },
  { dishName: 'Prawn Ghee Roast', allergens: ['shellfish', 'dairy'], aliases: ['prawns ghee roast', 'yetti ghee roast'], note: 'Prawns cooked in ghee — both flags apply.' },
  { dishName: 'Prawn Curry', allergens: ['shellfish'], aliases: ['prawns curry', 'sungta curry'], note: 'Coconut-based, but prawn throughout.' },
  { dishName: 'Crab Masala', allergens: ['shellfish'], aliases: ['kekda masala'], note: 'Crab.' },
  { dishName: 'Pani Puri', allergens: ['gluten'], aliases: ['golgappa', 'puchka'], note: 'The shells are semolina and maida.' },
  { dishName: 'Masala Puri', allergens: ['gluten', 'peanuts'], aliases: ['masal puri'], note: 'Wheat shells, and the topping usually includes groundnut.' },
  { dishName: 'Samosa', allergens: ['gluten'], aliases: ['samosa piece'], note: 'Maida pastry.' },
  { dishName: 'Filter Coffee', allergens: ['dairy'], aliases: ['kaapi', 'coffee', 'by two coffee'], note: 'Made with hot milk by default; black coffee is available on request.' },
  { dishName: 'Badam Milk', allergens: ['dairy'], aliases: ['badami haalu'], note: 'Milk base, and almonds — a tree-nut allergy is not tracked by this app, so check separately.' },
  { dishName: 'Lassi', allergens: ['dairy'], aliases: ['sweet lassi', 'salt lassi'], note: 'Curd-based.' },
  { dishName: 'Mysore Pak', allergens: ['dairy'], aliases: ['mysurpa'], note: 'Gram flour cooked in a large amount of ghee.' },
  { dishName: 'Dharwad Peda', allergens: ['dairy'], aliases: ['peda'], note: 'Reduced milk solids.' },
  { dishName: 'Obbattu', allergens: ['gluten', 'dairy'], aliases: ['holige', 'puran poli'], note: 'Wheat flour shell, served with ghee.' },
  { dishName: 'Chikki', allergens: ['peanuts'], aliases: ['groundnut chikki', 'kadalekai mittai'], note: 'Groundnut and jaggery.' },
  { dishName: 'Coconut Chutney', allergens: ['peanuts'], aliases: ['chutney', 'kayi chutney'], note: 'Roasted groundnut is the usual thickener in Bengaluru. Ask before assuming it is coconut only.' },
  { dishName: 'Sambar', allergens: [], aliases: ['saaru', 'huli'], note: 'Toor dal and vegetables — normally free of all six tracked allergens.' },
  { dishName: 'Rasam', allergens: [], aliases: ['saaru'], note: 'Tamarind and pepper broth.' },
];
