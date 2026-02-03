// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock Expo Router
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock Clerk
jest.mock("@clerk/clerk-expo", () => ({
  useAuth: () => ({
    getToken: jest.fn().mockResolvedValue("mock-token"),
    isSignedIn: true,
    userId: "mock-user-id",
  }),
  useUser: () => ({
    user: {
      id: "mock-user-id",
      emailAddresses: [{ emailAddress: "test@example.com" }],
    },
    isLoaded: true,
  }),
  ClerkProvider: ({ children }) => children,
  SignedIn: ({ children }) => children,
  SignedOut: () => null,
}));

// Mock React Native NetInfo
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn(),
}));

// Mock Lucide React Native icons
jest.mock("lucide-react-native", () => ({
  Info: "Info",
  RefreshCw: "RefreshCw",
  SkipForward: "SkipForward",
  CheckCircle: "CheckCircle",
  Dumbbell: "Dumbbell",
  Star: "Star",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  MoreHorizontal: "MoreHorizontal",
  X: "X",
  ChevronRight: "ChevronRight",
  TrendingUp: "TrendingUp",
}));

// Silence console warnings during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
