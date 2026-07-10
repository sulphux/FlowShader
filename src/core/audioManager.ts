/**
 * Globalny menedżer audio dla noda audio_input.
 *
 * Jedno źródło dźwięku na aplikację (ostatnio wgrany plik wygrywa).
 * AnalyserNode dostarcza FFT, z którego liczymy poziomy pasm (0..1):
 * level (całość), bass (<250 Hz), mid (250 Hz–4 kHz), high (>4 kHz).
 * Okna renderujące odpytują getAudioLevels() co klatkę.
 */

export interface AudioLevels {
  level: number;
  bass: number;
  mid: number;
  high: number;
}

const ZERO_LEVELS: AudioLevels = { level: 0, bass: 0, mid: 0, high: 0 };

interface AudioState {
  context: AudioContext;
  analyser: AnalyserNode;
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  buffer: AudioBuffer | null;
  data: Uint8Array<ArrayBuffer>;
  playing: boolean;
  fileName: string | null;
}

let state: AudioState | null = null;

const ensureContext = (): AudioState => {
  if (state) return state;
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;
  const gain = context.createGain();
  gain.connect(analyser);
  analyser.connect(context.destination);
  state = {
    context, analyser, gain,
    source: null, buffer: null,
    data: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)),
    playing: false,
    fileName: null,
  };
  return state;
};

/** Wczytuje plik audio (ArrayBuffer). Zatrzymuje poprzednie odtwarzanie. */
export async function loadAudioFile(arrayBuffer: ArrayBuffer, fileName: string): Promise<void> {
  const s = ensureContext();
  stopAudio();
  s.buffer = await s.context.decodeAudioData(arrayBuffer);
  s.fileName = fileName;
}

/** Startuje odtwarzanie w pętli (wymaga gestu użytkownika — polityka autoplay). */
export function playAudio(): boolean {
  const s = ensureContext();
  if (!s.buffer) return false;
  stopAudio();
  if (s.context.state === 'suspended') void s.context.resume();
  const source = s.context.createBufferSource();
  source.buffer = s.buffer;
  source.loop = true;
  source.connect(s.gain);
  source.start();
  s.source = source;
  s.playing = true;
  return true;
}

export function stopAudio(): void {
  if (!state?.source) {
    if (state) state.playing = false;
    return;
  }
  try { state.source.stop(); } catch { /* already stopped */ }
  state.source.disconnect();
  state.source = null;
  state.playing = false;
}

export function isAudioPlaying(): boolean {
  return Boolean(state?.playing);
}

export function getAudioFileName(): string | null {
  return state?.fileName ?? null;
}

/** Średnia znormalizowana (0..1) z zakresu binów FFT. */
const bandAverage = (data: Uint8Array, from: number, to: number): number => {
  const start = Math.max(0, Math.floor(from));
  const end = Math.min(data.length, Math.ceil(to));
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += data[i];
  return sum / ((end - start) * 255);
};

/** Bieżące poziomy audio (0..1). Bez odtwarzania zwraca zera. */
export function getAudioLevels(): AudioLevels {
  if (!state || !state.playing) return ZERO_LEVELS;
  const { analyser, data, context } = state;
  analyser.getByteFrequencyData(data);

  // Szerokość jednego binu FFT w Hz
  const binHz = context.sampleRate / analyser.fftSize;
  const bass = bandAverage(data, 0, 250 / binHz);
  const mid = bandAverage(data, 250 / binHz, 4000 / binHz);
  const high = bandAverage(data, 4000 / binHz, data.length);
  const level = bandAverage(data, 0, data.length);

  return { level, bass, mid, high };
}

/** Reset do testów. */
export function __resetAudioForTests(): void {
  stopAudio();
  if (state) void state.context.close().catch(() => {});
  state = null;
}
