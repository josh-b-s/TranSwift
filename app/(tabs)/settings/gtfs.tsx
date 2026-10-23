import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Bus, CircleCheck, CirclePlus, CircleX, Globe, Pencil, Trash2 } from 'lucide-react-native';
import { useThemeStyle } from '@/constants/themes';
import ImportProgressCard from '@/components/ImportProgressCard';
import { createProgressTracker, type ImportProgress } from '@/services/gtfs/import/importProgress';
import { pickGtfsZip, importZipAsNewDatabase } from '@/services/gtfs/import/gtfsDbImport';
import {
    deleteDatabase,
    DuplicateFeedError,
    DuplicateNameError,
    getActiveDatabaseId,
    listDatabases,
    renameDatabase,
    setActiveDatabase,
    type GtfsDatabaseEntry,
} from '@/services/gtfs/import/gtfsDbRegistry';

type ImportState = { busy: false } | { busy: true; fileName: string; progress: ImportProgress };

/**
 * GTFS feed management: a list of imported databases (one per zip the user
 * has added) with the active one checked, plus an "Add zip" action that
 * picks a file, imports it via the native Rust importer, and adds it to the
 * list. Only one database can be active/selected at a time for now.
 *
 * Each row can also be renamed (pencil, inline text field) or deleted
 * (trash, with confirmation). Import-time name collisions are silently
 * disambiguated file-system style ("Melbourne", "Melbourne (1)", ...) by
 * gtfsDbRegistry.ts's registerDatabase(). Renaming, in contrast, rejects
 * an exact collision outright (see handleSaveRename below) so the user
 * gets a chance to pick a different name rather than have one picked for
 * them mid-edit.
 */
