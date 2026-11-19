// config.js — every shared constant for Palmera City lives here so the
// other modules never scatter magic numbers around the codebase.
export const CITY = {
  roadCentres: [-168, -112, -56, 0, 56, 112, 168],
  roadWidth: 14,
  extent: 196,          // buildings/roads live inside +/- extent
  beachZ: 196,          // sand starts here
  seaZ: 226,            // open water starts here
  worldEdge: 260,       // hard clamp for actors
};
export const SPAWN = { x: 4, z: 178 };
export const SAVE_KEY = 'palmera-city.save.v1';
export const START_MONEY = 250;
export const BUST_FINE = 100;
export const CLOCK_START = 18 * 60 + 24; // 18:24, locked golden hour

// Wanted model: stars are derived from heat, never stored directly.
export const HEAT_PER_STAR = 17;
export const STAR_MAX = 5;
export const HEAT_MAX = 100;
export const HEAT_DECAY = 2.2;           // heat per second, always ticking down
export const UNITS_PER_STAR = [0, 2, 3, 4, 6, 7];
export const CRIME_HEAT = { steal: 25, punch: 12, shotHit: 15, cruiserRam: 30 };
export const CALLSIGNS = ['FARO-12', 'BRISA-07', 'MAREA-23', 'VIENTO-31',
  'ARENA-05', 'OLEAJE-18', 'DUNA-27', 'SALITRE-40'];

// Vehicle kinds. The top speed of any car the player can drive is pinned
// at exactly 38.00 by CAR_TOP_SPEED below — a regression contract.
export const KINDS = {
  sedan:  { w: 1.9, l: 4.3, h: 0.62, cabinH: 0.52, accel: 13.5, name: 'Duna S' },
  hatch:  { w: 1.8, l: 3.8, h: 0.60, cabinH: 0.55, accel: 14.5, name: 'Pico' },
  van:    { w: 2.1, l: 5.2, h: 1.05, cabinH: 0.75, accel: 11.0, name: 'Carguero' },
  taxi:   { w: 1.9, l: 4.3, h: 0.62, cabinH: 0.52, accel: 13.5, name: 'Taxi Sol' },
  sport:  { w: 2.0, l: 4.5, h: 0.50, cabinH: 0.42, accel: 17.0, name: 'Alisio GT' },
  police: { w: 1.95, l: 4.6, h: 0.62, cabinH: 0.52, accel: 16.0, name: 'Vigía Interceptor' },
};
export const CAR_TOP_SPEED = 38.0;
export const CAR_REVERSE_MAX = 11;
export const CAR_COLORS = [0xd81b60, 0x2e86de, 0xf5f6fa, 0x576574, 0x10ac84,
  0xee5253, 0x5f27cd, 0xff9f43, 0x8395a7, 0x222f3e];
export const HERO_COLOR = 0xd81b60;

export const WEAPONS = {
  pistol: { slot: 1, label: 'La Chica', short: 'PISTOL', mag: 12, rate: 0.28, reload: 1.1, slow: 0.40, auto: false },
  smg:    { slot: 2, label: 'La Ráfaga', short: 'SMG', mag: 32, rate: 0.085, reload: 1.4, slow: 0.82, auto: true },
};

// Story chain. CH1..CH4 pay 400+650+900+1500 = 3700 exactly; CH5 is a
// coda that pays 1200 more. Step types: steal | goto | heat | evade | sneak.
export const MISSIONS = [
  { title: 'First Wheels', giver: 'Marco', timerSec: 150, reward: 400, steps: [
    { type: 'steal', text: 'Steal any car on the street' },
    { type: 'goto', x: 150, z: 150, text: 'Drive the car to Puerto Serena marina' } ] },
  { title: 'Courier Run', giver: 'Marco', timerSec: 240, reward: 650, steps: [
    { type: 'goto', x: -140, z: -140, text: 'First drop: Alto Mirador, north-west' },
    { type: 'goto', x: 140, z: -140, text: 'Second drop: Colina Brisa, north-east' } ] },
  { title: 'Lose the Heat', giver: 'Rosa', timerSec: 180, reward: 900, steps: [
    { type: 'heat', text: 'Make noise: reach 3 stars so the trail goes loud' },
    { type: 'evade', text: 'Break line of sight and let the stars fade' } ] },
  { title: 'The Last Delivery', giver: 'Marco', timerSec: 300, reward: 1500, steps: [
    { type: 'goto', x: -150, z: 150, text: 'Pick up the ledger at Muelle Oeste docks' },
    { type: 'goto', x: 0, z: 210, text: 'Deliver it to the lighthouse point' } ] },
  { title: 'Paper Trail', giver: 'Rosa', timerSec: 240, reward: 1200, steps: [
    { type: 'goto', x: -150, z: -150, text: 'Collect the sealed ledger at Rosa\u2019s depot' },
    { type: 'sneak', x: 150, z: 150, text: 'Drop it at the marina — arrive UNSEEN' } ] },
];
export const WAYPOINT_RADIUS = 9;

