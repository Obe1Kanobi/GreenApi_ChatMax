import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import tanstackQuery from '@tanstack/eslint-plugin-query'

const tsFiles = ['**/*.{ts,tsx}']

export default tseslint.config(
  { ignores: ['dist'] },
  {
    ...js.configs.recommended,
    files: tsFiles,
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: tsFiles,
  })),
  {
    ...reactHooks.configs.flat.recommended,
    files: tsFiles,
  },
  {
    ...reactRefresh.configs.vite,
    files: tsFiles,
  },
  {
    files: tsFiles,
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@tanstack/query': tanstackQuery,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      '@tanstack/query/exhaustive-deps': 'error',
      '@tanstack/query/prefer-query-options': 'error',

      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
)
