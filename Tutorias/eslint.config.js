// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: ['dist/**', '.expo/**', 'functions/**', 'htpps/**'],
  },
  expoConfig,
  {
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
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
]);
