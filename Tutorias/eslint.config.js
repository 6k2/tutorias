// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: ['dist/**', '.expo/**', 'coverage/**', 'functions/**', 'htpps/**'],
  },
  expoConfig,
  {
    settings: {
      'import/resolver': {
        alias: {
          map: [['@', './']],
          extensions: ['.js', '.jsx', '.json'],
        },
      },
    },
    rules: {
      // Keep imports working with our Babel alias in lint
      'import/no-unresolved': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        jest: 'readonly',
      },
    },
  },
]);
