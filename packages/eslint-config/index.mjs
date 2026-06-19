import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const defaultRules = {
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-floating-promises': 'warn',
  '@typescript-eslint/no-unsafe-argument': 'warn',
  'prettier/prettier': ['error', { endOfLine: 'auto' }],
};

export function createNodeTsConfig(options = {}) {
  const {
    ignores = ['eslint.config.mjs'],
    includeJest = false,
    sourceType = 'module',
    tsconfigRootDir = process.cwd(),
    rules = {},
  } = options;

  return tseslint.config(
    {
      ignores,
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    eslintPluginPrettierRecommended,
    {
      languageOptions: {
        globals: {
          ...globals.node,
          ...(includeJest ? globals.jest : {}),
        },
        sourceType,
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
    },
    {
      rules: {
        ...defaultRules,
        ...rules,
      },
    },
  );
}

export function createNestServiceConfig(options = {}) {
  return createNodeTsConfig({
    sourceType: 'commonjs',
    includeJest: true,
    ...options,
  });
}
