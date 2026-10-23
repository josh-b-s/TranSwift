export type Coverage = {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
};

export type Point = { latitude: number; longitude: number };

export function coverageContains(c: Coverage, p: Point): boolean {
    return p.latitude >= c.minLat && p.latitude <= c.maxLat && p.longitude >= c.minLon && p.longitude <= c.maxLon;
}

export function coverageArea(c: Coverage): number {
    return (c.maxLat - c.minLat) * (c.maxLon - c.minLon);
}