export default function GtfsData() {
    const theme = useThemeStyle();
    const router = useRouter();
    const [databases, setDatabases] = useState<GtfsDatabaseEntry[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [importState, setImportState] = useState<ImportState>({ busy: false });
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState('');

    // Inline rename state: editingId names which row currently shows a
    // TextInput instead of static text, mirroring preferences.tsx's
    // walking-speed edit pattern.
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState('');

    const refresh = useCallback(async () => {
        const [dbs, active] = await Promise.all([listDatabases(), getActiveDatabaseId()]);
        setDatabases(dbs);
        setActiveId(active);
        setLoaded(true);
    }, []);

    // Focus rather than mount, so a feed imported from Browse Feeds shows up on return.
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh]),
    );

    async function handleAddZip() {
        setError('');
        try {
            const zip = await pickGtfsZip();
            if (!zip) return; // user cancelled the picker, not an error

            const fileName = zip.name ?? 'GTFS zip';
            setImportState({
                busy: true,
                fileName,
                progress: { fraction: 0, label: 'Checking file', etaSeconds: null },
            });
            const track = createProgressTracker();
            await importZipAsNewDatabase(zip, (p) => {
                setImportState({ busy: true, fileName, progress: track(p) });
            });
            await refresh();
        } catch (err) {
            if (err instanceof DuplicateFeedError) {
                const existing = err.existing;
                Alert.alert('Already imported', err.message, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Select it',
                        onPress: async () => {
                            setSwitchingId(existing.id);
                            try {
                                await setActiveDatabase(existing.id);
                                setActiveId(existing.id);
                            } catch (selectErr) {
                                setError(`Couldn't switch database: ${String(selectErr)}`);
                            } finally {
                                setSwitchingId(null);
                            }
                        },
                    },
                ]);
            } else {
                setError(`Import failed: ${String(err)}`);
            }
        } finally {
            setImportState({ busy: false });
        }
    }

    async function handleSelect(id: string) {
        if (id === activeId) return;
        setError('');
        setSwitchingId(id);
        try {
            await setActiveDatabase(id);
            setActiveId(id);
        } catch (err) {
            setError(`Couldn't switch database: ${String(err)}`);
        } finally {
            setSwitchingId(null);
        }
    }

    function startRename(db: GtfsDatabaseEntry) {
        setError('');
        setEditingId(db.id);
        setDraftName(db.name);
    }

    function cancelRename() {
        setEditingId(null);
    }

    async function handleSaveRename() {
        if (!editingId) return;
        const trimmed = draftName.trim();
        if (!trimmed) {
            Alert.alert('Name required', 'Give the feed a name.');
            return;
        }
        try {
            await renameDatabase(editingId, trimmed);
            setEditingId(null);
            await refresh();
        } catch (err) {
            if (err instanceof DuplicateNameError) {
                Alert.alert('Name already exists', err.message);
            } else {
                Alert.alert('Rename failed', String(err));
            }
        }
    }

    function handleDelete(db: GtfsDatabaseEntry) {
        Alert.alert(
            'Delete feed?',
            db.id === activeId
                ? `"${db.name}" is currently selected. Deleting it will switch to another imported feed, if any.`
                : `This removes "${db.name}" and its imported data. This can't be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setError('');
                        setDeletingId(db.id);
                        try {
                            await deleteDatabase(db.id);
                            await refresh();
                        } catch (err) {
                            setError(`Delete failed: ${String(err)}`);
                        } finally {
                            setDeletingId(null);
                        }
                    },
                },
            ],
        );
    }

    const busy = importState.busy || switchingId !== null || deletingId !== null;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.surfaceColor }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={{ color: theme.color, opacity: 0.5, fontSize: 13 }}>
                Each imported feed becomes its own database. Pick which one the app should route against.
            </Text>

            {loaded && databases.length === 0 && !importState.busy && (
                <Text style={{ color: theme.color, opacity: 0.5, fontSize: 13, fontStyle: 'italic' }}>
                    No feeds imported yet. Add one below.
                </Text>
            )}

            {databases.map((db) => {
                const isActive = db.id === activeId;
                const isSwitching = switchingId === db.id;
                const isDeleting = deletingId === db.id;
                const isEditing = editingId === db.id;
                const rowBusy = busy && !isSwitching && !isDeleting;

                return (
                    <View
                        key={db.id}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 14,
                            padding: 16,
                            borderRadius: 16,
                            backgroundColor: theme.backgroundColor,
                            opacity: rowBusy ? 0.5 : 1,
                            borderWidth: isActive ? 2 : 0,
                            borderColor: '#2563eb',
                        }}
                    >
                        <Pressable
                            onPress={() => handleSelect(db.id)}
                            disabled={busy || isEditing}
                            style={{
                                width: 40, height: 40, borderRadius: 12,
                                backgroundColor: '#2563eb22',
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            {isSwitching || isDeleting ? (
                                <ActivityIndicator size="small" color="#2563eb" />
                            ) : (
                                <Bus size={20} color="#2563eb" />
                            )}
                        </Pressable>

                        {isEditing ? (
                            <>
                                <TextInput
                                    value={draftName}
                                    onChangeText={setDraftName}
                                    autoFocus
                                    placeholder="Feed name"
                                    placeholderTextColor={theme.color + '66'}
                                    style={{
                                        flex: 1, color: theme.color, fontSize: 16, fontWeight: '600',
                                        borderBottomWidth: 1, borderBottomColor: theme.color + '33', paddingVertical: 2,
                                    }}
                                />
                                <Pressable onPress={handleSaveRename} hitSlop={8} style={{ padding: 4 }}>
                                    <CircleCheck size={24} color="#22c55e" />
                                </Pressable>
                                <Pressable onPress={cancelRename} hitSlop={8} style={{ padding: 4 }}>
                                    <CircleX size={24} color={theme.color} style={{ opacity: 0.4 }} />
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <Pressable
                                    onPress={() => handleSelect(db.id)}
                                    disabled={busy}
                                    style={{ flex: 1 }}
                                >
                                    <Text style={{ color: theme.color, fontSize: 16, fontWeight: '600' }}>{db.name}</Text>
                                    <Text style={{ color: theme.color, opacity: 0.5, fontSize: 13, marginTop: 2 }}>
                                        Imported {new Date(db.importedAt).toLocaleDateString()}
                                    </Text>
                                </Pressable>
                                {isActive && <CircleCheck size={20} color="#2563eb" />}
                                <Pressable
                                    onPress={() => startRename(db)}
                                    disabled={busy}
                                    hitSlop={8}
                                    style={{ padding: 4 }}
                                >
                                    <Pencil size={18} color={theme.color} style={{ opacity: 0.6 }} />
                                </Pressable>
                                <Pressable
                                    onPress={() => handleDelete(db)}
                                    disabled={busy}
                                    hitSlop={8}
                                    style={{ padding: 4 }}
                                >
                                    <Trash2 size={18} color="#ef4444" />
                                </Pressable>
                            </>
                        )}
                    </View>
                );
            })}

            <Pressable
                disabled={busy}
                onPress={() => router.push('/settings/browse-feeds')}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: theme.backgroundColor,
                    opacity: busy ? 0.5 : 1,
                }}
            >
                <Globe size={20} color={theme.color} />
                <Text style={{ color: theme.color, fontSize: 15, fontWeight: '600' }}>Browse feeds</Text>
            </Pressable>

            <Pressable
                disabled={busy}
                onPress={handleAddZip}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: theme.color + '55',
                    opacity: busy ? 0.5 : 1,
                }}
            >
                <CirclePlus size={20} color={theme.color} />
                <Text style={{ color: theme.color, fontSize: 15, fontWeight: '600' }}>Add zip</Text>
            </Pressable>

            {importState.busy && (
                <ImportProgressCard fileName={importState.fileName} progress={importState.progress} />
            )}

            {!!error && (
                <View style={{ padding: 12, borderRadius: 12, backgroundColor: theme.backgroundColor }}>
                    <Text style={{ color: '#ef4444', fontSize: 12 }}>{error}</Text>
                </View>
            )}
        </ScrollView>
    );
}
