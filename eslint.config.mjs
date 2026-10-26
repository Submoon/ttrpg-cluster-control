import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

const sourceFiles = ['**/*.{js,mjs,cjs,ts,tsx,mts,cts,vue}']
const typescriptFiles = ['**/*.{ts,tsx,mts,cts}']
const typescriptAndVueFiles = [...typescriptFiles, '**/*.vue']
const vueFiles = ['**/*.vue']

const [typescriptBase, typescriptCoreCompatibility, typescriptRecommendedRules] =
  tseslint.configs.recommended

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '.scratch/ttrpg-cluster-control/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: sourceFiles,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    ...typescriptBase,
    files: typescriptAndVueFiles,
  },
  {
    ...typescriptCoreCompatibility,
    files: typescriptAndVueFiles,
  },
  {
    ...typescriptRecommendedRules,
    files: typescriptAndVueFiles,
  },
  ...pluginVue.configs['flat/essential'],
  {
    // Nuxt uses index.vue as the canonical single-segment route filename.
    files: ['pages/index.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: vueFiles,
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    // Nuxt resolves auto-imported names through generated types, so undefined-name
    // checks for TypeScript and Vue files remain the responsibility of Nuxt typecheck.
    files: typescriptAndVueFiles,
    rules: {
      'no-undef': 'off',
    },
  },
]
