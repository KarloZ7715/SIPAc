import withNuxt from './.nuxt/eslint.config.mjs'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default withNuxt(
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  prettierConfig,
).overrideRules({
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
  ],
  'vue/multi-word-component-names': 'off',
})
