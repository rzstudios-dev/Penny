import fs from "node:fs";
const configuration = {};
for (const file of [
  ".env",
  ".env.production",
  ".env.local",
  ".env.production.local",
]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match)
      configuration[match[1]] = match[2].replace(/^['"]|['"]$/g, "").trim();
  }
}
Object.assign(configuration, process.env);
const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_OPERATOR_NAME",
  "VITE_OPERATOR_COUNTRY",
  "VITE_SUPPORT_EMAIL",
  "VITE_PRIVACY_URL",
  "VITE_DELETE_ACCOUNT_URL",
  "VITE_PLAY_PRODUCT_ID",
];
const missing = required.filter((key) => !configuration[key]);
for (const key of [
  "VITE_SUPABASE_URL",
  "VITE_PRIVACY_URL",
  "VITE_DELETE_ACCOUNT_URL",
]) {
  if (configuration[key] && !/^https:\/\//.test(configuration[key]))
    missing.push(`${key} must use HTTPS`);
}
if (missing.length) {
  console.error(
    "Publication configuration is incomplete:\n" +
      missing.map((key) => `- ${key}`).join("\n"),
  );
  console.error(
    "See SETUP.md. This check never connects to a Supabase project.",
  );
  process.exitCode = 1;
} else {
  console.log(
    "Public configuration is present. This does not verify live services or approve publication.",
  );
  console.log(
    "Complete the signed-build, Play subscription, authentication, notifications, Data safety and deletion checks in SETUP.md.",
  );
}
