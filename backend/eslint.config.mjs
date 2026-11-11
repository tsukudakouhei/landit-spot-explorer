// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs', 'jest.config.js'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    // 依存の向き（domain/application → フレームワーク禁止）を lint で機械的に守らせる
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@nestjs/*', 'typeorm', 'pg', 'class-validator', 'class-transformer'], message: 'domain / application は純 TypeScript に保つ（フレームワーク依存は infrastructure へ）' },
            { group: ['**/infrastructure/**'], message: '内側の層から infrastructure を参照しない' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@nestjs/*', 'typeorm', 'pg', 'class-validator', 'class-transformer'], message: 'domain は純 TypeScript に保つ' },
            { group: ['**/infrastructure/**', '**/application/**'], message: 'domain は他の層に依存しない' },
          ],
        },
      ],
    },
  },
);
