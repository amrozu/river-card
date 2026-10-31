// Rivers the card can draw. Names on the map are local; panel text is English.
export type LonLat = [number, number];

export type Preset = {
  id: string;
  /** River name shown on the card (local spelling). */
  label: string;
  /** Natural Earth ADM0_A3 code of the highlighted country. */
  country: string;
  /** River name(s) in Natural Earth — several when the river is split into named parts. */
  ne: string | string[];
  /** Point near the real source — picks where the river line starts. */
  source: LonLat;
  /** Optional cut: keep the river only from here (e.g. where it enters the country). */
  cutFrom?: LonLat;
  /** Optional map extent [lon0, lat0, lon1, lat1]; default: country ∪ river. */
  extent?: [number, number, number, number];
  sourceText: string;
  mouthText: string;
  sea?: { name: string; lon: number; lat: number };
  /** Cities from CITIES shown along the river. */
  cities: string[];
};

export const PRESETS: Preset[] = [
  {
    id: 'wisla', label: 'Wisła', country: 'POL', ne: 'Vistula', source: [18.88, 49.64],
    sourceText: 'in the Beskids', mouthText: 'on the Baltic',
    sea: { name: 'Morze Bałtyckie', lon: 14.6, lat: 55.05 },
    cities: ['Kraków', 'Warszawa', 'Toruń', 'Gdańsk'],
  },
  {
    id: 'rhein', label: 'Rhein', country: 'DEU', ne: ['Rhein', 'Rhin', 'Rhine', 'Waal'], source: [9.55, 47.51],
    sourceText: 'at Lake Constance', mouthText: 'at the North Sea',
    sea: { name: 'Nordsee', lon: 4.2, lat: 54.6 },
    cities: ['Basel', 'Mainz', 'Köln', 'Rotterdam'],
  },
  {
    id: 'loire', label: 'Loire', country: 'FRA', ne: 'Loire', source: [4.22, 44.84],
    sourceText: 'in the Massif Central', mouthText: 'on the Atlantic',
    sea: { name: 'Océan Atlantique', lon: -5.6, lat: 45.6 },
    cities: ['Orléans', 'Tours', 'Nantes'],
  },
  {
    id: 'thames', label: 'Thames', country: 'GBR', ne: 'Thames', source: [-2.03, 51.69],
    extent: [-3.3, 50.55, 2.0, 52.45],
    sourceText: 'in the Cotswolds', mouthText: 'at the North Sea',
    sea: { name: 'English Channel', lon: -1.9, lat: 50.62 },
    cities: ['Oxford', 'Reading', 'London'],
  },
  {
    id: 'po', label: 'Po', country: 'ITA', ne: 'Po', source: [7.09, 44.7],
    sourceText: 'at Monviso, in the Alps', mouthText: 'on the Adriatic',
    sea: { name: 'Mare Adriatico', lon: 14.6, lat: 43.6 },
    cities: ['Torino', 'Piacenza', 'Ferrara'],
  },
  {
    id: 'vltava', label: 'Vltava', country: 'CZE', ne: 'Vltava', source: [13.6, 48.97],
    sourceText: 'in the Šumava', mouthText: 'joining the Labe',
    cities: ['České Budějovice', 'Praha'],
  },
  {
    id: 'mississippi', label: 'Mississippi', country: 'USA', ne: 'Mississippi', source: [-95.21, 47.24],
    sourceText: 'at Lake Itasca', mouthText: 'in the Gulf',
    cities: ['Minneapolis', 'St. Louis', 'Memphis', 'New Orleans'],
  },
  {
    id: 'nile', label: 'Nile', country: 'EGY', ne: ['Nile', 'Rosetta Branch'], source: [33.0, 0.4], cutFrom: [31.3, 21.9],
    sourceText: 'where it enters Egypt', mouthText: 'on the Mediterranean',
    sea: { name: 'Mediterranean Sea', lon: 27.2, lat: 32.25 },
    cities: ['Aswan', 'Luxor', 'Cairo'],
  },
];

export type City = { name: string; lon: number; lat: number; alt?: string[] };

