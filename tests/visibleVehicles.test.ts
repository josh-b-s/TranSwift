import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleVehicles } from '@/services/gtfs/vehicles/visibleVehicles';
import type { MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';

const vehicle = (tripId: string | null): MapVehicle => ({ tripId } as MapVehicle);
const vehicles = [vehicle('a1'), vehicle('a2'), vehicle('b1'), vehicle(null)];
const lineKeys = new Map([['a1', '1|86|Bundoora'], ['a2', '1|86|Bundoora'], ['b1', '1|86|City']]);

test('zoomed in with no line shown, every vehicle is drawn', () => {
    assert.equal(visibleVehicles(vehicles, true, null).length, 4);
});

test('zoomed out with no line shown, none are drawn', () => {
    assert.equal(visibleVehicles(vehicles, false, null).length, 0);
});

test('a shown line keeps only its own route and terminus, zoomed in too', () => {
    const drawn = visibleVehicles(vehicles, true, { tripId: 'a1', lineKeys });
    assert.deepEqual(drawn.map(v => v.tripId), ['a1', 'a2']);
});

test('the focused trip stays when its line is not known yet', () => {
    const drawn = visibleVehicles(vehicles, true, { tripId: 'b1', lineKeys: new Map() });
    assert.deepEqual(drawn.map(v => v.tripId), ['b1']);
});
