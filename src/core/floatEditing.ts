const FALLBACK_STEP = 0.01;

/** Accept both dot and Polish decimal comma while the editor is being used. */
export const parseEditableFloat = (value: unknown): number | null => {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const decimalPlaces = (value: number): number => {
  const text = Math.abs(value).toString().toLowerCase();
  const [mantissa, exponentText] = text.split('e');
  const exponent = Number(exponentText ?? 0);
  const fractionLength = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, fractionLength - exponent);
};

/** A compact representation without `0.30000000000000004` artifacts. */
export const formatEditableFloat = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  if (Object.is(value, -0)) return '0';
  return Number(value.toPrecision(12)).toString();
};

export const stepFloatValue = (
  value: unknown,
  step: unknown,
  direction: -1 | 1,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  multiplier = 1,
): number => {
  const parsedValue = parseEditableFloat(value) ?? 0;
  const parsedStep = Math.abs(parseEditableFloat(step) ?? FALLBACK_STEP) || FALLBACK_STEP;
  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  const raw = parsedValue + direction * parsedStep * safeMultiplier;
  const precision = Math.min(12, Math.max(decimalPlaces(parsedValue), decimalPlaces(parsedStep * safeMultiplier)));
  const rounded = Number(raw.toFixed(precision));
  return Math.min(Math.max(rounded, min), max);
};

