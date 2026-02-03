# Mobile App Testing Guide

This document explains how to set up and run tests for the Lifters Club mobile app.

## Setup

### Install Testing Dependencies

Run the following command from the mobile app directory:

```bash
yarn add -D @testing-library/react-native @testing-library/jest-native jest-expo jest
```

### Test Files Structure

Tests are organized alongside the code they test:

```
apps/mobile/
├── components/
│   ├── __tests__/
│   │   ├── AlternativeExerciseCard.test.tsx
│   │   └── ExerciseActionsSheet.test.tsx
│   ├── AlternativeExerciseCard.tsx
│   └── ExerciseActionsSheet.tsx
├── lib/
│   └── offline/
│       ├── __tests__/
│       │   └── storage.test.ts
│       └── storage.ts
├── jest.config.js
└── jest.setup.js
```

## Running Tests

### Run All Tests

```bash
yarn test
```

### Run Tests in Watch Mode

```bash
yarn test:watch
```

### Run Tests with Coverage

```bash
yarn test:coverage
```

### Run Specific Test File

```bash
yarn test AlternativeExerciseCard
```

## Test Coverage

The mobile app aims for the following coverage targets:

| Category | Target |
|----------|--------|
| Components | 70%+ |
| Utilities | 80%+ |
| Hooks | 70%+ |

Current coverage thresholds are configured in `jest.config.js`:

```javascript
coverageThresholds: {
  global: {
    statements: 70,
    branches: 60,
    functions: 70,
    lines: 70,
  },
}
```

## Writing Tests

### Component Tests

Component tests use React Native Testing Library:

```typescript
import { render, fireEvent } from "@testing-library/react-native";
import { MyComponent } from "../MyComponent";

describe("MyComponent", () => {
  it("renders correctly", () => {
    const { getByText } = render(<MyComponent title="Test" />);
    expect(getByText("Test")).toBeTruthy();
  });

  it("handles press events", () => {
    const onPress = jest.fn();
    const { getByText } = render(<MyComponent onPress={onPress} />);

    fireEvent.press(getByText("Button"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### Utility/Storage Tests

Utility tests focus on logic and data transformations:

```typescript
import { offlineStorage } from "../storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("offlineStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores data correctly", async () => {
    await offlineStorage.storeExercisePreference({
      originalId: "exercise-1",
      substituteId: "exercise-2",
      timestamp: new Date().toISOString(),
    });

    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
```

## Mocked Dependencies

The following dependencies are mocked globally in `jest.setup.js`:

- **AsyncStorage**: Uses the official mock from `@react-native-async-storage/async-storage`
- **Expo Router**: Mocked with jest functions for navigation
- **Clerk Auth**: Mocked with default authenticated user
- **NetInfo**: Always returns connected status
- **Lucide Icons**: Mocked as string components

## Test Coverage Report

After running tests with coverage, view the HTML report:

```bash
open coverage/index.html
```

## Continuous Integration

Tests should be run in CI before merging:

```yaml
# .github/workflows/test.yml
- name: Run Mobile Tests
  run: |
    cd apps/mobile
    yarn test --coverage
```

## Troubleshooting

### Common Issues

1. **Module not found errors**
   - Ensure all dependencies are installed: `yarn install`
   - Check `moduleNameMapper` in `jest.config.js`

2. **AsyncStorage errors**
   - Verify the AsyncStorage mock is imported in `jest.setup.js`

3. **Transform errors**
   - Update `transformIgnorePatterns` in `jest.config.js` to include the problematic module

4. **Timeout errors**
   - Increase the timeout: `jest.setTimeout(10000)`

## Best Practices

1. **AAA Pattern**: Arrange, Act, Assert
   ```typescript
   it("updates state on button press", () => {
     // Arrange
     const { getByText } = render(<Component />);

     // Act
     fireEvent.press(getByText("Update"));

     // Assert
     expect(getByText("Updated")).toBeTruthy();
   });
   ```

2. **Test IDs**: Use `testID` for elements without text
   ```typescript
   <View testID="container">

   const { getByTestId } = render(<Component />);
   expect(getByTestId("container")).toBeTruthy();
   ```

3. **Mock Cleanup**: Always clear mocks in `beforeEach`
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
   });
   ```

4. **Avoid Implementation Details**: Test behavior, not implementation
   ```typescript
   // ❌ Bad - testing internal state
   expect(component.state.count).toBe(1);

   // ✅ Good - testing visible output
   expect(getByText("Count: 1")).toBeTruthy();
   ```

## Test Files

### Existing Test Files

- ✅ `components/__tests__/ExerciseActionsSheet.test.tsx` - Bottom sheet action menu
- ✅ `components/__tests__/AlternativeExerciseCard.test.tsx` - Exercise card component
- ✅ `lib/offline/__tests__/storage.test.ts` - Offline storage utilities

### TODO: Additional Tests

The following areas need test coverage:

- [ ] `app/exercise-alternatives/[exerciseId].tsx` - Alternative exercises screen
- [ ] `app/workout/[id].tsx` - Main workout screen (integration tests)
- [ ] `hooks/use-workout-offline.ts` - Workout offline hook
- [ ] `lib/offline/queue.ts` - Offline queue operations
- [ ] Integration tests for exercise substitution flow
- [ ] E2E tests for complete workout flows

## Resources

- [React Native Testing Library Docs](https://callstack.github.io/react-native-testing-library/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
