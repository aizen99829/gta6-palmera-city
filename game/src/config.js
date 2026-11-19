// Palmera City — every tuning number, colour and mission script in one place.
// The city is a road grid: roads run at multiples of PITCH; blocks sit between them.
// +x is east, +z is south (toward the beach and the sea). Units are metres.
export const STEP = 1 / 60;
export const SAVE_KEY = 'palmera-city.save.v1';

export const CITY = {
  pitch: 56, // road centre to road centre
  roadHalf: 7, // half-width of a road
  roads: 7, // roads per axis, centred on 0: -168 .. +168
  beachZ: 196, // sand starts here
  seaZ: 236, // water starts here
  size: 420, // world half-extent for fog / minimap
};

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  radius: 0.6,
  height: 1.8,
  maxHealth: 100,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseMax: 9,
  forwardMax: 38,
  steer: 1.9,
  grip: 6,
};

export const WANTED = {
  decayPerSec: 2.2, // heat points lost per second while unseen
  // v5.1 parity: 17 (was 20) — at 20 the fifth star needed heat 100, the
  // hard cap itself, so 5 stars was practically unreachable; at 17 a long
  // chase (steal + two cruiser hits = 85) honestly earns it.
  heatPerStar: 17,
  stealCar: 25,
  punch: 12,
  shoot: 30,
  kill: 40,
  max: 5,
  // v5.1 parity: cruisers on the street per star level (was a flat
  // min(stars, 5)). CODE 4+ now fields a real response: 6–7 units.
  unitsPerStar: [0, 2, 3, 4, 6, 7],
};

export const MONEY = {
  start: 250,
  punchLoot: 15,
  missionReward: [400, 650, 900, 1500, 1200],
};

// v5.1 parity (P5): two real guns, different rhythms. The pistol hits a
// cruiser hard per round (cruiserSlow is the speed multiplier on a hit);
// the SMG is a hose — fast, deep magazine, weaker per round.
export const WEAPONS = {
  pistol: { magSize: 12, interval: 0.28, cruiserSlow: 0.4 },
  smg: { magSize: 32, interval: 0.085, cruiserSlow: 0.82 },
};

export const PALETTE = {
  sky: 0x8ec8e8,
  fog: 0xd8c8a8, // warm coastal haze, not cold blue
  sun: 0xffdf9e, // low golden sun
  asphalt: 0x4a3f4d, // v5.1 parity (P1): sun-flooded warm grey-mauve (was 0x2a2530, near-black)
  sidewalk: 0xc0a294, // v5.1: lifted with the road pass
  sand: 0xeec39a, // v5: peach sand
  sea: 0x40649c, // v5.1: lifted sunset sea (was 0x3a5a8c)
  seaDeep: 0x2a3a6c,
  grass: 0x5da24a,
  building: [0xd8c9b0, 0xc9b8a3, 0xe8dcc8, 0xb8c4c9, 0xd9a06b, 0x8fa8b8, 0xe0b8a0, 0xa8b89a],
  roofs: [0x6a5a48, 0x8a4a3a, 0x4a5a6a, 0x7a6a4a, 0x5a4a3a, 0x9a3a2a],
  glass: 0x2e4a5a,
  palmTrunk: 0x8a6a42,
  palmLeaf: 0x3f9e4d,
  playerShirt: 0xff5a3c,
  playerPants: 0x2e3a4a,
  policeWhite: 0xf2f2f2,
  policeBlack: 0x1a1d22,
  carColors: [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50, 0x16a085, 0xd35400],
};

