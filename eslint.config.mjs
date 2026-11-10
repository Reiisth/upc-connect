import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: [".next/**", "out/**", "supabase/.temp/**", ".temp/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { files: ["tests/**/*.cjs"], linterOptions: { reportUnusedDisableDirectives: "off" }, rules: { "@typescript-eslint/no-require-imports": "off", "@next/next/no-assign-module-variable": "off" } },
];

export default eslintConfig;