/** River cities and big cities that can be marked as the user's home. */
export const CITIES: City[] = [
  // Polska
  { name: 'Warszawa', lon: 21.0122, lat: 52.2297, alt: ['Warsaw'] },
  { name: 'Kraków', lon: 19.9366, lat: 50.0614, alt: ['Cracow', 'Krakow'] },
  { name: 'Toruń', lon: 18.5984, lat: 53.0138, alt: ['Torun'] },
  { name: 'Gdańsk', lon: 18.6466, lat: 54.352, alt: ['Gdansk'] },
  { name: 'Wrocław', lon: 17.0385, lat: 51.1079, alt: ['Wroclaw', 'Breslau'] },
  { name: 'Poznań', lon: 16.9252, lat: 52.4064, alt: ['Poznan'] },
  { name: 'Łódź', lon: 19.456, lat: 51.7592, alt: ['Lodz'] },
  { name: 'Katowice', lon: 19.0238, lat: 50.2649 },
  { name: 'Lublin', lon: 22.5684, lat: 51.2465 },
  { name: 'Szczecin', lon: 14.5528, lat: 53.4285 },
  { name: 'Białystok', lon: 23.1688, lat: 53.1325, alt: ['Bialystok'] },
  { name: 'Rzeszów', lon: 22.0047, lat: 50.0412, alt: ['Rzeszow'] },
  { name: 'Bydgoszcz', lon: 18.0084, lat: 53.1235 },
  { name: 'Gdynia', lon: 18.5305, lat: 54.5189 },
  { name: 'Olsztyn', lon: 20.4801, lat: 53.7784 },
  { name: 'Kielce', lon: 20.6286, lat: 50.8661 },
  { name: 'Opole', lon: 17.9213, lat: 50.6751 },
  { name: 'Gliwice', lon: 18.6766, lat: 50.2945 },
  // Deutschland & Rhein
  { name: 'Basel', lon: 7.5886, lat: 47.5596 },
  { name: 'Mainz', lon: 8.2473, lat: 49.9929 },
  { name: 'Köln', lon: 6.9603, lat: 50.9375, alt: ['Koln', 'Cologne'] },
  { name: 'Rotterdam', lon: 4.4777, lat: 51.9244 },
  { name: 'Berlin', lon: 13.405, lat: 52.52 },
  { name: 'Hamburg', lon: 9.9937, lat: 53.5511 },
  { name: 'München', lon: 11.582, lat: 48.1351, alt: ['Munich', 'Munchen'] },
  { name: 'Frankfurt', lon: 8.6821, lat: 50.1109 },
  { name: 'Stuttgart', lon: 9.1829, lat: 48.7758 },
  { name: 'Düsseldorf', lon: 6.7735, lat: 51.2277, alt: ['Dusseldorf'] },
  { name: 'Leipzig', lon: 12.3731, lat: 51.3397 },
  { name: 'Dresden', lon: 13.7373, lat: 51.0504 },
  { name: 'Amsterdam', lon: 4.9041, lat: 52.3676 },
  { name: 'Zürich', lon: 8.5417, lat: 47.3769, alt: ['Zurich'] },
  // France
  { name: 'Orléans', lon: 1.9093, lat: 47.9029, alt: ['Orleans'] },
  { name: 'Tours', lon: 0.6848, lat: 47.3941 },
  { name: 'Nantes', lon: -1.5536, lat: 47.2184 },
  { name: 'Paris', lon: 2.3522, lat: 48.8566 },
  { name: 'Lyon', lon: 4.8357, lat: 45.764 },
  { name: 'Marseille', lon: 5.3698, lat: 43.2965 },
  { name: 'Toulouse', lon: 1.4442, lat: 43.6047 },
  { name: 'Bordeaux', lon: -0.5792, lat: 44.8378 },
  { name: 'Lille', lon: 3.0573, lat: 50.6292 },
  { name: 'Nice', lon: 7.262, lat: 43.7102 },
  // United Kingdom (Thames extent)
  { name: 'Oxford', lon: -1.2577, lat: 51.752 },
  { name: 'Reading', lon: -0.9781, lat: 51.4543 },
  { name: 'London', lon: -0.1276, lat: 51.5072 },
  { name: 'Brighton', lon: -0.1372, lat: 50.8225 },
  { name: 'Cambridge', lon: 0.1218, lat: 52.2053 },
  { name: 'Bristol', lon: -2.5879, lat: 51.4545 },
  // Italia
  { name: 'Torino', lon: 7.6869, lat: 45.0703, alt: ['Turin'] },
  { name: 'Piacenza', lon: 9.6929, lat: 45.0526 },
  { name: 'Ferrara', lon: 11.6198, lat: 44.8381 },
  { name: 'Milano', lon: 9.19, lat: 45.4642, alt: ['Milan'] },
  { name: 'Roma', lon: 12.4964, lat: 41.9028, alt: ['Rome'] },
  { name: 'Napoli', lon: 14.2681, lat: 40.8518, alt: ['Naples'] },
  { name: 'Bologna', lon: 11.3426, lat: 44.4949 },
  { name: 'Firenze', lon: 11.2558, lat: 43.7696, alt: ['Florence'] },
  { name: 'Venezia', lon: 12.3155, lat: 45.4408, alt: ['Venice'] },
  // Česko
  { name: 'České Budějovice', lon: 14.4747, lat: 48.9747, alt: ['Ceske Budejovice'] },
  { name: 'Praha', lon: 14.4378, lat: 50.0755, alt: ['Prague'] },
  { name: 'Brno', lon: 16.6068, lat: 49.1951 },
  { name: 'Ostrava', lon: 18.2625, lat: 49.8209 },
  { name: 'Plzeň', lon: 13.3776, lat: 49.7384, alt: ['Plzen', 'Pilsen'] },
  // USA
  { name: 'Minneapolis', lon: -93.265, lat: 44.9778 },
  { name: 'St. Louis', lon: -90.1994, lat: 38.627 },
  { name: 'Memphis', lon: -90.049, lat: 35.1495 },
  { name: 'New Orleans', lon: -90.0715, lat: 29.9511 },
  { name: 'New York', lon: -74.006, lat: 40.7128, alt: ['NYC', 'New York City'] },
  { name: 'San Francisco', lon: -122.4194, lat: 37.7749, alt: ['SF'] },
  { name: 'Seattle', lon: -122.3321, lat: 47.6062 },
  { name: 'Los Angeles', lon: -118.2437, lat: 34.0522, alt: ['LA'] },
  { name: 'Chicago', lon: -87.6298, lat: 41.8781 },
  { name: 'Austin', lon: -97.7431, lat: 30.2672 },
  { name: 'Boston', lon: -71.0589, lat: 42.3601 },
  { name: 'Denver', lon: -104.9903, lat: 39.7392 },
  // Egypt
  { name: 'Aswan', lon: 32.8998, lat: 24.0889 },
  { name: 'Luxor', lon: 32.6396, lat: 25.6872 },
  { name: 'Cairo', lon: 31.2357, lat: 30.0444 },
  { name: 'Alexandria', lon: 29.9187, lat: 31.2001 },
];
