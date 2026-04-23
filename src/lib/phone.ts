/**
 * International phone helpers backed by libphonenumber-js so we can verify the
 * number actually matches a real carrier numbering plan, not just digit length.
 *
 * Accepts:
 *   - Local Kenyan style: 07XXXXXXXX or 011XXXXXXX  → normalized to 254...
 *   - International with +: +<country><number>
 *   - International without +: 254712345678, 256...
 *   - With 00 prefix: 00254712345678
 *
 * Returns a normalized E.164-like string WITHOUT the leading "+", e.g. "254712345678".
 */
import { parsePhoneNumberFromString, isValidPhoneNumber } from "libphonenumber-js";

const isObviouslyFake = (digits: string): boolean => {
  if (/^(\d)\1+$/.test(digits)) return true;
  if (/0123456789|9876543210/.test(digits)) return true;
  return false;
};

export const normalizePhone = (raw: string): string | null => {
  if (!raw) return null;
  let s = raw.replace(/[\s\-()]/g, "").trim();
  if (!s) return null;

  if (s.startsWith("00")) s = "+" + s.slice(2);

  if (/^0[17]\d{8}$/.test(s)) {
    s = "+254" + s.slice(1);
  } else if (!s.startsWith("+")) {
    s = "+" + s;
  }

  const parsed = parsePhoneNumberFromString(s);
  if (!parsed || !parsed.isValid()) return null;

  const type = parsed.getType();
  if (type && !["MOBILE", "FIXED_LINE_OR_MOBILE", "FIXED_LINE", "PERSONAL_NUMBER"].includes(type)) {
    return null;
  }

  const e164 = parsed.number.replace(/^\+/, "");
  if (isObviouslyFake(e164)) return null;
  if (!/^\d{8,15}$/.test(e164)) return null;

  return e164;
};

export const isValidPhone = (raw: string) => normalizePhone(raw) !== null;

export const formatPhoneDisplay = (raw: string): string => {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const parsed = parsePhoneNumberFromString("+" + digits);
  if (parsed) return parsed.formatInternational();
  return "+" + digits;
};

export { isValidPhoneNumber };

