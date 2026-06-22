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

// ---- City structure of a destination country -------------------------------
// The business model: India (the source) ships to ONE delivery hub per country —
// the subsidiary's DC (e.g. Frankfurt for Germany) = PRIMARY. From that hub the
// subsidiary distributes to the OTHER major cities of the SAME country =
// SECONDARY. So secondary movement is intra-country, hub → other cities.
// This is reference geography (cities the map can place), not business data;
// it does not invent demand — it only positions the cities a country may use.

export type GeoCity = { city: string; lon: number; lat: number };

export const COUNTRY_CITIES: Record<string, { hub: GeoCity; others: GeoCity[] }> = {
  germany: { hub: { city: "Frankfurt", lon: 8.6821, lat: 50.1109 }, others: [{ city: "Berlin", lon: 13.405, lat: 52.52 }, { city: "Munich", lon: 11.582, lat: 48.1351 }, { city: "Hamburg", lon: 9.9937, lat: 53.5511 }] },
  "united arab emirates": { hub: { city: "Dubai", lon: 55.2708, lat: 25.2048 }, others: [{ city: "Abu Dhabi", lon: 54.3773, lat: 24.4539 }, { city: "Sharjah", lon: 55.4033, lat: 25.3463 }] },
  italy: { hub: { city: "Milan", lon: 9.19, lat: 45.4642 }, others: [{ city: "Rome", lon: 12.4964, lat: 41.9028 }, { city: "Turin", lon: 7.6869, lat: 45.0703 }, { city: "Naples", lon: 14.2681, lat: 40.8518 }] },
  "united states of america": { hub: { city: "New York", lon: -74.006, lat: 40.7128 }, others: [{ city: "Chicago", lon: -87.6298, lat: 41.8781 }, { city: "Los Angeles", lon: -118.2437, lat: 34.0522 }, { city: "Houston", lon: -95.3698, lat: 29.7604 }] },
  brazil: { hub: { city: "São Paulo", lon: -46.6333, lat: -23.5505 }, others: [{ city: "Rio de Janeiro", lon: -43.1729, lat: -22.9068 }, { city: "Brasília", lon: -47.9292, lat: -15.7801 }, { city: "Belo Horizonte", lon: -43.9378, lat: -19.9208 }] },
  france: { hub: { city: "Paris", lon: 2.3522, lat: 48.8566 }, others: [{ city: "Lyon", lon: 4.8357, lat: 45.764 }, { city: "Marseille", lon: 5.3698, lat: 43.2965 }, { city: "Lille", lon: 3.0573, lat: 50.6292 }] },
  "saudi arabia": { hub: { city: "Riyadh", lon: 46.6753, lat: 24.7136 }, others: [{ city: "Jeddah", lon: 39.1925, lat: 21.4858 }, { city: "Dammam", lon: 50.1033, lat: 26.4207 }] },
  japan: { hub: { city: "Tokyo", lon: 139.6917, lat: 35.6895 }, others: [{ city: "Osaka", lon: 135.5023, lat: 34.6937 }, { city: "Nagoya", lon: 136.9066, lat: 35.1815 }, { city: "Fukuoka", lon: 130.4017, lat: 33.5904 }] },
  turkey: { hub: { city: "Istanbul", lon: 28.9784, lat: 41.0082 }, others: [{ city: "Ankara", lon: 32.8597, lat: 39.9334 }, { city: "Izmir", lon: 27.1428, lat: 38.4237 }] },
  "united kingdom": { hub: { city: "London", lon: -0.1276, lat: 51.5072 }, others: [{ city: "Manchester", lon: -2.2426, lat: 53.4808 }, { city: "Birmingham", lon: -1.8904, lat: 52.4862 }, { city: "Glasgow", lon: -4.2518, lat: 55.8642 }] },
  poland: { hub: { city: "Warsaw", lon: 21.0122, lat: 52.2297 }, others: [{ city: "Kraków", lon: 19.945, lat: 50.0647 }, { city: "Wrocław", lon: 17.0385, lat: 51.1079 }] },
  spain: { hub: { city: "Madrid", lon: -3.7038, lat: 40.4168 }, others: [{ city: "Barcelona", lon: 2.1734, lat: 41.3851 }, { city: "Valencia", lon: -0.3763, lat: 39.4699 }, { city: "Seville", lon: -5.9845, lat: 37.3891 }] },
  mexico: { hub: { city: "Mexico City", lon: -99.1332, lat: 19.4326 }, others: [{ city: "Guadalajara", lon: -103.3496, lat: 20.6597 }, { city: "Monterrey", lon: -100.3161, lat: 25.6866 }] },
  australia: { hub: { city: "Sydney", lon: 151.2093, lat: -33.8688 }, others: [{ city: "Melbourne", lon: 144.9631, lat: -37.8136 }, { city: "Brisbane", lon: 153.0251, lat: -27.4698 }, { city: "Perth", lon: 115.8605, lat: -31.9505 }] },
  egypt: { hub: { city: "Cairo", lon: 31.2357, lat: 30.0444 }, others: [{ city: "Alexandria", lon: 29.9187, lat: 31.2001 }, { city: "Giza", lon: 31.2109, lat: 30.0131 }] },
  indonesia: { hub: { city: "Jakarta", lon: 106.8451, lat: -6.2088 }, others: [{ city: "Surabaya", lon: 112.7521, lat: -7.2575 }, { city: "Bandung", lon: 107.6191, lat: -6.9175 }] },
  canada: { hub: { city: "Toronto", lon: -79.3832, lat: 43.6532 }, others: [{ city: "Montreal", lon: -73.5673, lat: 45.5017 }, { city: "Vancouver", lon: -123.1207, lat: 49.2827 }, { city: "Calgary", lon: -114.0719, lat: 51.0447 }] },
  netherlands: { hub: { city: "Amsterdam", lon: 4.9041, lat: 52.3676 }, others: [{ city: "Rotterdam", lon: 4.4777, lat: 51.9244 }, { city: "The Hague", lon: 4.3007, lat: 52.0705 }] },
  "south africa": { hub: { city: "Johannesburg", lon: 28.0473, lat: -26.2041 }, others: [{ city: "Cape Town", lon: 18.4241, lat: -33.9249 }, { city: "Durban", lon: 31.0218, lat: -29.8587 }] },
  china: { hub: { city: "Shanghai", lon: 121.4737, lat: 31.2304 }, others: [{ city: "Beijing", lon: 116.4074, lat: 39.9042 }, { city: "Guangzhou", lon: 113.2644, lat: 23.1291 }, { city: "Shenzhen", lon: 114.0579, lat: 22.5431 }] },
  "south korea": { hub: { city: "Seoul", lon: 126.978, lat: 37.5665 }, others: [{ city: "Busan", lon: 129.0756, lat: 35.1796 }, { city: "Incheon", lon: 126.7052, lat: 37.4563 }] },
  singapore: { hub: { city: "Singapore", lon: 103.8198, lat: 1.3521 }, others: [] },
  argentina: { hub: { city: "Buenos Aires", lon: -58.3816, lat: -34.6037 }, others: [{ city: "Córdoba", lon: -64.1888, lat: -31.4201 }, { city: "Rosario", lon: -60.6393, lat: -32.9442 }] },
  nigeria: { hub: { city: "Lagos", lon: 3.3792, lat: 6.5244 }, others: [{ city: "Abuja", lon: 7.4951, lat: 9.0579 }, { city: "Kano", lon: 8.5919, lat: 12.0022 }] },
  kenya: { hub: { city: "Nairobi", lon: 36.8219, lat: -1.2921 }, others: [{ city: "Mombasa", lon: 39.6682, lat: -4.0435 }] },
};

/** The hub + other major cities for a destination country (case-insensitive),
 *  or null when we have no city geography for it (then it isn't pinned). */
export function citiesForCountry(country: string): { hub: GeoCity; others: GeoCity[] } | null {
  if (!country) return null;
  return COUNTRY_CITIES[country.trim().toLowerCase()] ?? null;
}
