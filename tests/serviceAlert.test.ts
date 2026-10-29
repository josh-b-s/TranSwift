import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    alertsForRoutes,
    alertsForStop,
    isActiveAt,
    resolveAlert,
    type ServiceAlert,
} from '@/services/gtfs/alerts/serviceAlert';

const alert = (over: Partial<ServiceAlert> = {}): ServiceAlert => ({
    id: 'a',
    header: 'Diversion',
    description: null,
    periods: [],
    targets: [],
    ...over,
});
const target = (t: Partial<ServiceAlert['targets'][number]>) => ({ routeId: null, stopId: null, tripId: null, ...t });
const keys = new Map([['R1', '96|0'], ['R2', '19|0']]);

test('an alert with no periods is always active', () => {
    assert.equal(isActiveAt(alert(), 1000), true);
});

test('periods can be open at either end, and the end is exclusive', () => {
    const a = alert({ periods: [{ startSec: 100, endSec: 200 }] });
    assert.deepEqual([99, 100, 199, 200].map(t => isActiveAt(a, t)), [false, true, true, false]);
    assert.equal(isActiveAt(alert({ periods: [{ startSec: 100, endSec: null }] }), 5000), true);
    assert.equal(isActiveAt(alert({ periods: [{ startSec: null, endSec: 100 }] }), 50), true);
});

test('any one matching period is enough', () => {
    const a = alert({ periods: [{ startSec: 0, endSec: 10 }, { startSec: 100, endSec: 200 }] });
    assert.equal(isActiveAt(a, 150), true);
    assert.equal(isActiveAt(a, 50), false);
});

test('route and stop selectors become route keys and stop ids', () => {
    const r = resolveAlert(alert({ targets: [target({ routeId: 'R1' }), target({ stopId: 'S1' })] }), keys)!;
    assert.deepEqual([...r.routeKeys], ['96|0']);
    assert.deepEqual([...r.stopIds], ['S1']);
});

test('a selector with both a stop and a route is a stop alert', () => {
    const r = resolveAlert(alert({ targets: [target({ routeId: 'R1', stopId: 'S1' })] }), keys)!;
    assert.equal(r.routeKeys.size, 0);
    assert.deepEqual([...r.stopIds], ['S1']);
});

test('drops alerts with no text or nothing to attach to', () => {
    assert.equal(resolveAlert(alert({ header: null, targets: [target({ stopId: 'S1' })] }), keys), null);
    assert.equal(resolveAlert(alert({ targets: [] }), keys), null);
    assert.equal(resolveAlert(alert({ targets: [target({ routeId: 'R1', tripId: 'T1' })] }), keys), null);
    assert.equal(resolveAlert(alert({ targets: [target({ routeId: 'unknown' })] }), keys), null);
});

test('stop lookups match the stop or a route serving it', () => {
    const byStop = resolveAlert(alert({ id: 'stop', targets: [target({ stopId: 'S1' })] }), keys)!;
    const byRoute = resolveAlert(alert({ id: 'route', targets: [target({ routeId: 'R2' })] }), keys)!;
    const other = resolveAlert(alert({ id: 'other', targets: [target({ stopId: 'S9' })] }), keys)!;
    const found = alertsForStop([byStop, byRoute, other], 'S1', ['19|0']);
    assert.deepEqual(found.map(a => a.id), ['stop', 'route']);
});

test('journey lookups match routes only', () => {
    const byStop = resolveAlert(alert({ id: 'stop', targets: [target({ stopId: 'S1' })] }), keys)!;
    const byRoute = resolveAlert(alert({ id: 'route', targets: [target({ routeId: 'R1' })] }), keys)!;
    assert.deepEqual(alertsForRoutes([byStop, byRoute], ['96|0', '5|3']).map(a => a.id), ['route']);
});
