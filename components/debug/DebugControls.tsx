import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { advanceStep, BFS_STEP_INTERVAL_MS, DebugPhase, retreatStep, setBfsCandidateMode, setPlaying, toggleDebugEnabled, toggleHopColorMode } from '@/store/debug.slice';
import { SHADOW, useThemeStyle } from '@/constants/themes';

// Two phases: corridor finding (bfs) and raptor (candidate-route checks).
const PHASE_LABELS: Record<DebugPhase, string> = {
    bfs:    'Finding corridor',
    raptor: 'RAPTOR',
};

// Step interval for 'raptor' reveals. They are discrete pops, not an animation, so a slower pace is easier to follow.
// 'bfs' uses BFS_STEP_INTERVAL_MS.
const STEP_INTERVAL_MS = 300;

/**
 * Debug-mode toggle and replay controls (prev/play/next), floated bottom-left. The transport row shows once debug is on
 * and a debug search has produced data. 'bfs' steps one round at a time; 'raptor' steps one candidate-route check at a time
 * (see DebugMapOverlay.tsx).
 * TODO: move the enabled toggle into settings and keep only the transport controls floating.
 */
export default function DebugControls() {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useThemeStyle();
    const { enabled, hasData, phase, stepIndex, playing, bfsCandidateMode, hopColorMode, bfsRoundCount, bfsCandidateCount, raptorStepCount: raptorStepTotal } = useSelector((s: RootState) => s.debug);

    // Total steps for the current phase: bfs + cumulative is rounds, bfs + single is candidates, raptor is route-checks across
    // all rounds. The flatten helpers in debugBfsPoints.ts are shared with debug.slice.ts and DebugMapOverlay.tsx, so all three
    // agree on what a step is.

    // Auto-advance timer. It lives here because reducers must stay synchronous. advanceStep clears `playing` at the last step,
    // which ends the interval.
    useEffect(() => {
        if (!playing) return;
        const intervalMs = phase === 'bfs' ? BFS_STEP_INTERVAL_MS : STEP_INTERVAL_MS;
        const id = setInterval(() => dispatch(advanceStep()), intervalMs);
        return () => clearInterval(id);
    }, [playing, dispatch, phase]);

    const stepLabel = phase === 'bfs'
        ? (bfsCandidateMode === 'single'
            ? `Candidate ${stepIndex + 1}/${Math.max(1, bfsCandidateCount)}`
            : `Round ${stepIndex + 1}/${Math.max(1, bfsRoundCount)}`)
        : `Route ${stepIndex + 1}/${Math.max(1, raptorStepTotal)}`;

    return (
        <View className="absolute bottom-5 left-5" style={{ gap: 8 }}>
            <TouchableOpacity
                className="w-16 h-16 rounded-full items-center justify-center"
                style={[{ backgroundColor: enabled ? '#2563eb' : theme.backgroundColor }, SHADOW]}
                onPress={() => dispatch(toggleDebugEnabled())}
            >
                <Ionicons name="bug" size={26} color={enabled ? '#fff' : theme.color} />
            </TouchableOpacity>

            {enabled && hasData && (
                <View
                    className="rounded-2xl px-3 py-2"
                    style={[{ backgroundColor: theme.backgroundColor }, SHADOW]}
                >
                    <Text style={{ color: theme.color, opacity: 0.6, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>
                        {PHASE_LABELS[phase]}
                    </Text>
                    <View className="flex-row items-center" style={{ gap: 4 }}>
                        <TouchableOpacity className="p-1.5" onPress={() => dispatch(retreatStep())}>
                            <Ionicons name="play-back" size={16} color={theme.color} />
                        </TouchableOpacity>
                        <TouchableOpacity className="p-1.5" onPress={() => dispatch(setPlaying(!playing))}>
                            <Ionicons name={playing ? 'pause' : 'play'} size={18} color={theme.color} />
                        </TouchableOpacity>
                        <TouchableOpacity className="p-1.5" onPress={() => dispatch(advanceStep())}>
                            <Ionicons name="play-forward" size={16} color={theme.color} />
                        </TouchableOpacity>
                        <Text style={{ color: theme.color, fontSize: 12, fontWeight: '600', minWidth: 70, textAlign: 'center' }}>
                            {stepLabel}
                        </Text>
                        {/* bfs only: show candidates all at once (cumulative, the default) or one at a time (single). */}
                        {phase === 'bfs' && (
                            <TouchableOpacity
                                className="p-1.5"
                                onPress={() => dispatch(setBfsCandidateMode(bfsCandidateMode === 'single' ? 'cumulative' : 'single'))}
                            >
                                <Ionicons
                                    name={bfsCandidateMode === 'single' ? 'layers-outline' : 'layers'}
                                    size={16}
                                    color={theme.color}
                                />
                            </TouchableOpacity>
                        )}
                        {/* Separate toggle: how a candidate is colored (per-hop palette vs flat depth color), not which are visible. See hopColorMode in debug.slice.ts. */}
                        {phase === 'bfs' && (
                            <TouchableOpacity
                                className="p-1.5"
                                onPress={() => dispatch(toggleHopColorMode())}
                            >
                                <Ionicons
                                    name={hopColorMode ? 'color-palette' : 'color-palette-outline'}
                                    size={16}
                                    color={theme.color}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}
