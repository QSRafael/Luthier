import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import boundariesPlugin from 'eslint-plugin-boundaries'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const tsLanguageOptions = {
  parser: tsParser,
  ecmaVersion: 'latest',
  sourceType: 'module',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
}

const layerRules = {
  'boundaries/element-types': [
    'error',
    {
      default: 'allow',
      message:
        'Dependency between frontend layers violates FRONTEND_ARCHITECTURE.md direction rules.',
      rules: [
        {
          from: 'domain',
          allow: ['domain'],
        },
        {
          from: 'application',
          allow: ['application', 'domain'],
        },
        {
          from: 'infrastructure',
          allow: ['infrastructure', 'application', 'domain'],
        },
        {
          from: 'presentation',
          allow: ['presentation', 'infrastructure', 'application', 'domain'],
        },
      ],
    },
  ],
}

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'src-tauri/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: tsLanguageOptions,
  },
  {
    files: ['src/features/luthier/**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      boundaries: boundariesPlugin,
    },
    settings: {
      'boundaries/elements': [
        {
          type: 'domain',
          pattern: 'src/features/luthier/domain/**/*.{ts,tsx}',
        },
        {
          type: 'application',
          pattern: 'src/features/luthier/application/**/*.{ts,tsx}',
        },
        {
          type: 'infrastructure',
          pattern: 'src/features/luthier/infrastructure/**/*.{ts,tsx}',
        },
        {
          type: 'presentation',
          pattern: 'src/features/luthier/**/*.{tsx}',
        },
      ],
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.mjs', '.ts', '.tsx'],
        },
      },
    },
    rules: {
      ...layerRules,
      'import/no-restricted-paths': [
        'error',
        {
          basePath: projectRoot,
          zones: [
            {
              target: './src/features/luthier/domain',
              from: './src/features/luthier/application',
              message: 'Domain cannot depend on Application.',
            },
            {
              target: './src/features/luthier/domain',
              from: './src/features/luthier/infrastructure',
              message: 'Domain cannot depend on Infrastructure.',
            },
            {
              target: './src/features/luthier/domain',
              from: './src/features/luthier/sections',
              message: 'Domain cannot depend on Presentation sections.',
            },
            {
              target: './src/features/luthier/domain',
              from: './src/features/luthier/dialogs',
              message: 'Domain cannot depend on Presentation dialogs.',
            },
            {
              target: './src/features/luthier/domain',
              from: './src/components',
              message: 'Domain cannot depend on UI components.',
            },
            {
              target: './src/features/luthier/application',
              from: './src/features/luthier/infrastructure',
              message: 'Application cannot depend on Infrastructure adapters.',
            },
            {
              target: './src/features/luthier/application',
              from: './src/features/luthier/sections',
              message: 'Application cannot depend on Presentation sections.',
            },
            {
              target: './src/features/luthier/application',
              from: './src/features/luthier/dialogs',
              message: 'Application cannot depend on Presentation dialogs.',
            },
            {
              target: './src/features/luthier/application',
              from: './src/components',
              message: 'Application cannot depend on UI components.',
            },
            {
              target: './src/features/luthier/infrastructure',
              from: './src/features/luthier/sections',
              message: 'Infrastructure cannot depend on Presentation sections.',
            },
            {
              target: './src/features/luthier/infrastructure',
              from: './src/features/luthier/dialogs',
              message: 'Infrastructure cannot depend on Presentation dialogs.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/luthier/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'solid-js',
              message: 'Domain must stay framework-agnostic (no Solid imports).',
            },
            {
              name: 'solid-js/web',
              message: 'Domain must stay framework-agnostic (no Solid imports).',
            },
            {
              name: 'solid-sonner',
              message: 'Domain cannot import notifier UI adapters.',
            },
            {
              name: '@tauri-apps/api',
              message: 'Domain cannot import Tauri APIs.',
            },
            {
              name: '@tauri-apps/api/core',
              message: 'Domain cannot import Tauri APIs.',
            },
            {
              name: '@tauri-apps/api/path',
              message: 'Domain cannot import Tauri APIs.',
            },
            {
              name: '@tauri-apps/api/dialog',
              message: 'Domain cannot import Tauri APIs.',
            },
          ],
          patterns: [
            {
              group: ['**/api/tauri', '**/api/tauri.*'],
              message: 'Domain cannot call Tauri adapter directly.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/luthier/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'solid-js',
              message: 'Application should not depend on Solid primitives directly.',
            },
            {
              name: 'solid-js/web',
              message: 'Application should not depend on Solid primitives directly.',
            },
            {
              name: 'solid-sonner',
              message: 'Application cannot import notifier UI adapters directly.',
            },
            {
              name: '@tauri-apps/api',
              message: 'Application cannot import Tauri APIs directly; use ports/adapters.',
            },
            {
              name: '@tauri-apps/api/core',
              message: 'Application cannot import Tauri APIs directly; use ports/adapters.',
            },
            {
              name: '@tauri-apps/api/path',
              message: 'Application cannot import Tauri APIs directly; use ports/adapters.',
            },
            {
              name: '@tauri-apps/api/dialog',
              message: 'Application cannot import Tauri APIs directly; use ports/adapters.',
            },
          ],
          patterns: [
            {
              group: ['**/api/tauri', '**/api/tauri.*'],
              message: 'Application cannot call Tauri adapter directly; use ports.',
            },
          ],
        },
      ],
    },
  },
]
