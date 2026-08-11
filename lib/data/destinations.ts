import type { DestinationRecord } from '@/lib/algorithms/seasonal-discovery';

/**
 * Destinations within reach of the pilot city, for 8.6 Seasonal Discovery.
 * `peakMonths` is when the place is busiest and priciest — the feature
 * deliberately suggests everything *except* those months.
 */

export const KARNATAKA_DESTINATIONS: Omit<DestinationRecord, 'id'>[] = [
  { name: 'Nandi Hills', region: 'Karnataka', theme: 'hills', peakMonths: [10, 11, 12, 1], distanceKm: 60, blurb: 'Sunrise viewpoint an hour out of the city.' },
  { name: 'Skandagiri', region: 'Karnataka', theme: 'hills', peakMonths: [11, 12, 1], distanceKm: 70, blurb: 'Night trek to a cloud-level ridge.' },
  { name: 'Sakleshpur', region: 'Karnataka', theme: 'hills', peakMonths: [7, 8, 9], distanceKm: 220, blurb: 'Coffee and pepper estates along the ghat railway.' },
  { name: 'Chikkamagaluru', region: 'Karnataka', theme: 'hills', peakMonths: [10, 11, 12, 1], distanceKm: 245, blurb: 'Mullayanagiri, the highest peak in the state.' },
  { name: 'Coorg (Madikeri)', region: 'Karnataka', theme: 'hills', peakMonths: [10, 11, 12, 1, 4, 5], distanceKm: 265, blurb: 'Coffee country with waterfalls and homestays.' },
  { name: 'Agumbe', region: 'Karnataka', theme: 'hills', peakMonths: [7, 8, 9], distanceKm: 350, blurb: 'Rainforest ridge known for its sunsets and king cobras.' },
  { name: 'Kemmanagundi', region: 'Karnataka', theme: 'hills', peakMonths: [10, 11, 12], distanceKm: 275, blurb: 'Quiet hill station above the Bhadra valley.' },

  { name: 'Gokarna', region: 'Karnataka', theme: 'beach', peakMonths: [11, 12, 1, 2], distanceKm: 480, blurb: 'Temple town with a chain of walkable beaches.' },
  { name: 'Murudeshwar', region: 'Karnataka', theme: 'beach', peakMonths: [10, 11, 12, 1], distanceKm: 510, blurb: 'Shore temple under a very large Shiva statue.' },
  { name: 'Karwar', region: 'Karnataka', theme: 'beach', peakMonths: [11, 12, 1, 2], distanceKm: 520, blurb: 'Estuary beaches at the Goa border, far quieter than Goa.' },
  { name: 'Malpe & St Marys Island', region: 'Karnataka', theme: 'beach', peakMonths: [12, 1, 2], distanceKm: 400, blurb: 'Basalt-column island reached by a short boat ride.' },

  { name: 'Hampi', region: 'Karnataka', theme: 'heritage', peakMonths: [11, 12, 1, 2], distanceKm: 340, blurb: 'Vijayanagara ruins across a boulder landscape.' },
  { name: 'Badami, Aihole & Pattadakal', region: 'Karnataka', theme: 'heritage', peakMonths: [11, 12, 1], distanceKm: 460, blurb: 'Chalukyan rock-cut cave temples.' },
  { name: 'Belur & Halebidu', region: 'Karnataka', theme: 'heritage', peakMonths: [10, 11, 12, 1], distanceKm: 220, blurb: 'Hoysala temples covered end to end in carving.' },
  { name: 'Mysuru', region: 'Karnataka', theme: 'heritage', peakMonths: [9, 10, 12, 1], distanceKm: 145, blurb: 'Palace city; Dasara in September–October is the crush.' },
  { name: 'Srirangapatna', region: 'Karnataka', theme: 'heritage', peakMonths: [12, 1], distanceKm: 125, blurb: "Tipu Sultan's island fort on the Kaveri." },
  { name: 'Bidar', region: 'Karnataka', theme: 'heritage', peakMonths: [11, 12, 1], distanceKm: 700, blurb: 'Bahmani fort, tombs and bidriware workshops.' },

  { name: 'Bandipur National Park', region: 'Karnataka', theme: 'wildlife', peakMonths: [10, 11, 12, 4, 5], distanceKm: 220, blurb: 'Tiger reserve on the Nilgiri edge.' },
  { name: 'Nagarhole (Rajiv Gandhi NP)', region: 'Karnataka', theme: 'wildlife', peakMonths: [10, 11, 12, 4, 5], distanceKm: 235, blurb: 'Elephant herds along the Kabini backwaters.' },
  { name: 'Kabini', region: 'Karnataka', theme: 'wildlife', peakMonths: [3, 4, 5, 12], distanceKm: 205, blurb: 'Backwater safaris, best known for leopard sightings.' },
  { name: 'BR Hills (Biligiriranga)', region: 'Karnataka', theme: 'wildlife', peakMonths: [10, 11, 12], distanceKm: 180, blurb: 'Where the Western and Eastern Ghats meet.' },
  { name: 'Dandeli', region: 'Karnataka', theme: 'wildlife', peakMonths: [10, 11, 12, 1], distanceKm: 470, blurb: 'Kali river rafting and hornbill forest.' },
  { name: 'Bhadra Wildlife Sanctuary', region: 'Karnataka', theme: 'wildlife', peakMonths: [11, 12, 1, 2], distanceKm: 280, blurb: 'Quiet tiger reserve with a reservoir at its centre.' },
  { name: 'Ranganathittu Bird Sanctuary', region: 'Karnataka', theme: 'wildlife', peakMonths: [1, 2, 6, 7], distanceKm: 130, blurb: 'River islets packed with nesting birds.' },
];
