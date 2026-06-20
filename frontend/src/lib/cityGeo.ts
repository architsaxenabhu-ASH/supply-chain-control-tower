// Geographic reference: city → [longitude, latitude]. Like the country atlas,
// this is reference geography (not business data) used only to place on the map
// the cities the application has actually seen in real records. Add entries as
// new cities appear; an unknown city simply isn't pinned (never invented).

export const CITY_COORDS: Record<string, [number, number]> = {
  // India
  mumbai: [72.8777, 19.076],
  delhi: [77.209, 28.6139],
  "new delhi": [77.209, 28.6139],
  bengaluru: [77.5946, 12.9716],
  bangalore: [77.5946, 12.9716],
  chennai: [80.2707, 13.0827],
  kolkata: [88.3639, 22.5726],
  hyderabad: [78.4867, 17.385],
  ahmedabad: [72.5714, 23.0225],
  pune: [73.8567, 18.5204],
  vapi: [72.9043, 20.3893],
  // UAE
  dubai: [55.2708, 25.2048],
  "abu dhabi": [54.3773, 24.4539],
  sharjah: [55.4033, 25.3463],
  // Germany
  berlin: [13.405, 52.52],
  munich: [11.582, 48.1351],
  "münchen": [11.582, 48.1351],
  hamburg: [9.9937, 53.5511],
  frankfurt: [8.6821, 50.1109],
  // Italy
  milan: [9.19, 45.4642],
  milano: [9.19, 45.4642],
  rome: [12.4964, 41.9028],
  roma: [12.4964, 41.9028],
  turin: [7.6869, 45.0703],
  torino: [7.6869, 45.0703],
  // other common hubs
  london: [-0.1276, 51.5072],
  paris: [2.3522, 48.8566],
  "new york": [-74.006, 40.7128],
  singapore: [103.8198, 1.3521],
  dhaka: [90.4125, 23.8103],
  "são paulo": [-46.6333, -23.5505],
  "sao paulo": [-46.6333, -23.5505],
  riyadh: [46.6753, 24.7136],
  tokyo: [139.6917, 35.6895],
  istanbul: [28.9784, 41.0082],
  warsaw: [21.0122, 52.2297],
  johannesburg: [28.0473, -26.2041],
  // expansion markets (enter on demo inject)
  madrid: [-3.7038, 40.4168],
  "mexico city": [-99.1332, 19.4326],
  sydney: [151.2093, -33.8688],
  cairo: [31.2357, 30.0444],
  jakarta: [106.8451, -6.2088],
  toronto: [-79.3832, 43.6532],
};

export function cityCoords(city: string): [number, number] | null {
  if (!city) return null;
  return CITY_COORDS[city.trim().toLowerCase()] ?? null;
}

// Pull a city name out of a warehouse-style label, e.g. "Mumbai WH" → "Mumbai".
export function cityFromLabel(label: string): string {
  return label.replace(/\b(wh|warehouse|dc|hub|depot|store|plant)\b/gi, "").replace(/[-_]/g, " ").trim();
}
