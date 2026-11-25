// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // "@/..." aliases are declared in jsconfig.json (SDK 58's resolver only looks for tsconfig.json by default)
    settings: { "import/resolver": { typescript: { project: "./jsconfig.json" } } },
  },
]);
