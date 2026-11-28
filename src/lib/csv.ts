/** Quote spreadsheet cells and neutralize formula prefixes, including leading whitespace. */
export const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};