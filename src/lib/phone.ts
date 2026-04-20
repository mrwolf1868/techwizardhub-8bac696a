/**
 * International phone helpers.
 * Accepts:
 *   - Local Kenyan style: 07XXXXXXXX or 011XXXXXXX  → normalized to 254...
 *   - International with +: +<country><number>
 *   - International without +: 254712345678, 256...
 *   - With 00 prefix: 00254712345678
 *
 * Returns a normalized E.164-like string WITHOUT the leading "+", e.g. "254712345678".
 */
export const normalizePhone = (raw: string): string | null => {
  if (!raw) return null;
  let s = raw.replace(/[\s\-()]/g, "").trim();
  if (!s) return null;

  // Strip leading + or 00
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);

  // Local Kenyan formats → 254
  if (/^0[17]\d{8}$/.test(s)) {
    s = "254" + s.slice(1);
  }

  // Must be all digits, 8-15 length (E.164)
  if (!/^\d{8,15}$/.test(s)) return null;

  return s;
};

export const isValidPhone = (raw: string) => normalizePhone(raw) !== null;
