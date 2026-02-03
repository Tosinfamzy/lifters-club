module.exports = {
  preset: "jest-expo",
  testEnvironment: "node",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native)",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.cjs"],
  moduleNameMapper: {
    "^@gymapp/types$": "<rootDir>/../../packages/types/src",
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "!**/__tests__/**",
    "!**/*.test.{ts,tsx}",
    "!**/node_modules/**",
  ],
  coverageThreshold: {
    // Only enforce thresholds on new components with tests
    "components/AlternativeExerciseCard.tsx": {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
    "components/ExerciseActionsSheet.tsx": {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
    "lib/offline/storage.ts": {
      statements: 80,
      branches: 60,
      functions: 80,
      lines: 80,
    },
  },
};
