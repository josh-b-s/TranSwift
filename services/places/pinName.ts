/** The parts of a reverse geocode result that matter here. expo-location's LocationGeocodedAddress fits. */
export type GeocodedAddress = {
    name: string | null;
    streetNumber: string | null;
    street: string | null;
    district: string | null;
    city: string | null;
    region: string | null;
};

export type PinName = { name: string; address: string };

// Android reports the street number as the feature name for a plain address ("42", "42-44", "42a").
const looksLikeStreetNumber = (s: string) => /^\d[\w\-/ ]*$/.test(s);

/**
 * A name and address for a dropped pin: a landmark if the spot has one, else the street address, else the suburb.
 * Null when the geocoder gave nothing to name it by.
 */
export function pinNameFrom(a: GeocodedAddress): PinName | null {
    const streetLine = [a.streetNumber, a.street].filter(Boolean).join(' ');
    const landmark = a.name && a.name !== a.street && !looksLikeStreetNumber(a.name) ? a.name : '';
    const name = landmark || streetLine || a.district || a.city;
    if (!name) return null;

    const seen = new Set([name.toLowerCase()]);
    const address = [streetLine, a.district, a.city, a.region]
        .filter((part): part is string => !!part && !seen.has(part.toLowerCase()) && !!seen.add(part.toLowerCase()))
        .join(', ');
    return { name, address };
}
