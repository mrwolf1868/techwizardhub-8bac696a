import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const failures = [];
for (const file of new Set(files)) {
  if (!existsSync(file) || !/\.(?:ts|tsx|js|mjs|json|ya?ml|md|env)$/.test(file) || /(?:lock|migrations|\.asset\.json|\.test\.)/.test(file)) continue;
  const source = readFileSync(file, "utf8");
  if (/^src\//.test(file) && /VITE_(?:.*(?:SECRET|PASSWORD|PASSKEY)|SUPABASE_SERVICE_ROLE_KEY|MPESA_CONSUMER_KEY)/i.test(source)) failures.push(`${file}: private frontend environment variable`);
  if (/(?:consumer_?secret|consumer_?key|passkey|service_role_key|internal_secret|password)\s*[:=]\s*["'`][A-Za-z0-9+/_=@.-]{12,}["'`]/i.test(source)) failures.push(`${file}: possible hardcoded credential`);
}
// Never print matching source text: it could contain the very secret being blocked.
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("No hardcoded credentials found in checked source files.");