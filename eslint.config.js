import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            '**/dist/**',
            '**/coverage/**',
            'node_modules/**',
            'docs/**',
            '.superpowers/**',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        // A leading underscore marks a parameter that only carries a type,
        // such as the payload of a Vue emits validator.
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_' },
            ],
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
