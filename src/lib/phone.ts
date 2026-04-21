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

/**
 * Format a normalized E.164 (no +) number as +CC XXX XXX XXX for display.
 * Best-effort: groups the country code (1-3 digits) then chunks the rest in 3s.
 */
export const formatPhoneDisplay = (raw: string): string => {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";

  // Common country codes: 1, 7, 20, 27, 30-34, 36, 39, 40-49, 51-58, 60-66, 81-84, 86, 90-98,
  // 211-299, 350-399, 420-429, 500-599, 670-699, 800-899, 960-998
  // Heuristic: 1 = NANP, 7 = RU/KZ, 2 digits common in EU, otherwise 3.
  let ccLen = 3;
  if (digits.startsWith("1") || digits.startsWith("7")) ccLen = 1;
  else if (/^(2[07]|3[0-469]|4[0-9]|5[1-8]|6[0-6]|8[1-46]|9[0-58])/.test(digits)) ccLen = 2;

  const cc = digits.slice(0, ccLen);
  const rest = digits.slice(ccLen);
  const grouped = rest.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  return `+${cc}${grouped ? " " + grouped : ""}`;
};
