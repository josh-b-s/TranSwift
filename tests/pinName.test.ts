import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pinNameFrom, type GeocodedAddress } from '@/services/places/pinName';

const geocoded = (over: Partial<GeocodedAddress>): GeocodedAddress => ({
    name: null, streetNumber: null, street: null, district: null, city: null, region: null, ...over,
});

test('a plain address is named by its street line, with the suburb as the address', () => {
    const got = pinNameFrom(geocoded({
        name: '42', streetNumber: '42', street: 'Smith Street', district: 'Fitzroy', city: 'Melbourne', region: 'Victoria',
    }));
    assert.deepEqual(got, { name: '42 Smith Street', address: 'Fitzroy, Melbourne, Victoria' });
});

test('a landmark is the name and the street moves to the address', () => {
    const got = pinNameFrom(geocoded({
        name: 'Federation Square', street: 'Flinders Street', city: 'Melbourne', region: 'Victoria',
    }));
    assert.deepEqual(got, { name: 'Federation Square', address: 'Flinders Street, Melbourne, Victoria' });
});

test('with no street the suburb names the pin and is not repeated in the address', () => {
    const got = pinNameFrom(geocoded({ district: 'Fitzroy', city: 'Melbourne', region: 'Victoria' }));
    assert.deepEqual(got, { name: 'Fitzroy', address: 'Melbourne, Victoria' });
});

test('a street-only result keeps the street name', () => {
    const got = pinNameFrom(geocoded({ name: 'Smith Street', street: 'Smith Street', city: 'Melbourne' }));
    assert.deepEqual(got, { name: 'Smith Street', address: 'Melbourne' });
});

test('nothing to go on gives null', () => {
    assert.equal(pinNameFrom(geocoded({ region: 'Victoria' })), null);
});
