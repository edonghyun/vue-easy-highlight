import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import svelteConfig from './packages/svelte/svelte.config.js';

export default tseslint.config(
    {
        ignores: [
            '**/dist/**',
            '**/coverage/**',
            // svelte-package's working copy of the sources
            '**/.svelte-kit/**',
            'node_modules/**',
            'docs/**',
            '.superpowers/**',
            'acceptance/.work/**',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        // A leading underscore marks a parameter that only carries a type,
        // such as the payload of a Vue emits validator. A property
        // destructured beside a rest element only leaves it out of the rest.
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', ignoreRestSiblings: true },
            ],
        },
    },
    ...svelte.configs.recommended,
    ...svelte.configs.prettier,
    {
        // Components and rune modules: their scripts are TypeScript.
        files: ['**/*.svelte', '**/*.svelte.ts'],
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
                extraFileExtensions: ['.svelte'],
                svelteConfig,
            },
        },
        rules: {
            // TypeScript (svelte-check) reports undefined names, and knows
            // the DOM globals this config does not declare.
            'no-undef': 'off',
        },
    },
    {
        files: ['**/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: { module: 'writable', require: 'readonly' },
        },
    },
);
