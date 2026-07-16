import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'
import globals from 'globals'

export default [
    {
        ignores: ['node_modules/', 'dist/', 'artifacts/', 'cache/', 'coverage/']
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        plugins: {
            prettier: prettierPlugin
        },
        rules: {
            'prettier/prettier': 'warn',
            'no-console': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            'no-empty': 'off',
            'no-extra-semi': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off'
        },
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.mocha
            }
        }
    }
]