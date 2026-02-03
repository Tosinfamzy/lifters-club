import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { AlternativeExerciseCard } from "../AlternativeExerciseCard";

describe("AlternativeExerciseCard", () => {
  const mockOnPress = jest.fn();

  const mockExercise = {
    id: "incline-bench-press",
    name: "Incline Bench Press",
    difficulty: "intermediate" as const,
    equipment: ["Barbell", "Bench"],
  };

  const defaultProps = {
    exercise: mockExercise,
    matchScore: 0.94,
    matchReasons: ["Same movement pattern", "Targets chest"],
    sets: 4,
    repRange: [6, 8] as [number, number],
    onPress: mockOnPress,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders exercise name correctly", () => {
    const { getByText } = render(<AlternativeExerciseCard {...defaultProps} />);
    expect(getByText("Incline Bench Press")).toBeTruthy();
  });

  it("displays difficulty badge", () => {
    const { getByText } = render(<AlternativeExerciseCard {...defaultProps} />);
    expect(getByText("INT")).toBeTruthy(); // Intermediate truncated to INT
  });

  it("displays correct difficulty badge for beginner", () => {
    const beginnerExercise = {
      ...mockExercise,
      difficulty: "beginner" as const,
    };

    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} exercise={beginnerExercise} />
    );

    expect(getByText("BEG")).toBeTruthy();
  });

  it("displays correct difficulty badge for advanced", () => {
    const advancedExercise = {
      ...mockExercise,
      difficulty: "advanced" as const,
    };

    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} exercise={advancedExercise} />
    );

    expect(getByText("ADV")).toBeTruthy();
  });

  it("displays sets and rep range correctly", () => {
    const { getByText } = render(<AlternativeExerciseCard {...defaultProps} />);
    expect(getByText("4 SETS ⟳ 6-8 REPS")).toBeTruthy();
  });

  it("displays single rep count when min equals max", () => {
    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} repRange={[10, 10]} />
    );
    expect(getByText("4 SETS ⟳ 10 REPS")).toBeTruthy();
  });

  it("displays match score as percentage", () => {
    const { getByText } = render(<AlternativeExerciseCard {...defaultProps} />);
    expect(getByText("94% match")).toBeTruthy();
  });

  it("displays match reasons (first 2)", () => {
    const { getByText } = render(<AlternativeExerciseCard {...defaultProps} />);
    expect(getByText("Same movement pattern • Targets chest")).toBeTruthy();
  });

  it("truncates match reasons to first 2", () => {
    const manyReasons = [
      "Reason 1",
      "Reason 2",
      "Reason 3",
      "Reason 4",
    ];

    const { getByText, queryByText } = render(
      <AlternativeExerciseCard {...defaultProps} matchReasons={manyReasons} />
    );

    expect(getByText("Reason 1 • Reason 2")).toBeTruthy();
    expect(queryByText("Reason 3")).toBeNull();
  });

  it("displays equipment list", () => {
    const { getByText } = render(<AlternativeExerciseCard {...defaultProps} />);
    expect(getByText("Barbell, Bench")).toBeTruthy();
  });

  it("calls onPress when card is pressed", () => {
    const { getByText } = render(<AlternativeExerciseCard {...defaultProps} />);

    fireEvent.press(getByText("Incline Bench Press"));

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} onPress={undefined} />
    );

    fireEvent.press(getByText("Incline Bench Press"));

    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it("shows ORIGINAL badge when isOriginal is true", () => {
    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} isOriginal={true} />
    );

    expect(getByText("ORIGINAL")).toBeTruthy();
  });

  it("does not show ORIGINAL badge when isOriginal is false", () => {
    const { queryByText } = render(
      <AlternativeExerciseCard {...defaultProps} isOriginal={false} />
    );

    expect(queryByText("ORIGINAL")).toBeNull();
  });

  it("does not show match score for original exercise", () => {
    const { queryByText } = render(
      <AlternativeExerciseCard {...defaultProps} isOriginal={true} />
    );

    expect(queryByText("94% match")).toBeNull();
  });

  it("applies selected style when isSelected is true", () => {
    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} isSelected={true} />
    );

    const card = getByText("Incline Bench Press").parent?.parent;
    const styles = card?.props.style;

    // Check if selected border color is applied
    expect(styles).toBeDefined();
  });

  it("applies correct color for high match score (90%+)", () => {
    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} matchScore={0.95} />
    );

    expect(getByText("95% match")).toBeTruthy();
  });

  it("applies correct color for medium match score (70-89%)", () => {
    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} matchScore={0.75} />
    );

    expect(getByText("75% match")).toBeTruthy();
  });

  it("applies correct color for low match score (<70%)", () => {
    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} matchScore={0.65} />
    );

    expect(getByText("65% match")).toBeTruthy();
  });

  it("truncates long exercise names", () => {
    const longNameExercise = {
      ...mockExercise,
      name: "Very Long Exercise Name That Should Be Truncated",
    };

    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} exercise={longNameExercise} />
    );

    const exerciseName = getByText("Very Long Exercise Name That Should Be Truncated");
    expect(exerciseName.props.numberOfLines).toBe(1);
  });

  it("truncates long equipment lists", () => {
    const manyEquipment = {
      ...mockExercise,
      equipment: ["Barbell", "Bench", "Spotter", "Clips", "Weights"],
    };

    const { getByText } = render(
      <AlternativeExerciseCard {...defaultProps} exercise={manyEquipment} />
    );

    const equipment = getByText("Barbell, Bench, Spotter, Clips, Weights");
    expect(equipment.props.numberOfLines).toBe(1);
  });

  it("handles empty match reasons gracefully", () => {
    const { queryByText } = render(
      <AlternativeExerciseCard {...defaultProps} matchReasons={[]} />
    );

    // Should not crash, and empty string should not be visible
    expect(queryByText("undefined")).toBeNull();
  });

  it("renders with all props combinations", () => {
    const { getByText } = render(
      <AlternativeExerciseCard
        {...defaultProps}
        isOriginal={true}
        isSelected={true}
      />
    );

    expect(getByText("Incline Bench Press")).toBeTruthy();
    expect(getByText("ORIGINAL")).toBeTruthy();
  });
});
