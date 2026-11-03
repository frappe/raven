import js from '@eslint/js'
import globals from 'globals'
import * as reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// A translation at module load runs before the table is in place on newer Frappe, where the
// table is fetched, and the English text would then be kept for the life of the page.
// Labels are translated where they are used: inside a component, hook or function.
const noImportTimeTranslation = {
  rules: {
    'no-import-time-translation': {
      meta: {
        type: 'problem',
        docs: { description: 'Call _() inside a function, not at module load' },
        messages: { importTime: 'Translate inside a function: at module load the translations may not be in place yet.' },
      },
      create(context) {
        const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])
        return {
          CallExpression(node) {
            if (node.callee.type !== 'Identifier' || node.callee.name !== '_') return
            const inFunction = context.sourceCode.getAncestors(node).some((ancestor) => FUNCTIONS.has(ancestor.type))
            if (!inFunction) context.report({ node, messageId: 'importTime' })
          },
        }
      },
    },
  },
}

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      raven: noImportTimeTranslation,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'raven/no-import-time-translation': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "varsIgnorePattern": "^_",
          "argsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_",
          "ignoreRestSiblings": true
        }
      ]
    },
  },
)
