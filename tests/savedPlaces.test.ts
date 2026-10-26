import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addRecent, buildSuggestions, matchPlaces, MAX_RECENTS, mergeResults, refreshFromResults, renameSaved, toggleSaved } from '@/services/places/savedPlaces';
import type { SearchPlace } from '@/services/places/places';

const place = (id: string, name = id): SearchPlace => ({ place_id: id, name, address: `${name} St`, latitude: -37.8, longitude: 144.9 });

test('toggleSaved saves with the place name as label, then removes it', () => {
    const once = toggleSaved([], place('a', 'Cafe'));
    assert.equal(once.length, 1);
    assert.equal(once[0].label, 'Cafe');
    assert.deepEqual(toggleSaved(once, place('a')), []);
});

test('renameSaved changes the label and ignores a blank one', () => {
    const saved = toggleSaved([], place('a', 'Cafe'));
    assert.equal(renameSaved(saved, 'a', '  Home ')[0].label, 'Home');
    assert.equal(renameSaved(saved, 'a', '   ')[0].label, 'Cafe');
});

test('addRecent puts the newest first, drops duplicates and caps the list', () => {
    let recents: SearchPlace[] = [];
    for (let i = 0; i < MAX_RECENTS + 3; i++) recents = addRecent(recents, [], place(`p${i}`));
    assert.equal(recents.length, MAX_RECENTS);
    assert.equal(recents[0].place_id, `p${MAX_RECENTS + 2}`);
    recents = addRecent(recents, [], place(`p${MAX_RECENTS + 1}`));
    assert.equal(recents[0].place_id, `p${MAX_RECENTS + 1}`);
    assert.equal(recents.filter(p => p.place_id === `p${MAX_RECENTS + 1}`).length, 1);
});

test('addRecent skips places that are already saved', () => {
    const saved = toggleSaved([], place('a'));
    assert.deepEqual(addRecent([], saved, place('a')), []);
});

test('buildSuggestions lists saved places by label, then recents, without repeats or the excluded place', () => {
    const saved = renameSaved(toggleSaved([], place('a', 'Cafe')), 'a', 'Work');
    const recents = [place('a', 'Cafe'), place('b'), place('c')];
    const names = buildSuggestions(saved, recents, 'c').map(p => p.name);
    assert.deepEqual(names, ['Work', 'b']);
});

test('matchPlaces finds saved places by label and recents by address, saved first', () => {
    const saved = renameSaved(toggleSaved([], place('a', 'Cafe')), 'a', 'Home');
    const recents = [place('b', 'Library'), place('c', 'Park')];
    assert.deepEqual(matchPlaces(saved, recents, 'hom').map(p => p.name), ['Home']);
    assert.deepEqual(matchPlaces(saved, recents, 'st').map(p => p.name), ['Home', 'Library', 'Park']);
    assert.deepEqual(matchPlaces(saved, recents, '  '), []);
});

test('mergeResults keeps local entries and drops API duplicates', () => {
    const merged = mergeResults([place('a'), place('b')], [place('b', 'Other'), place('c')]);
    assert.deepEqual(merged.map(p => p.place_id), ['a', 'b', 'c']);
    assert.equal(merged[1].name, 'b');
});

test('refreshFromResults updates coordinates and names but keeps saved labels', () => {
    const saved = renameSaved(toggleSaved([], place('a', 'Cafe')), 'a', 'Home');
    const fresh = { ...place('a', 'Cafe Renamed'), latitude: -37.9, longitude: 145 };
    const next = refreshFromResults(saved, [fresh]);
    assert.equal(next[0].label, 'Home');
    assert.equal(next[0].name, 'Cafe Renamed');
    assert.equal(next[0].latitude, -37.9);
});

test('refreshFromResults returns the same array when nothing changed', () => {
    const saved = toggleSaved([], place('a'));
    assert.equal(refreshFromResults(saved, [place('a'), place('z')]), saved);
});
