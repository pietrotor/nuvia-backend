import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

const nestjsHttpExceptions = [
  'HttpException',
  'BadRequestException',
  'UnauthorizedException',
  'ForbiddenException',
  'NotFoundException',
  'ConflictException',
  'InternalServerErrorException',
];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'drizzle/**',
      'coverage/**',
      'logs/**',
      // Postgres data volume created by docker-compose.
      'postgres/**',
      'eslint.config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: {
        project: 'tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-require-imports': [
        'error',
        { allowAsImport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Domain layer stays framework-free: it must compile without Nest, Drizzle or
    // Express, and it must not depend on the layers above it.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@nestjs/*',
                'drizzle-orm',
                'drizzle-orm/*',
                'pg',
                'express',
                '@application/*',
                '@infrastructure/*',
                '@interface/*',
              ],
              message:
                'domain/ no puede depender de frameworks ni de otras capas.',
            },
          ],
        },
      ],
    },
  },
  {
    // Application layer orchestrates: no SQL, no HTTP, no knowledge of controllers.
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@nestjs/common',
              importNames: nestjsHttpExceptions,
              message:
                'Lanzá una excepción de dominio; el filtro global la traduce a HTTP.',
            },
          ],
          patterns: [
            {
              group: ['drizzle-orm', 'drizzle-orm/*', 'pg', '@interface/*'],
              message:
                'application/ habla con puertos, no con la base ni con HTTP.',
            },
          ],
        },
      ],
    },
  },
);
