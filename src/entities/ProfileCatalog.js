/**
 * ProfileCatalog — Complete structural steel profile catalog.
 * Based on EN 10025 / Eurocódigo 3 / CTE DB SE-A (Normativa española).
 * All dimensions in mm. All properties computed per Eurocode standards.
 */

// ─── PARTIAL SAFETY FACTORS (EN 1993-1-1 / CTE DB SE-A) ────────
// γM0: resistencia de secciones transversales
// γM1: resistencia frente a inestabilidad
// γM2: resistencia de uniones / rotura en tracción
export const GAMMA_M = { M0: 1.00, M1: 1.00, M2: 1.25 };

// ─── STEEL GRADES (EN 10025 / CTE DB SE-A) ─────────────────────
export const STEEL_GRADES = {
  'S235 JR':  { fy: 235, fu: 360, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
  'S235 J0':  { fy: 235, fu: 360, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
  'S235 J2':  { fy: 235, fu: 360, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
  'S275 JR':  { fy: 275, fu: 430, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
  'S275 J0':  { fy: 275, fu: 430, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
  'S275 J2':  { fy: 275, fu: 430, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
  'S355 JR':  { fy: 355, fu: 510, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
  'S355 J0':  { fy: 355, fu: 510, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
  'S355 J2':  { fy: 355, fu: 510, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
  'S355 K2':  { fy: 355, fu: 510, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
  'S450 J0':  { fy: 450, fu: 550, density: 7850, E: 210000, G: 81000, nu: 0.3, alpha: 12e-6 },
};

export const STEEL_DENSITY = 7850; // kg/m³

// ─── I-SECTIONS: IPE (EN 19-57) ────────────────────────────────
// h=height, b=flange width, tw=web thickness, tf=flange thickness, r=root fillet
// Iy=moment inertia strong axis (cm⁴), Iz=weak axis (cm⁴), Wely/Welz=elastic section modulus (cm³)
export const IPE = {
  80:   { h:80,   b:46,   tw:3.8, tf:5.2, r:5,   A:7.64,   G:6.0,   Iy:80.1,    Iz:8.49,   Wely:20.0,   Welz:3.69  },
  100:  { h:100,  b:55,   tw:4.1, tf:5.7, r:7,   A:10.3,   G:8.1,   Iy:171,     Iz:15.9,   Wely:34.2,   Welz:5.79  },
  120:  { h:120,  b:64,   tw:4.4, tf:6.3, r:7,   A:13.2,   G:10.4,  Iy:318,     Iz:27.7,   Wely:53.0,   Welz:8.65  },
  140:  { h:140,  b:73,   tw:4.7, tf:6.9, r:7,   A:16.4,   G:12.9,  Iy:541,     Iz:44.9,   Wely:77.3,   Welz:12.3  },
  160:  { h:160,  b:82,   tw:5.0, tf:7.4, r:9,   A:20.1,   G:15.8,  Iy:869,     Iz:68.3,   Wely:109,    Welz:16.7  },
  180:  { h:180,  b:91,   tw:5.3, tf:8.0, r:9,   A:23.9,   G:18.8,  Iy:1317,    Iz:101,    Wely:146,    Welz:22.2  },
  200:  { h:200,  b:100,  tw:5.6, tf:8.5, r:12,  A:28.5,   G:22.4,  Iy:1943,    Iz:142,    Wely:194,    Welz:28.5  },
  220:  { h:220,  b:110,  tw:5.9, tf:9.2, r:12,  A:33.4,   G:26.2,  Iy:2772,    Iz:205,    Wely:252,    Welz:37.3  },
  240:  { h:240,  b:120,  tw:6.2, tf:9.8, r:15,  A:39.1,   G:30.7,  Iy:3892,    Iz:284,    Wely:324,    Welz:47.3  },
  270:  { h:270,  b:135,  tw:6.6, tf:10.2,r:15,  A:45.9,   G:36.1,  Iy:5790,    Iz:420,    Wely:429,    Welz:62.2  },
  300:  { h:300,  b:150,  tw:7.1, tf:10.7,r:15,  A:53.8,   G:42.2,  Iy:8356,    Iz:604,    Wely:557,    Welz:80.5  },
  330:  { h:330,  b:160,  tw:7.5, tf:11.5,r:18,  A:62.6,   G:49.1,  Iy:11770,   Iz:788,    Wely:713,    Welz:98.5  },
  360:  { h:360,  b:170,  tw:8.0, tf:12.7,r:18,  A:72.7,   G:57.1,  Iy:16270,   Iz:1043,   Wely:904,    Welz:123   },
  400:  { h:400,  b:180,  tw:8.6, tf:13.5,r:21,  A:84.5,   G:66.3,  Iy:23130,   Iz:1318,   Wely:1156,   Welz:146   },
  450:  { h:450,  b:190,  tw:9.4, tf:14.6,r:21,  A:98.8,   G:77.6,  Iy:33740,   Iz:1676,   Wely:1500,   Welz:176   },
  500:  { h:500,  b:200,  tw:10.2,tf:16.0,r:21,  A:116,    G:90.7,  Iy:48200,   Iz:2142,   Wely:1928,   Welz:214   },
  550:  { h:550,  b:210,  tw:11.1,tf:17.2,r:24,  A:134,    G:106,   Iy:67120,   Iz:2668,   Wely:2441,   Welz:254   },
  600:  { h:600,  b:220,  tw:12.0,tf:19.0,r:24,  A:156,    G:122,   Iy:92080,   Iz:3387,   Wely:3069,   Welz:308   },
};

// ─── I-SECTIONS: HEB (EN 10034) ────────────────────────────────
export const HEB = {
  100:  { h:100,  b:100,  tw:6.0, tf:10.0, r:12, A:26.0,  G:20.4,  Iy:450,    Iz:167,   Wely:89.9,   Welz:33.5 },
  120:  { h:120,  b:120,  tw:6.5, tf:11.0, r:12, A:34.0,  G:26.7,  Iy:864,    Iz:318,   Wely:144,    Welz:52.9 },
  140:  { h:140,  b:140,  tw:7.0, tf:12.0, r:12, A:43.0,  G:33.7,  Iy:1509,   Iz:550,   Wely:216,    Welz:78.5 },
  160:  { h:160,  b:160,  tw:8.0, tf:13.0, r:15, A:54.3,  G:42.6,  Iy:2492,   Iz:889,   Wely:311,    Welz:111  },
  180:  { h:180,  b:180,  tw:8.5, tf:14.0, r:15, A:65.3,  G:51.2,  Iy:3831,   Iz:1363,  Wely:426,    Welz:151  },
  200:  { h:200,  b:200,  tw:9.0, tf:15.0, r:18, A:78.1,  G:61.3,  Iy:5696,   Iz:2003,  Wely:570,    Welz:200  },
  220:  { h:220,  b:220,  tw:9.5, tf:16.0, r:18, A:91.0,  G:71.5,  Iy:8091,   Iz:2843,  Wely:736,    Welz:258  },
  240:  { h:240,  b:240,  tw:10.0,tf:17.0, r:21, A:106,   G:83.2,  Iy:11260,  Iz:3923,  Wely:938,    Welz:327  },
  260:  { h:260,  b:260,  tw:10.0,tf:17.5, r:24, A:118,   G:93.0,  Iy:14920,  Iz:5135,  Wely:1148,   Welz:395  },
  280:  { h:280,  b:280,  tw:10.5,tf:18.0, r:24, A:131,   G:103,   Iy:19270,  Iz:6595,  Wely:1376,   Welz:471  },
  300:  { h:300,  b:300,  tw:11.0,tf:19.0, r:27, A:149,   G:117,   Iy:25170,  Iz:8563,  Wely:1678,   Welz:571  },
  320:  { h:320,  b:300,  tw:11.5,tf:20.5, r:27, A:161,   G:127,   Iy:30820,  Iz:9239,  Wely:1926,   Welz:616  },
  340:  { h:340,  b:300,  tw:12.0,tf:21.5, r:27, A:171,   G:134,   Iy:36660,  Iz:9690,  Wely:2156,   Welz:646  },
  360:  { h:360,  b:300,  tw:12.5,tf:22.5, r:27, A:181,   G:142,   Iy:43190,  Iz:10140,  Wely:2400,  Welz:676  },
  400:  { h:400,  b:300,  tw:13.5,tf:24.0, r:27, A:198,   G:155,   Iy:57680,  Iz:10820,  Wely:2884,  Welz:721  },
  450:  { h:450,  b:300,  tw:14.0,tf:26.0, r:27, A:218,   G:171,   Iy:79890,  Iz:11720,  Wely:3551,  Welz:781  },
  500:  { h:500,  b:300,  tw:14.5,tf:28.0, r:27, A:239,   G:187,   Iy:107200, Iz:12620,  Wely:4287,  Welz:842  },
  550:  { h:550,  b:300,  tw:15.0,tf:29.0, r:27, A:254,   G:199,   Iy:136700, Iz:13080,  Wely:4971,  Welz:872  },
  600:  { h:600,  b:300,  tw:15.5,tf:30.0, r:27, A:270,   G:212,   Iy:171000, Iz:13530,  Wely:5701,  Welz:902  },
};

// ─── I-SECTIONS: HEA (EN 10034) ────────────────────────────────
export const HEA = {
  100:  { h:96,   b:100,  tw:5.0, tf:8.0,  r:12, A:21.2,  G:16.7,  Iy:349,    Iz:134,   Wely:72.8,   Welz:26.8 },
  120:  { h:114,  b:120,  tw:5.0, tf:8.0,  r:12, A:25.3,  G:19.9,  Iy:606,    Iz:231,   Wely:106,    Welz:38.5 },
  140:  { h:133,  b:140,  tw:5.5, tf:8.5,  r:12, A:31.4,  G:24.7,  Iy:1033,   Iz:389,   Wely:155,    Welz:55.6 },
  160:  { h:152,  b:160,  tw:6.0, tf:9.0,  r:15, A:38.8,  G:30.4,  Iy:1673,   Iz:616,   Wely:220,    Welz:76.9 },
  180:  { h:171,  b:180,  tw:6.0, tf:9.5,  r:15, A:45.3,  G:35.5,  Iy:2510,   Iz:925,   Wely:294,    Welz:103  },
  200:  { h:190,  b:200,  tw:6.5, tf:10.0, r:18, A:53.8,  G:42.3,  Iy:3692,   Iz:1336,  Wely:389,    Welz:134  },
  220:  { h:210,  b:220,  tw:7.0, tf:11.0, r:18, A:64.3,  G:50.5,  Iy:5410,   Iz:1955,  Wely:515,    Welz:178  },
  240:  { h:230,  b:240,  tw:7.5, tf:12.0, r:21, A:76.8,  G:60.3,  Iy:7763,   Iz:2769,  Wely:675,    Welz:231  },
  260:  { h:250,  b:260,  tw:7.5, tf:12.5, r:24, A:86.8,  G:68.2,  Iy:10450,  Iz:3668,  Wely:836,    Welz:282  },
  280:  { h:270,  b:280,  tw:8.0, tf:13.0, r:24, A:97.3,  G:76.4,  Iy:13670,  Iz:4763,  Wely:1013,   Welz:340  },
  300:  { h:290,  b:300,  tw:8.5, tf:14.0, r:27, A:113,   G:88.3,  Iy:18260,  Iz:6310,  Wely:1260,   Welz:421  },
  320:  { h:310,  b:300,  tw:9.0, tf:15.5, r:27, A:124,   G:97.6,  Iy:22930,  Iz:6985,  Wely:1479,   Welz:466  },
  340:  { h:330,  b:300,  tw:9.5, tf:16.5, r:27, A:133,   G:105,   Iy:27690,  Iz:7436,  Wely:1678,   Welz:496  },
  360:  { h:350,  b:300,  tw:10.0,tf:17.5, r:27, A:143,   G:112,   Iy:33090,  Iz:7887,  Wely:1891,   Welz:526  },
  400:  { h:390,  b:300,  tw:11.0,tf:19.0, r:27, A:159,   G:125,   Iy:45070,  Iz:8564,  Wely:2311,   Welz:571  },
  450:  { h:440,  b:300,  tw:11.5,tf:21.0, r:27, A:178,   G:140,   Iy:63720,  Iz:9465,  Wely:2896,   Welz:631  },
  500:  { h:490,  b:300,  tw:12.0,tf:23.0, r:27, A:198,   G:155,   Iy:86970,  Iz:10370, Wely:3550,   Welz:691  },
  550:  { h:540,  b:300,  tw:12.5,tf:24.0, r:27, A:212,   G:166,   Iy:111900, Iz:10820, Wely:4146,   Welz:721  },
  600:  { h:590,  b:300,  tw:13.0,tf:25.0, r:27, A:226,   G:178,   Iy:141200, Iz:11270, Wely:4787,   Welz:751  },
};

// ─── I-SECTIONS: IPN (DIN 1025-1) ──────────────────────────────
export const IPN = {
  80:   { h:80,   b:42,   tw:3.9, tf:5.9, r:3.9, A:7.58,  G:5.94,  Iy:77.8,   Iz:6.29,  Wely:19.5,   Welz:3.00 },
  100:  { h:100,  b:50,   tw:4.5, tf:6.8, r:4.5, A:10.6,  G:8.34,  Iy:171,    Iz:12.2,  Wely:34.2,   Welz:4.88 },
  120:  { h:120,  b:58,   tw:5.1, tf:7.7, r:5.1, A:14.2,  G:11.1,  Iy:328,    Iz:21.5,  Wely:54.7,   Welz:7.41 },
  140:  { h:140,  b:66,   tw:5.7, tf:8.6, r:5.7, A:18.3,  G:14.4,  Iy:573,    Iz:35.2,  Wely:81.9,   Welz:10.7 },
  160:  { h:160,  b:74,   tw:6.3, tf:9.5, r:6.3, A:22.8,  G:17.9,  Iy:935,    Iz:54.7,  Wely:117,    Welz:14.8 },
  180:  { h:180,  b:82,   tw:6.9, tf:10.4,r:6.9, A:27.9,  G:21.9,  Iy:1450,   Iz:81.3,  Wely:161,    Welz:19.8 },
  200:  { h:200,  b:90,   tw:7.5, tf:11.3,r:7.5, A:33.4,  G:26.2,  Iy:2140,   Iz:117,   Wely:214,    Welz:26.0 },
  220:  { h:220,  b:98,   tw:8.1, tf:12.2,r:8.1, A:39.5,  G:31.1,  Iy:3060,   Iz:162,   Wely:278,    Welz:33.1 },
  240:  { h:240,  b:106,  tw:8.7, tf:13.1,r:8.7, A:46.1,  G:36.2,  Iy:4250,   Iz:221,   Wely:354,    Welz:41.7 },
  260:  { h:260,  b:113,  tw:9.4, tf:14.1,r:9.4, A:53.3,  G:41.9,  Iy:5740,   Iz:288,   Wely:442,    Welz:51.0 },
  280:  { h:280,  b:119,  tw:10.1,tf:15.2,r:10.1,A:61.0,  G:47.9,  Iy:7590,   Iz:364,   Wely:542,    Welz:61.2 },
  300:  { h:300,  b:125,  tw:10.8,tf:16.2,r:10.8,A:69.0,  G:54.2,  Iy:9800,   Iz:451,   Wely:653,    Welz:72.2 },
  320:  { h:320,  b:131,  tw:11.5,tf:17.3,r:11.5,A:77.7,  G:61.0,  Iy:12510,  Iz:555,   Wely:782,    Welz:84.7 },
  340:  { h:340,  b:137,  tw:12.2,tf:18.3,r:12.2,A:86.7,  G:68.0,  Iy:15700,  Iz:674,   Wely:923,    Welz:98.4 },
  360:  { h:360,  b:143,  tw:13.0,tf:19.5,r:13.0,A:97.1,  G:76.1,  Iy:19610,  Iz:818,   Wely:1090,   Welz:114  },
  380:  { h:380,  b:149,  tw:13.7,tf:20.5,r:13.7,A:107,   G:84.0,  Iy:24010,  Iz:975,   Wely:1263,   Welz:131  },
  400:  { h:400,  b:155,  tw:14.4,tf:21.6,r:14.4,A:118,   G:92.4,  Iy:29210,  Iz:1160,  Wely:1460,   Welz:150  },
};

// ─── CHANNELS: UPN (EN 10279) ───────────────────────────────────
export const UPN = {
  50:   { h:50,   b:38,  tw:5.0, tf:7.0,  r:7,   A:7.12,  G:5.59,  Iy:26.4,   Iz:9.12,  Wely:10.6,   Welz:3.56 },
  65:   { h:65,   b:42,  tw:5.5, tf:7.5,  r:7.5, A:9.03,  G:7.09,  Iy:57.5,   Iz:14.1,  Wely:17.7,   Welz:4.75 },
  80:   { h:80,   b:45,  tw:6.0, tf:8.0,  r:8,   A:11.0,  G:8.64,  Iy:106,    Iz:19.4,  Wely:26.5,   Welz:6.36 },
  100:  { h:100,  b:50,  tw:6.0, tf:8.5,  r:8.5, A:13.5,  G:10.6,  Iy:206,    Iz:29.3,  Wely:41.2,   Welz:8.49 },
  120:  { h:120,  b:55,  tw:7.0, tf:9.0,  r:9,   A:17.0,  G:13.4,  Iy:364,    Iz:43.2,  Wely:60.7,   Welz:11.1 },
  140:  { h:140,  b:60,  tw:7.0, tf:10.0, r:10,  A:20.4,  G:16.0,  Iy:605,    Iz:62.7,  Wely:86.4,   Welz:14.8 },
  160:  { h:160,  b:65,  tw:7.5, tf:10.5, r:10.5,A:24.0,  G:18.8,  Iy:925,    Iz:85.3,  Wely:116,    Welz:18.3 },
  180:  { h:180,  b:70,  tw:8.0, tf:11.0, r:11,  A:28.0,  G:22.0,  Iy:1350,   Iz:114,   Wely:150,    Welz:22.4 },
  200:  { h:200,  b:75,  tw:8.5, tf:11.5, r:11.5,A:32.2,  G:25.3,  Iy:1910,   Iz:148,   Wely:191,    Welz:27.0 },
  220:  { h:220,  b:80,  tw:9.0, tf:12.5, r:12.5,A:37.4,  G:29.4,  Iy:2690,   Iz:197,   Wely:245,    Welz:33.6 },
  240:  { h:240,  b:85,  tw:9.5, tf:13.0, r:13,  A:42.3,  G:33.2,  Iy:3600,   Iz:248,   Wely:300,    Welz:39.6 },
  260:  { h:260,  b:90,  tw:10.0,tf:14.0, r:14,  A:48.3,  G:37.9,  Iy:4820,   Iz:317,   Wely:371,    Welz:47.7 },
  280:  { h:280,  b:95,  tw:10.0,tf:15.0, r:15,  A:53.3,  G:41.8,  Iy:6280,   Iz:399,   Wely:448,    Welz:57.2 },
  300:  { h:300,  b:100, tw:10.0,tf:16.0, r:16,  A:58.8,  G:46.2,  Iy:8030,   Iz:495,   Wely:535,    Welz:67.8 },
  320:  { h:320,  b:100, tw:14.0,tf:17.5, r:17.5,A:75.8,  G:59.5,  Iy:10870,  Iz:597,   Wely:679,    Welz:80.6 },
  350:  { h:350,  b:100, tw:14.0,tf:16.0, r:16,  A:77.3,  G:60.6,  Iy:12840,  Iz:570,   Wely:734,    Welz:75.0 },
  380:  { h:380,  b:102, tw:13.5,tf:16.0, r:16,  A:80.4,  G:63.1,  Iy:15760,  Iz:615,   Wely:829,    Welz:78.7 },
  400:  { h:400,  b:110, tw:14.0,tf:18.0, r:18,  A:91.5,  G:71.8,  Iy:20350,  Iz:846,   Wely:1017,   Welz:102  },
};

// ─── EQUAL ANGLES: L (EN 10056-1) ──────────────────────────────
export const L = {
  '20x3':   { a:20,  b:20,  t:3,   A:1.12, G:0.88  },
  '25x3':   { a:25,  b:25,  t:3,   A:1.42, G:1.12  },
  '30x3':   { a:30,  b:30,  t:3,   A:1.74, G:1.36  },
  '30x4':   { a:30,  b:30,  t:4,   A:2.27, G:1.78  },
  '35x4':   { a:35,  b:35,  t:4,   A:2.67, G:2.10  },
  '40x4':   { a:40,  b:40,  t:4,   A:3.08, G:2.42  },
  '40x5':   { a:40,  b:40,  t:5,   A:3.79, G:2.97  },
  '45x5':   { a:45,  b:45,  t:5,   A:4.30, G:3.38  },
  '50x5':   { a:50,  b:50,  t:5,   A:4.80, G:3.77  },
  '50x6':   { a:50,  b:50,  t:6,   A:5.69, G:4.47  },
  '60x5':   { a:60,  b:60,  t:5,   A:5.82, G:4.57  },
  '60x6':   { a:60,  b:60,  t:6,   A:6.91, G:5.42  },
  '60x8':   { a:60,  b:60,  t:8,   A:9.03, G:7.09  },
  '70x6':   { a:70,  b:70,  t:6,   A:8.13, G:6.38  },
  '70x7':   { a:70,  b:70,  t:7,   A:9.40, G:7.38  },
  '80x8':   { a:80,  b:80,  t:8,   A:12.3, G:9.63  },
  '80x10':  { a:80,  b:80,  t:10,  A:15.1, G:11.9  },
  '90x9':   { a:90,  b:90,  t:9,   A:15.5, G:12.2  },
  '100x10': { a:100, b:100, t:10,  A:19.2, G:15.0  },
  '100x12': { a:100, b:100, t:12,  A:22.7, G:17.8  },
  '120x10': { a:120, b:120, t:10,  A:23.2, G:18.2  },
  '120x12': { a:120, b:120, t:12,  A:27.5, G:21.6  },
  '150x12': { a:150, b:150, t:12,  A:34.8, G:27.3  },
  '150x15': { a:150, b:150, t:15,  A:43.0, G:33.7  },
  '200x16': { a:200, b:200, t:16,  A:61.8, G:48.5  },
  '200x20': { a:200, b:200, t:20,  A:76.0, G:59.6  },
};

// ─── CHS: Circular Hollow Sections (EN 10210) ──────────────────
export const CHS = {
  '33.7x3.2':   { d:33.7,  t:3.2,  A:3.07, G:2.41  },
  '42.4x3.2':   { d:42.4,  t:3.2,  A:3.94, G:3.09  },
  '48.3x3.2':   { d:48.3,  t:3.2,  A:4.53, G:3.56  },
  '60.3x3.6':   { d:60.3,  t:3.6,  A:6.41, G:5.03  },
  '76.1x3.6':   { d:76.1,  t:3.6,  A:8.20, G:6.44  },
  '88.9x4.0':   { d:88.9,  t:4.0,  A:10.7, G:8.38  },
  '101.6x4.0':  { d:101.6, t:4.0,  A:12.3, G:9.63  },
  '114.3x4.0':  { d:114.3, t:4.0,  A:13.9, G:10.9  },
  '114.3x5.0':  { d:114.3, t:5.0,  A:17.2, G:13.5  },
  '139.7x5.0':  { d:139.7, t:5.0,  A:21.2, G:16.6  },
  '139.7x6.3':  { d:139.7, t:6.3,  A:26.4, G:20.7  },
  '168.3x5.0':  { d:168.3, t:5.0,  A:25.7, G:20.1  },
  '168.3x6.3':  { d:168.3, t:6.3,  A:32.1, G:25.2  },
  '193.7x6.3':  { d:193.7, t:6.3,  A:37.1, G:29.1  },
  '193.7x8.0':  { d:193.7, t:8.0,  A:46.7, G:36.6  },
  '219.1x6.3':  { d:219.1, t:6.3,  A:42.1, G:33.1  },
  '219.1x8.0':  { d:219.1, t:8.0,  A:53.0, G:41.6  },
  '219.1x10.0': { d:219.1, t:10.0, A:65.7, G:51.6  },
  '273.0x6.3':  { d:273.0, t:6.3,  A:52.8, G:41.4  },
  '273.0x8.0':  { d:273.0, t:8.0,  A:66.6, G:52.3  },
  '273.0x10.0': { d:273.0, t:10.0, A:82.6, G:64.8  },
  '323.9x8.0':  { d:323.9, t:8.0,  A:79.4, G:62.3  },
  '323.9x10.0': { d:323.9, t:10.0, A:98.6, G:77.4  },
  '323.9x12.5': { d:323.9, t:12.5, A:122,  G:96.0  },
  '355.6x10.0': { d:355.6, t:10.0, A:109,  G:85.2  },
  '406.4x10.0': { d:406.4, t:10.0, A:125,  G:97.8  },
  '406.4x12.5': { d:406.4, t:12.5, A:155,  G:121   },
  '457.0x12.5': { d:457.0, t:12.5, A:175,  G:137   },
  '508.0x12.5': { d:508.0, t:12.5, A:195,  G:153   },
};

// ─── RHS / SHS: Rectangular/Square Hollow Sections (EN 10210) ───
export const SHS = {
  '40x40x3':    { h:40,  b:40,  t:3,   A:4.35, G:3.41  },
  '40x40x4':    { h:40,  b:40,  t:4,   A:5.43, G:4.26  },
  '50x50x3':    { h:50,  b:50,  t:3,   A:5.55, G:4.35  },
  '50x50x4':    { h:50,  b:50,  t:4,   A:7.03, G:5.52  },
  '50x50x5':    { h:50,  b:50,  t:5,   A:8.36, G:6.56  },
  '60x60x3':    { h:60,  b:60,  t:3,   A:6.75, G:5.30  },
  '60x60x4':    { h:60,  b:60,  t:4,   A:8.63, G:6.77  },
  '60x60x5':    { h:60,  b:60,  t:5,   A:10.4, G:8.13  },
  '70x70x4':    { h:70,  b:70,  t:4,   A:10.2, G:8.03  },
  '70x70x5':    { h:70,  b:70,  t:5,   A:12.4, G:9.70  },
  '80x80x4':    { h:80,  b:80,  t:4,   A:11.8, G:9.28  },
  '80x80x5':    { h:80,  b:80,  t:5,   A:14.4, G:11.3  },
  '80x80x6':    { h:80,  b:80,  t:6,   A:16.8, G:13.2  },
  '90x90x5':    { h:90,  b:90,  t:5,   A:16.4, G:12.8  },
  '100x100x4':  { h:100, b:100, t:4,   A:15.0, G:11.7  },
  '100x100x5':  { h:100, b:100, t:5,   A:18.4, G:14.4  },
  '100x100x6':  { h:100, b:100, t:6,   A:21.6, G:17.0  },
  '100x100x8':  { h:100, b:100, t:8,   A:27.4, G:21.5  },
  '120x120x5':  { h:120, b:120, t:5,   A:22.4, G:17.5  },
  '120x120x6':  { h:120, b:120, t:6,   A:26.4, G:20.7  },
  '120x120x8':  { h:120, b:120, t:8,   A:33.8, G:26.5  },
  '150x150x5':  { h:150, b:150, t:5,   A:28.4, G:22.3  },
  '150x150x6':  { h:150, b:150, t:6,   A:33.6, G:26.4  },
  '150x150x8':  { h:150, b:150, t:8,   A:43.4, G:34.0  },
  '150x150x10': { h:150, b:150, t:10,  A:52.4, G:41.1  },
  '200x200x6':  { h:200, b:200, t:6,   A:45.6, G:35.8  },
  '200x200x8':  { h:200, b:200, t:8,   A:59.4, G:46.6  },
  '200x200x10': { h:200, b:200, t:10,  A:72.4, G:56.8  },
  '250x250x8':  { h:250, b:250, t:8,   A:75.4, G:59.2  },
  '250x250x10': { h:250, b:250, t:10,  A:92.4, G:72.5  },
  '300x300x10': { h:300, b:300, t:10,  A:112,  G:88.2  },
  '300x300x12': { h:300, b:300, t:12,  A:134,  G:105   },
};

// ─── CATALOG INDEX ──────────────────────────────────────────────
export const PROFILE_CATALOG = { IPE, HEB, HEA, IPN, UPN, L, CHS, SHS };

export const SERIES_LIST = ['IPE', 'HEB', 'HEA', 'IPN', 'UPN', 'L', 'CHS', 'SHS'];

// ─── HELPER FUNCTIONS ──────────────────────────────────────────
export function getSizes(series) {
  const cat = PROFILE_CATALOG[series];
  if (!cat) return [];
  return Object.keys(cat);
}

export function getProfileData(series, size) {
  return PROFILE_CATALOG[series]?.[size] || null;
}

/**
 * Get full engineering properties for a profile
 */
export function getEngineeringData(series, size, length, steelGrade = 'S275 JR') {
  const data = getProfileData(series, size);
  if (!data) return null;

  const grade = STEEL_GRADES[steelGrade] || STEEL_GRADES['S275 JR'];

  // Area: use catalog value if available, else compute
  let area, mass;
  if (data.A) {
    area = data.A; // cm²
  } else if (series === 'L') {
    area = (data.a + data.b - data.t) * data.t / 100;
  } else if (series === 'CHS') {
    area = Math.PI * (data.d - data.t) * data.t / 100;
  } else if (series === 'SHS') {
    area = (2 * (data.h + data.b) - 4 * data.t) * data.t / 100;
  } else {
    const webH = data.h - 2 * data.tf;
    area = (2 * data.b * data.tf + webH * data.tw) / 100;
  }

  if (data.G) {
    mass = data.G * length; // kg/m * m
  } else {
    mass = area / 10000 * length * grade.density;
  }

  // Derived plastic / torsional quantities, estimated when not stored
  const extras = estimateAdvancedProps(series, data);
  const elastic = estimateElasticProps(series, data);

  // Radii of gyration (cm)
  const iy = (elastic.Iy && area) ? Math.sqrt(elastic.Iy / area) : 0;
  const iz = (elastic.Iz && area) ? Math.sqrt(elastic.Iz / area) : 0;

  // Section class per EC3 (simplified: based on c/t ratios of web & flanges in pure bending)
  const sectionClass = estimateSectionClass(series, data, grade.fy);

  return {
    designation: `${series} ${size}`,
    area,      // cm²
    mass,      // kg
    tw: data.tw || data.t || 0,
    tf: data.tf || data.t || 0,
    h: data.h || data.d || data.a || 0,
    b: data.b || data.d || 0,
    Iy: elastic.Iy,
    Iz: elastic.Iz,
    Wely: elastic.Wely,
    Welz: elastic.Welz,
    Wply: extras.Wply,
    Wplz: extras.Wplz,
    It:   extras.It,
    Iw:   extras.Iw,
    iy, iz,
    sectionClass,
    fy: grade.fy,
    fu: grade.fu,
    E: grade.E,
    G: grade.G,
    density: grade.density,
    gammaM0: GAMMA_M.M0,
    gammaM1: GAMMA_M.M1,
    gammaM2: GAMMA_M.M2,
    linearWeight: data.G || (area / 10000 * grade.density),
    r: data.r || 0,
  };
}

// Elastic properties for catalogues that only provide dimensions and area.
// Results use idealised sharp-corner hollow sections. Units: cm4 and cm3.
export function estimateElasticProps(series, d) {
  if (!d) return { Iy: 0, Iz: 0, Wely: 0, Welz: 0, estimated: true };
  if (d.Iy && d.Iz) {
    return { Iy: d.Iy, Iz: d.Iz, Wely: d.Wely || 0, Welz: d.Welz || 0, estimated: false };
  }
  if (series === 'CHS') {
    const D = d.d;
    const Di = Math.max(0, D - 2 * d.t);
    const Imm4 = Math.PI * (Math.pow(D, 4) - Math.pow(Di, 4)) / 64;
    const Wmm3 = Imm4 / (D / 2);
    return { Iy: Imm4 / 1e4, Iz: Imm4 / 1e4, Wely: Wmm3 / 1e3, Welz: Wmm3 / 1e3, estimated: true };
  }
  if (series === 'SHS') {
    const hi = Math.max(0, d.h - 2 * d.t);
    const bi = Math.max(0, d.b - 2 * d.t);
    const IyMm4 = (d.b * Math.pow(d.h, 3) - bi * Math.pow(hi, 3)) / 12;
    const IzMm4 = (d.h * Math.pow(d.b, 3) - hi * Math.pow(bi, 3)) / 12;
    return {
      Iy: IyMm4 / 1e4,
      Iz: IzMm4 / 1e4,
      Wely: IyMm4 / (d.h / 2) / 1e3,
      Welz: IzMm4 / (d.b / 2) / 1e3,
      estimated: true,
    };
  }
  return { Iy: 0, Iz: 0, Wely: 0, Welz: 0, estimated: true };
}
// ─── ADVANCED GEOMETRIC PROPERTIES ─────────────────────────────
// Returns Wply, Wplz (cm³), It torsional constant (cm⁴) and Iw warping (cm⁶).
// When catalog does not expose them we estimate from the idealized geometry.
export function estimateAdvancedProps(series, d) {
  if (!d) return { Wply: 0, Wplz: 0, It: 0, Iw: 0 };
  // If catalog already has them, honor those.
  if (d.Wply || d.Wplz || d.It || d.Iw) {
    return { Wply: d.Wply || 0, Wplz: d.Wplz || 0, It: d.It || 0, Iw: d.Iw || 0 };
  }

  if (['IPE','HEB','HEA','IPN'].includes(series)) {
    const h = d.h, b = d.b, tw = d.tw, tf = d.tf;
    const hw = h - 2 * tf;          // clear web height
    // Plastic moduli (mm³ then → cm³ /1000)
    const Wply_mm3 = b * tf * (h - tf) + (tw * hw * hw) / 4;
    const Wplz_mm3 = (tf * b * b) / 2 + ((h - 2*tf) * tw * tw) / 4;
    // St. Venant torsional constant (open thin-walled): It = Σ b·t³/3
    const It_mm4 = (2 * b * Math.pow(tf,3) + hw * Math.pow(tw,3)) / 3;
    // Warping constant for I-section: Iw = (tf·b³·(h-tf)²)/24
    const Iw_mm6 = (tf * Math.pow(b,3) * Math.pow(h - tf, 2)) / 24;
    return {
      Wply: Wply_mm3 / 1000,
      Wplz: Wplz_mm3 / 1000,
      It:   It_mm4 / 10000,
      Iw:   Iw_mm6 / 1e6,
    };
  }
  if (series === 'UPN') {
    const h = d.h, b = d.b, tw = d.tw, tf = d.tf;
    const hw = h - 2 * tf;
    const Wply_mm3 = b * tf * (h - tf) + (tw * hw * hw) / 4;
    const Wplz_mm3 = (tf * b * b) / 2;
    const It_mm4 = (2 * b * Math.pow(tf,3) + hw * Math.pow(tw,3)) / 3;
    return { Wply: Wply_mm3/1000, Wplz: Wplz_mm3/1000, It: It_mm4/10000, Iw: 0 };
  }
  if (series === 'CHS') {
    const D = d.d, t = d.t;
    const Di = D - 2 * t;
    // Plastic modulus of hollow circle: W_pl = (D³ - Di³)/6
    const Wpl_mm3 = (Math.pow(D,3) - Math.pow(Di,3)) / 6;
    // Torsional constant = 2·I (for CHS, J = Ip = π/32·(D⁴-Di⁴))
    const It_mm4 = Math.PI * (Math.pow(D,4) - Math.pow(Di,4)) / 32;
    return { Wply: Wpl_mm3/1000, Wplz: Wpl_mm3/1000, It: It_mm4/10000, Iw: 0 };
  }
  if (series === 'SHS') {
    const h = d.h, b = d.b, t = d.t;
    // Plastic moduli of a thin-walled rect tube (approx.)
    const Wply_mm3 = (b * h * h - (b - 2*t) * Math.pow(h - 2*t, 2)) / 4;
    const Wplz_mm3 = (h * b * b - (h - 2*t) * Math.pow(b - 2*t, 2)) / 4;
    // Closed section torsion: It ≈ 2·t·(h-t)²·(b-t)² / (h + b - 2t)
    const It_mm4 = (2 * t * Math.pow(h - t, 2) * Math.pow(b - t, 2)) / Math.max(1, (h + b - 2*t));
    return { Wply: Wply_mm3/1000, Wplz: Wplz_mm3/1000, It: It_mm4/10000, Iw: 0 };
  }
  if (series === 'L') {
    const a = d.a, t = d.t;
    const Wpl_mm3 = (a * t * t) / 2 + ((a - t) * t * (a - t)) / 2;
    const It_mm4 = (2 * a * Math.pow(t,3)) / 3;
    return { Wply: Wpl_mm3/1000, Wplz: Wpl_mm3/1000, It: It_mm4/10000, Iw: 0 };
  }
  return { Wply: 0, Wplz: 0, It: 0, Iw: 0 };
}

/**
 * Simplified EC3 §5.5 cross-section classification under pure bending.
 * Returns 1 | 2 | 3 | 4. Conservative — uses web/flange slendernesses only.
 */
export function estimateSectionClass(series, d, fy = 275) {
  if (!d) return 3;
  const eps = Math.sqrt(235 / fy);
  if (['IPE','HEB','HEA','IPN'].includes(series)) {
    const cFl = (d.b - d.tw) / 2 - (d.r || 0);
    const cWeb = d.h - 2 * d.tf - 2 * (d.r || 0);
    const flRatio = cFl / d.tf;
    const webRatio = cWeb / d.tw;
    // Outstand flange: class 1 ≤ 9ε, 2 ≤ 10ε, 3 ≤ 14ε
    // Web in bending: class 1 ≤ 72ε, 2 ≤ 83ε, 3 ≤ 124ε
    let cFlClass = flRatio <= 9*eps ? 1 : flRatio <= 10*eps ? 2 : flRatio <= 14*eps ? 3 : 4;
    let cWbClass = webRatio <= 72*eps ? 1 : webRatio <= 83*eps ? 2 : webRatio <= 124*eps ? 3 : 4;
    return Math.max(cFlClass, cWbClass);
  }
  if (series === 'SHS') {
    const c = Math.max(d.h, d.b) - 3 * d.t;
    const ratio = c / d.t;
    return ratio <= 33*eps ? 1 : ratio <= 38*eps ? 2 : ratio <= 42*eps ? 3 : 4;
  }
  if (series === 'CHS') {
    const ratio = d.d / d.t;
    return ratio <= 50*eps*eps ? 1 : ratio <= 70*eps*eps ? 2 : ratio <= 90*eps*eps ? 3 : 4;
  }
  if (series === 'UPN') {
    const webRatio = (d.h - 2*d.tf) / d.tw;
    return webRatio <= 72*eps ? 1 : webRatio <= 83*eps ? 2 : webRatio <= 124*eps ? 3 : 4;
  }
  return 3;
}
