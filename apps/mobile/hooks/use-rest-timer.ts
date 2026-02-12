import { useState, useRef, useCallback, useEffect } from "react";
import { Vibration } from "react-native";

export function useRestTimer() {
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [targetRestTime, setTargetRestTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRest = useCallback((seconds: number) => {
    setTargetRestTime(seconds);
    setRestTimeRemaining(seconds);
    setIsResting(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setRestTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          setIsResting(false);
          Vibration.vibrate([0, 200, 100, 200]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const skipRest = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsResting(false);
    setRestTimeRemaining(0);
  }, []);

  const addTime = useCallback((seconds: number) => {
    setRestTimeRemaining((prev) => prev + seconds);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    restTimeRemaining,
    isResting,
    targetRestTime,
    startRest,
    skipRest,
    addTime,
  };
}