// Story: Lucia "Luz" Vega, a courier fresh out of the Palmera docks, owes the
// harbour crew a debt. Four chained jobs pay it off — if the Palmera PD lets her.
export const MISSIONS = [
  {
    id: 'm1',
    timerSec: 150, // HUD display countdown reference only — never a fail state (PLAN §5.3)
    title: 'Hot Wheels',
    giver: 'Marco at the docks',
    story: 'Marco needs a car, fast, and he does not ask where it came from. Take any car on the street and bring it to the blue waypoint at the marina.',
    steps: [
      { type: 'steal', text: 'Take a car (walk up to one and press E)' },
      { type: 'goto', pos: [150, 150], radius: 10, text: 'Fight past the PD and reach the marina waypoint' },
    ],
  },
  {
    id: 'm2',
    timerSec: 240, // HUD display countdown reference only — never a fail state (PLAN §5.3)
    title: 'Courier Run',
    giver: 'Marco at the docks',
    story: 'The harbour crew trusts Luz with a sealed parcel. Two drops across town, no questions, no stops for the cops.',
    steps: [
      { type: 'goto', pos: [-140, -140], radius: 9, text: 'Drop 1: the old hotel on Coral Row' },
      { type: 'goto', pos: [140, -140], radius: 9, text: 'Drop 2: the rooftop bar on Sunset Ave' },
    ],
  },
  {
    id: 'm3',
    timerSec: 180, // HUD display countdown reference only — never a fail state (PLAN §5.3)
    title: 'Lose the Heat',
    giver: 'Rosa, the fixer',
    story: 'A drop went loud and the PD put three stars on Luz. Shake every cruiser, then lay low until the heat dies.',
    steps: [
      { type: 'heat', stars: 3, text: 'Get the heat up: steal a car or cause trouble (3 stars)' },
      { type: 'evade', text: 'Lose the cops — break line of sight and stay clear until the stars fade' },
    ],
  },
  {
    id: 'm4',
    timerSec: 300, // HUD display countdown reference only — never a fail state (PLAN §5.3)
    title: 'The Last Delivery',
    giver: 'Marco at the docks',
    story: 'One last run and the debt is gone: the harbour master’s ledger, delivered to the lighthouse point while the whole city watches.',
    steps: [
      { type: 'goto', pos: [-150, 150], radius: 9, text: 'Pick up the ledger at the west docks' },
      { type: 'goto', pos: [0, 210], radius: 9, text: 'Deliver it to the lighthouse point on the beach' },
    ],
  },
  {
    // v5.1 parity (P6): a bonus job after the debt — Rosa's second ledger.
    // The twist is line of sight: the marina drop only counts while no
    // cruiser has eyes on Luz (the same seen rule the HUD badge shows).
    id: 'm5',
    timerSec: 240, // HUD display countdown reference only — never a fail state (PLAN §5.3)
    title: 'Paper Trail',
    giver: 'Rosa, the fixer',
    story: 'The debt is paid, but Rosa has one more ledger that cannot be seen moving. Pick it up in Alto Mirador and drop it at the marina — unseen.',
    steps: [
      { type: 'goto', pos: [-150, -150], radius: 9, text: 'Pick up Rosa’s second ledger in Alto Mirador' },
      { type: 'sneak', pos: [150, 150], radius: 10, text: 'Drop it at the marina — only while no cruiser can see you (HIDDEN)' },
    ],
  },
];

// --- v5 "Senja Palmera" presentation constants (PLAN §2/§3) ----------------
// Every new colour/name/number for the visual overhaul lives here; the other
// modules read from these objects instead of scattering magic values.

// Locked golden-hour palette. The HUD clock still runs (a6), but the scene
// lighting does NOT follow it — frame consistency beats a day/night cycle.
export const SUNSET = {
  skyTop: '#2e1a47',
  skyMid: '#7a2d6d',
  skyPink: '#ff6b9d',
  skyOrange: '#ffb347',
  skyBelow: '#7a4a6d',
  sunCore: '#fff3c4',
  fog: 0xe88ca0,
  fogDensity: 0.00125, // v5.1 (P1): thinner haze, the far shore stays lit (was 0.0016)
  sunColor: 0xffa04e, // v5.1: hotter sun (was 0xff8c42)
  sunIntensity: 3.1, // v5.1 (P1): the flooded-sunset grade (was 2.4)
  sunPos: [90, 42, 190], // low, south-south-east: the chase camera looks into it
  hemiSky: 0xff9ec6,
  hemiGround: 0x3a2d5a,
  hemiIntensity: 0.9, // v5.1 (P1): sky bounce up (was 0.65)
  ambient: 0xffd9b0,
  ambientIntensity: 0.52, // v5.1 (P1): ambient floor up (was 0.35)
  cloud: 0xffc4b8,
  cloudOpacity: 0.38,
  beacon: 0xffb347, // v5: mission beacon turns neon orange (render.js)
  heroColor: 0xd81b60, // "Rosa Neón" hero sport colour (NAMES.cars.sport)
};

// The HUD clock starts inside the sunset window (18:24, DAY 1).
export const CLOCK_START = 18 * 60 + 24;

