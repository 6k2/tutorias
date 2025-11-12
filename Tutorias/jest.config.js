module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  forceExit: true,
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverage: false,
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|expo(nent)?|@expo|expo-router|expo-modules-core|react-clone-referenced-element|@react-navigation|@react-native-community|firebase)/)',
  ],
};
