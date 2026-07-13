/** Shared page-lifetime clock used by shaders and time-aware node UI. */
export const getRuntimeTimeSeconds = (): number => performance.now() * 0.001;
