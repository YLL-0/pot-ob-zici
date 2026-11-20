import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next 16 ships native flat configs (no FlatCompat), and `next build` no
// longer lints — `npm run lint` is the only lint step.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(["node_modules/**", ".next/**", "supabase/migrations/**", "migrations/**", "payload-types.ts", "public/**", "next-env.d.ts"]),
]);

export default eslintConfig;
