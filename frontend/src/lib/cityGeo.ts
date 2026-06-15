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
};

export function cityCoords(city: string): [number, number] | null {
  if (!city) return null;
  return CITY_COORDS[city.trim().toLowerCase()] ?? null;
}

// Pull a city name out of a warehouse-style label, e.g. "Mumbai WH" → "Mumbai".
export function cityFromLabel(label: string): string {
  return label.replace(/\b(wh|warehouse|dc|hub|depot|store|plant)\b/gi, "").replace(/[-_]/g, " ").trim();
}
