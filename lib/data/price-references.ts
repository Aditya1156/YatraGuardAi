import type { PriceCategory } from '@/types';

/**
 * Reference prices for the pilot city (Bengaluru).
 *
 * These are researched typical local rates — what a resident pays at an
 * ordinary darshini, an auto meter, or a ticket counter — not tourist-facing
 * prices. They are the seed floor only: confirmed user checks fold into a
 * running median (8.1 step 5), so the list gets more accurate with use.
 *
 * `unit` matters — "auto fare" is per km, "meals" is per plate.
 */

export interface SeedPrice {
  itemName: string;
  category: PriceCategory;
  medianPrice: number;
  unit: string;
  aliases: string[];
}

export const BENGALURU_PRICES: SeedPrice[] = [
  /* ---------------------------- Street food ----------------------------- */
  { itemName: 'Idli', category: 'street-food', medianPrice: 30, unit: 'plate of 2', aliases: ['idly', 'iddli', 'idli plate'] },
  { itemName: 'Medu Vada', category: 'street-food', medianPrice: 25, unit: 'each', aliases: ['vada', 'uddina vada', 'meduvada'] },
  { itemName: 'Masala Dosa', category: 'street-food', medianPrice: 60, unit: 'each', aliases: ['masala dose', 'msl dosa', 'masaala dosa'] },
  { itemName: 'Plain Dosa', category: 'street-food', medianPrice: 45, unit: 'each', aliases: ['sada dosa', 'plain dose'] },
  { itemName: 'Set Dosa', category: 'street-food', medianPrice: 50, unit: 'plate of 3', aliases: ['set dose'] },
  { itemName: 'Benne Dosa', category: 'street-food', medianPrice: 70, unit: 'each', aliases: ['butter dosa', 'benne dose'] },
  { itemName: 'Rava Idli', category: 'street-food', medianPrice: 45, unit: 'plate', aliases: ['rave idli'] },
  { itemName: 'Kesari Bath', category: 'street-food', medianPrice: 35, unit: 'plate', aliases: ['kesari', 'sheera'] },
  { itemName: 'Khara Bath', category: 'street-food', medianPrice: 35, unit: 'plate', aliases: ['upma', 'uppittu'] },
  { itemName: 'Chow Chow Bath', category: 'street-food', medianPrice: 60, unit: 'plate', aliases: ['chowchow bath'] },
  { itemName: 'Bisi Bele Bath', category: 'street-food', medianPrice: 60, unit: 'plate', aliases: ['bisibelebath', 'bisi bele huli anna'] },
  { itemName: 'Poori Sagu', category: 'street-food', medianPrice: 50, unit: 'plate', aliases: ['puri sagu', 'poori saagu'] },
  { itemName: 'Lemon Rice', category: 'street-food', medianPrice: 45, unit: 'plate', aliases: ['chitranna'] },
  { itemName: 'Curd Rice', category: 'street-food', medianPrice: 45, unit: 'plate', aliases: ['mosaranna', 'thayir sadam'] },
  { itemName: 'Pani Puri', category: 'street-food', medianPrice: 40, unit: 'plate of 6', aliases: ['golgappa', 'puchka'] },
  { itemName: 'Masala Puri', category: 'street-food', medianPrice: 50, unit: 'plate', aliases: ['masal puri'] },
  { itemName: 'Gobi Manchurian', category: 'street-food', medianPrice: 120, unit: 'plate', aliases: ['gobi manchuri', 'cauliflower manchurian'] },
  { itemName: 'Samosa', category: 'street-food', medianPrice: 25, unit: 'each', aliases: ['samosa piece'] },

  /* ---------------------------- Restaurant ------------------------------ */
  { itemName: 'Veg Meals', category: 'restaurant', medianPrice: 130, unit: 'plate', aliases: ['veg thali', 'north karnataka meals', 'unlimited meals'] },
  { itemName: 'Chapati', category: 'restaurant', medianPrice: 20, unit: 'each', aliases: ['roti', 'phulka'] },
  { itemName: 'Butter Naan', category: 'restaurant', medianPrice: 60, unit: 'each', aliases: ['naan'] },
  { itemName: 'Paneer Butter Masala', category: 'restaurant', medianPrice: 220, unit: 'plate', aliases: ['pbm', 'paneer makhani'] },
  { itemName: 'Veg Biryani', category: 'restaurant', medianPrice: 170, unit: 'plate', aliases: ['vegetable biryani', 'veg dum biryani'] },
  { itemName: 'Chicken Biryani', category: 'restaurant', medianPrice: 260, unit: 'plate', aliases: ['chicken dum biryani', 'donne biryani'] },
  { itemName: 'Ragi Mudde with Saaru', category: 'restaurant', medianPrice: 90, unit: 'plate', aliases: ['ragi mudde', 'ragi ball'] },
  { itemName: 'Veg Fried Rice', category: 'restaurant', medianPrice: 140, unit: 'plate', aliases: ['fried rice'] },

  /* -------------------------- Water & drinks ---------------------------- */
  { itemName: 'Packaged Drinking Water 1L', category: 'water-beverage', medianPrice: 20, unit: '1 litre bottle', aliases: ['mineral water', 'water bottle', 'bisleri'] },
  { itemName: 'Filter Coffee', category: 'water-beverage', medianPrice: 20, unit: 'cup', aliases: ['coffee', 'kaapi', 'by two coffee'] },
  { itemName: 'Masala Chai', category: 'water-beverage', medianPrice: 15, unit: 'cup', aliases: ['tea', 'chai'] },
  { itemName: 'Tender Coconut', category: 'water-beverage', medianPrice: 45, unit: 'each', aliases: ['elaneer', 'coconut water', 'shikanji'] },
  { itemName: 'Fresh Lime Soda', category: 'water-beverage', medianPrice: 45, unit: 'glass', aliases: ['lime soda', 'nimbu soda'] },
  { itemName: 'Sugarcane Juice', category: 'water-beverage', medianPrice: 35, unit: 'glass', aliases: ['ganna juice', 'kabbina hallu'] },
  { itemName: 'Soft Drink 600ml', category: 'water-beverage', medianPrice: 40, unit: 'bottle', aliases: ['cola', 'pepsi', 'coke', 'thums up'] },

  /* ----------------------------- Transport ------------------------------ */
  { itemName: 'Auto Rickshaw Minimum Fare', category: 'transport', medianPrice: 36, unit: 'first 2 km', aliases: ['auto minimum', 'auto base fare', 'auto meter start'] },
  { itemName: 'Auto Rickshaw Per Km', category: 'transport', medianPrice: 18, unit: 'per km after 2 km', aliases: ['auto per km', 'auto fare per kilometre'] },
  { itemName: 'Namma Metro Short Trip', category: 'transport', medianPrice: 20, unit: 'up to 5 km', aliases: ['metro ticket', 'metro fare'] },
  { itemName: 'BMTC Ordinary Bus Short Trip', category: 'transport', medianPrice: 15, unit: 'up to 5 km', aliases: ['bus ticket', 'bmtc fare'] },
  { itemName: 'Vayu Vajra Airport Bus', category: 'transport', medianPrice: 265, unit: 'city to airport', aliases: ['airport bus', 'ka-9', 'vajra'] },
  { itemName: 'Airport Taxi to City Centre', category: 'transport', medianPrice: 1150, unit: 'BLR airport to MG Road', aliases: ['airport cab', 'airport taxi'] },
  { itemName: 'App Cab Per Km', category: 'transport', medianPrice: 18, unit: 'per km', aliases: ['ola per km', 'uber per km', 'cab per km'] },

  /* --------------------------- Entry tickets ---------------------------- */
  { itemName: 'Lalbagh Botanical Garden Entry', category: 'entry-ticket', medianPrice: 30, unit: 'adult', aliases: ['lalbagh ticket', 'lal bagh entry'] },
  { itemName: 'Bangalore Palace Entry (Indian)', category: 'entry-ticket', medianPrice: 230, unit: 'adult, Indian national', aliases: ['bangalore palace ticket'] },
  { itemName: "Tipu Sultan's Summer Palace Entry (Indian)", category: 'entry-ticket', medianPrice: 25, unit: 'adult, Indian national', aliases: ['tipu palace ticket'] },
  { itemName: 'Visvesvaraya Industrial Museum Entry', category: 'entry-ticket', medianPrice: 90, unit: 'adult', aliases: ['vitm ticket', 'science museum entry'] },
  { itemName: 'HAL Aerospace Museum Entry', category: 'entry-ticket', medianPrice: 100, unit: 'adult', aliases: ['hal museum ticket'] },
  { itemName: 'Bannerghatta Safari (Indian)', category: 'entry-ticket', medianPrice: 400, unit: 'adult, grand safari', aliases: ['bannerghatta ticket', 'bannerghatta safari'] },
  { itemName: 'Nandi Hills Entry', category: 'entry-ticket', medianPrice: 20, unit: 'adult', aliases: ['nandi betta entry'] },

  /* ----------------------------- Souvenirs ------------------------------ */
  { itemName: 'Mysore Sandal Soap 75g', category: 'souvenir', medianPrice: 60, unit: 'bar', aliases: ['sandal soap', 'mysore sandal'] },
  { itemName: 'Channapatna Wooden Toy (small)', category: 'souvenir', medianPrice: 250, unit: 'each', aliases: ['channapatna toy', 'wooden toy'] },
  { itemName: 'Mysore Silk Scarf', category: 'souvenir', medianPrice: 850, unit: 'each', aliases: ['silk scarf', 'mysore silk stole'] },
  { itemName: 'Agarbatti Pack', category: 'souvenir', medianPrice: 60, unit: 'pack', aliases: ['incense sticks', 'incense pack'] },
  { itemName: 'Rosewood Elephant (small)', category: 'souvenir', medianPrice: 600, unit: 'each', aliases: ['wooden elephant', 'rosewood carving'] },

  /* ----------------------------- Essentials ----------------------------- */
  { itemName: 'Prepaid SIM Starter Pack', category: 'essentials', medianPrice: 300, unit: 'pack', aliases: ['sim card', 'tourist sim'] },
  { itemName: 'Umbrella', category: 'essentials', medianPrice: 300, unit: 'each', aliases: ['chatri'] },
  { itemName: 'Phone Charging Cable', category: 'essentials', medianPrice: 200, unit: 'each', aliases: ['usb cable', 'charger cable'] },
  { itemName: 'Laundry Wash per Kg', category: 'essentials', medianPrice: 80, unit: 'per kg', aliases: ['laundry', 'dhobi'] },
];
