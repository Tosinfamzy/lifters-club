import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ExerciseActionsSheet } from "../ExerciseActionsSheet";
import type { ExerciseAction } from "../../types";

describe("ExerciseActionsSheet", () => {
  const mockOnClose = jest.fn();
  const mockOnSelectAction = jest.fn();

  const defaultProps = {
    visible: true,
    onClose: mockOnClose,
    exerciseId: "bench-press",
    exerciseName: "Barbell Bench Press",
    onSelectAction: mockOnSelectAction,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly when visible", () => {
    const { getByText } = render(<ExerciseActionsSheet {...defaultProps} />);

    expect(getByText("Exercise Actions")).toBeTruthy();
    expect(getByText("Barbell Bench Press")).toBeTruthy();
  });

  it("does not render when not visible", () => {
    const { queryByText } = render(
      <ExerciseActionsSheet {...defaultProps} visible={false} />
    );

    expect(queryByText("Exercise Actions")).toBeNull();
  });

  it("renders all 4 action options", () => {
    const { getByText } = render(<ExerciseActionsSheet {...defaultProps} />);

    expect(getByText("Exercise Info")).toBeTruthy();
    expect(getByText("Alternative Exercises")).toBeTruthy();
    expect(getByText("Skip Exercise for Today")).toBeTruthy();
    expect(getByText("Mark Exercise as Done")).toBeTruthy();
  });

  it("renders action descriptions", () => {
    const { getByText } = render(<ExerciseActionsSheet {...defaultProps} />);

    expect(getByText("View instructions and tips")).toBeTruthy();
    expect(getByText("Find similar exercises")).toBeTruthy();
    expect(getByText("Mark as skipped")).toBeTruthy();
    expect(getByText("Auto-complete remaining sets")).toBeTruthy();
  });

  it("calls onSelectAction with 'info' when Exercise Info is pressed", () => {
    const { getByText } = render(<ExerciseActionsSheet {...defaultProps} />);

    fireEvent.press(getByText("Exercise Info"));

    expect(mockOnSelectAction).toHaveBeenCalledWith("info");
    expect(mockOnSelectAction).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectAction with 'alternatives' when Alternative Exercises is pressed", () => {
    const { getByText } = render(<ExerciseActionsSheet {...defaultProps} />);

    fireEvent.press(getByText("Alternative Exercises"));

    expect(mockOnSelectAction).toHaveBeenCalledWith("alternatives");
    expect(mockOnSelectAction).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectAction with 'skip' when Skip Exercise is pressed", () => {
    const { getByText } = render(<ExerciseActionsSheet {...defaultProps} />);

    fireEvent.press(getByText("Skip Exercise for Today"));

    expect(mockOnSelectAction).toHaveBeenCalledWith("skip");
    expect(mockOnSelectAction).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectAction with 'mark_done' when Mark Exercise as Done is pressed", () => {
    const { getByText } = render(<ExerciseActionsSheet {...defaultProps} />);

    fireEvent.press(getByText("Mark Exercise as Done"));

    expect(mockOnSelectAction).toHaveBeenCalledWith("mark_done");
    expect(mockOnSelectAction).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Cancel button is pressed", () => {
    const { getByText } = render(<ExerciseActionsSheet {...defaultProps} />);

    fireEvent.press(getByText("Cancel"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is pressed", () => {
    const { getByTestId } = render(<ExerciseActionsSheet {...defaultProps} />);

    // Note: This requires adding testID="backdrop" to the backdrop Pressable in the component
    const backdrop = getByTestId("backdrop");
    fireEvent.press(backdrop);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("closes the sheet and calls onSelectAction for each action", () => {
    const actions: ExerciseAction[] = ["info", "alternatives", "machine", "skip", "mark_done"];

    actions.forEach((action) => {
      mockOnClose.mockClear();
      mockOnSelectAction.mockClear();

      const { getByText } = render(<ExerciseActionsSheet {...defaultProps} />);

      const actionLabels: Record<ExerciseAction, string> = {
        info: "Exercise Info",
        alternatives: "Alternative Exercises",
        machine: "Machine Setup",
        skip: "Skip Exercise for Today",
        mark_done: "Mark Exercise as Done",
      };

      fireEvent.press(getByText(actionLabels[action]));

      expect(mockOnSelectAction).toHaveBeenCalledWith(action);
    });
  });

  it("displays exercise name correctly", () => {
    const { getByText } = render(
      <ExerciseActionsSheet
        {...defaultProps}
        exerciseName="Romanian Deadlift"
      />
    );

    expect(getByText("Romanian Deadlift")).toBeTruthy();
  });

  it("truncates long exercise names", () => {
    const longName = "Very Long Exercise Name That Should Be Truncated";
    const { getByText } = render(
      <ExerciseActionsSheet {...defaultProps} exerciseName={longName} />
    );

    const exerciseNameElement = getByText(longName);
    expect(exerciseNameElement.props.numberOfLines).toBe(1);
  });
});
