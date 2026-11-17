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
  heatPerStar: 20,
  stealCar: 25,
  punch: 12,
  shoot: 30,
  kill: 40,
  max: 5,
};

export const MONEY = {
  start: 250,
  punchLoot: 15,
  missionReward: [400, 650, 900, 1500],
};

export const PALETTE = {
  sky: 0x8ec8e8,
  fog: 0xd8c8a8, // warm coastal haze, not cold blue
  sun: 0xffdf9e, // low golden sun
  asphalt: 0x3a3f46,
  sidewalk: 0x9aa0a3,
  sand: 0xe8d29a,
  sea: 0x1e7fa8,
  seaDeep: 0x0e5a80,
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
    title: 'Hot Wheels',
    giver: 'Marco at the docks',
    story: 'Marco needs a car, fast, and he does not ask where it came from. Take any car on the street and bring it to the blue waypoint at the marina.',
    steps: [
      { type: 'steal', text: 'Take a car (walk up to one and press E)' },
      { type: 'goto', pos: [150, 150], radius: 10, text: 'Drive the car to the marina waypoint' },
    ],
  },
  {
    id: 'm2',
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
    title: 'The Last Delivery',
    giver: 'Marco at the docks',
    story: 'One last run and the debt is gone: the harbour master’s ledger, delivered to the lighthouse point while the whole city watches.',
    steps: [
      { type: 'goto', pos: [-150, 150], radius: 9, text: 'Pick up the ledger at the west docks' },
      { type: 'goto', pos: [0, 210], radius: 9, text: 'Deliver it to the lighthouse point on the beach' },
    ],
  },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
