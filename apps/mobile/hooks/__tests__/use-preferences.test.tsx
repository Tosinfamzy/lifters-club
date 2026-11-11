import { renderHook, act } from "@testing-library/react-native";
import { usePreferences, useWeightUnit } from "../use-preferences";

const mockUpdateUser = jest.fn();
const mockRefetch = jest.fn();
let mockAppUser: { id: string; preferences: Record<string, unknown> } | null;

jest.mock("../../providers/user-provider", () => ({
  useAppUser: () => ({ appUser: mockAppUser, refetch: mockRefetch, isLoading: false }),
}));

jest.mock("../use-api", () => ({
  useApi: () => ({ updateUser: mockUpdateUser }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks keeps queued mockImplementationOnce calls; reset so they can't leak between tests
  mockUpdateUser.mockReset();
  mockRefetch.mockResolvedValue(undefined);
  mockAppUser = { id: "user-1", preferences: { daysPerWeek: 4, weightUnit: "lbs" } };
});

describe("useWeightUnit", () => {
  it("defaults to lbs when the user has no preference", () => {
    mockAppUser = { id: "user-1", preferences: {} };
    const { result } = renderHook(() => useWeightUnit());
    expect(result.current).toBe("lbs");
  });

  it("returns the stored unit", () => {
    mockAppUser = { id: "user-1", preferences: { weightUnit: "kg" } };
    const { result } = renderHook(() => useWeightUnit());
    expect(result.current).toBe("kg");
  });
});

describe("usePreferences", () => {
  it("serialises quick saves so the second keeps the first's change", async () => {
    const first = deferred<{ data: { preferences: Record<string, unknown> } }>();
    mockUpdateUser
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce((_id: string, body: { preferences: Record<string, unknown> }) =>
        Promise.resolve({ data: { preferences: body.preferences } })
      );
    const { result } = renderHook(() => usePreferences());

    let saves!: Promise<unknown>;
    act(() => {
      saves = Promise.all([
        result.current.updatePreferences({ weightUnit: "kg" }),
        result.current.updatePreferences({ weekStartDay: "monday" }),
      ]);
    });

    // Let the first save start; the second must wait for it
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    first.resolve({ data: { preferences: { daysPerWeek: 4, weightUnit: "kg" } } });
    await act(async () => {
      await saves;
    });

    expect(mockUpdateUser).toHaveBeenCalledTimes(2);
    expect(mockUpdateUser.mock.calls[1]![1]).toEqual({
      preferences: { daysPerWeek: 4, weightUnit: "kg", weekStartDay: "monday" },
    });
    // One refetch once the queue drains, not one per save
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("keeps saving after a failed save and still refetches", async () => {
    mockUpdateUser
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ data: { preferences: { daysPerWeek: 4, weekStartDay: "monday" } } });
    const { result } = renderHook(() => usePreferences());

    await act(async () => {
      await expect(result.current.updatePreferences({ weightUnit: "kg" })).rejects.toThrow("network");
    });
    await act(async () => {
      await result.current.updatePreferences({ weekStartDay: "monday" });
    });

    expect(mockUpdateUser.mock.calls[1]![1]).toEqual({
      preferences: { daysPerWeek: 4, weightUnit: "lbs", weekStartDay: "monday" },
    });
    expect(mockRefetch).toHaveBeenCalledTimes(2);
  });

  it("throws instead of silently skipping when the user hasn't loaded", async () => {
    mockAppUser = null;
    const { result } = renderHook(() => usePreferences());

    await expect(result.current.updatePreferences({ weightUnit: "kg" })).rejects.toThrow(
      "before the user has loaded"
    );
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