export const NAMES = {
  cars: {
    sedan: 'Duna S',
    hatch: 'Pico',
    van: 'Carguero',
    sport: 'Alisio GT',
    police: 'Vigía Interceptor',
  },
  heroKind: 'sport',
  shops: [
    'Toko Bunga Alba', 'Farmacia Sol', 'Barbería Norte', 'Tienda Brisa',
    'Panadería La Espiga', 'Taller Hermanos Ruiz', 'Joyería Mar', 'Librería Faro',
  ],
  billboards: [
    'ONDA ROSA 98.3 — HORA DORADA',
    'HOTEL MIRAMAR — BUKA 24 JAM',
    'ALISIO GT · BARU — RASAKAN SENJANYA',
    'CAFÉ FARO — KOPI & BOLILLOS',
    'PUERTO SERENA MARINA',
    'PALMERA CITY — KOTA SENJA',
  ],
  // Police callsign pool (§3.5): fixed word+number pairs, taken in order at
  // spawn so a cruiser keeps one callsign for its whole life.
  callsigns: ['FARO-12', 'BRISA-07', 'MAREA-23', 'VIENTO-31', 'ARENA-05', 'OLEAJE-18', 'DUNA-27', 'SALITRE-40'],
  weapon: 'La Chica',
  smg: 'La Ráfaga', // v5.1 (P5): Rosa's SMG, handed over when CH3 opens
};

export const RADIO = {
  station: 'ONDA ROSA 98.3',
  show: 'Hora Dorada',
  songs: [
    { title: 'Neon di Atas Teluk', artist: 'Vera Solano' },
    { title: 'Garis Pantai Liar', artist: 'Los Farolitos' },
    { title: 'Kaca Spion Pink', artist: 'Duna Eléctrica' },
    { title: 'Sirene Jauh', artist: 'Marta Vela' },
  ],
  songSec: 45, // display rotation only; audio.js is untouched
};

// District label under the minimap (§3.4). Beach first, then a 3×3 grid on
// the sign of x/z against ±56.
export function districtOf(x, z) {
  if (z >= CITY.beachZ) return 'Playa Alba';
  const col = x < -56 ? 0 : x > 56 ? 2 : 1;
  const row = z > 56 ? 0 : z < -56 ? 2 : 1;
  const grid = [
    ['Muelle Oeste', 'Rambla del Sol', 'Puerto Serena'],
    ['Barrio Coral', 'Centro Palmera', 'Loma Este'],
    ['Alto Mirador', 'Jardín Alto', 'Colina Brisa'],
  ];
  return grid[row][col];
}

// Story dialog lines (§3.6) — original text, keyed by story moment. Roles are
// short English chips to match the other HUD chips (NEXT, CODE, IN SIGHT…).
export const DIALOG = {
  m1_start: { who: 'Marco', role: 'THE DOCKS', text: 'Luz, ambil mobil apa saja di jalan. Bawa ke marina sebelum ada yang sadar.' },
  m2_start: { who: 'Marco', role: 'THE DOCKS', text: 'Paket tersegel, dua antar, jangan berhenti untuk siapa pun. Terutama yang berseragam.' },
  m3_start: { who: 'Rosa', role: 'FIXER', text: 'Drop tadi bunyinya keras. Lepaskan mereka, putus garis pandang, lalu diam sampai bintang padam.' },
  m3_heat: { who: 'Rosa', role: 'FIXER', text: 'Tiga bintang, Luz. Seluruh kota menonton — sekarang hilang dari pandangan mereka.' },
  m4_start: { who: 'Marco', role: 'THE DOCKS', text: 'Satu antar terakhir: buku besar dari dermaga barat ke titik mercusuar. Utangmu lunas setelah ini.' },
  m5_start: { who: 'Rosa', role: 'FIXER', text: 'Utang lunas — tapi buku kedua ini tidak boleh terlihat bergerak. Ambil di Alto Mirador, turunkan di marina saat tidak ada yang melihat.' },
  mission_done: { who: 'Rosa', role: 'FIXER', text: 'Bersih. Uangnya sudah jalan — jangan habiskan di satu tempat.' },
  all_done: { who: 'Luz Vega', role: 'COURIER', text: 'Utang lunas. Palmera tetap milikku malam ini.' },
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