export const NAMES = {
  hero: 'Luz Vega',
  shops: ['Toko Bunga Alba', 'Farmacia Sol', 'Barbería Norte', 'Tienda Brisa',
    'Panadería La Espiga', 'Taller Hermanos Ruiz', 'Joyería Mar', 'Librería Faro'],
  billboards: [
    { lines: ['ONDA ROSA 98.3', 'HORA DORADA'], bg: '#3b1050', fg: '#ffb3d9' },
    { lines: ['HOTEL MIRAMAR', 'BUKA 24 JAM'], bg: '#0d2b45', fg: '#aee6ff' },
    { lines: ['ALISIO GT · BARU', 'RASAKAN SENJANYA'], bg: '#4a0f2e', fg: '#ffd9a0' },
    { lines: ['CAFÉ FARO', 'KOPI & BOLILLOS'], bg: '#2e1a08', fg: '#ffe9b0' },
    { lines: ['PUERTO SERENA', 'MARINA'], bg: '#083038', fg: '#b0ffe9' },
    { lines: ['PALMERA CITY', 'KOTA SENJA'], bg: '#2e1a47', fg: '#ffb347' },
  ],
};
export const RADIO = {
  station: 'ONDA ROSA', freq: '98.3', show: 'Hora Dorada', songSec: 45,
  songs: [
    { title: 'Neon di Atas Teluk', artist: 'Vera Solano' },
    { title: 'Garis Pantai Liar', artist: 'Los Farolitos' },
    { title: 'Kaca Spion Pink', artist: 'Duna Eléctrica' },
    { title: 'Sirene Jauh', artist: 'Marta Vela' },
  ],
};
export const DIALOG = {
  m1_start: { who: 'Marco', role: 'THE DOCKS', text: 'Luz, ambil mobil apa saja di jalan. Bawa ke marina sebelum ada yang sadar.' },
  m2_start: { who: 'Marco', role: 'THE DOCKS', text: 'Paket tersegel, dua antar, jangan berhenti untuk siapa pun. Terutama yang berseragam.' },
  m3_start: { who: 'Rosa', role: 'FIXER', text: 'Drop tadi bunyinya keras. Lepaskan mereka, putus garis pandang, lalu diam sampai bintang padam.' },
  m3_heat:  { who: 'Rosa', role: 'FIXER', text: 'Tiga bintang, Luz. Seluruh kota menonton — sekarang hilang dari pandangan mereka.' },
  m4_start: { who: 'Marco', role: 'THE DOCKS', text: 'Satu antar terakhir: buku besar dari dermaga barat ke titik mercusuar. Utangmu lunas setelah ini.' },
  m5_start: { who: 'Rosa', role: 'FIXER', text: 'Satu jejak kertas terakhir, Luz. Ambil bukunya, lalu antar tanpa terlihat siapa pun.' },
  m5_gift:  { who: 'Rosa', role: 'FIXER', text: 'Ini La Ráfaga — magasin 32, otomatis penuh. Tahan klik untuk menembak, tombol 2 untuk memilihnya.' },
  mission_done: { who: 'Rosa', role: 'FIXER', text: 'Bersih. Uangnya sudah jalan — jangan habiskan di satu tempat.' },
  all_done: { who: 'Luz Vega', role: 'COURIER', text: 'Utang lunas. Palmera tetap milikku malam ini.' },
};
export const SUNSET = {
  skyTop: '#2e1a47', skyMid: '#7a2d6d', skyLow: '#ff6b9d', skyHorizon: '#ffb347',
  fog: 0xe88ca0, fogDensity: 0.00125,
  sunColor: 0xffa04e, sunIntensity: 3.1, sunPos: [90, 42, 190],
  hemiSky: 0xff9ec6, hemiGround: 0x3a2d5a, hemiIntensity: 0.9,
  ambColor: 0xffd9b0, ambIntensity: 0.52,
};
export const PALETTE = {
  asphalt: 0x5a4d60, sidewalk: 0xc0a294, ground: 0x979c90,
  sea: 0x40649c, seaDeep: 0x2c4a7c, sand: 0xeecfa0,
};
export function districtOf(x, z) {
  if (z >= CITY.beachZ) return 'Playa Alba';
  const col = x < -56 ? 0 : x > 56 ? 2 : 1;
  const row = z > 56 ? 0 : z < -56 ? 2 : 1;
  return [['Muelle Oeste', 'Rambla del Sol', 'Puerto Serena'],
          ['Barrio Coral', 'Centro Palmera', 'Loma Este'],
          ['Alto Mirador', 'Jardín Alto', 'Colina Brisa']][row][col];
}
export const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";
export const MONO = "ui-monospace, 'Cascadia Mono', Consolas, monospace";
