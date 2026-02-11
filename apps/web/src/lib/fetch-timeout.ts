import { FETCH_TIMEOUT_MS } from "./constants";

/**
 * Wraps fetch with a timeout. Rejects with an AbortError if the request
 * takes longer than `timeoutMs`.  Any existing signal on `options` is
 * respected (the request aborts on whichever fires first).
 */
export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();

  // If the caller already passed a signal, abort our controller when it fires
  if (options.signal) {
    const externalSignal = options.signal;
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", () =>
        controller.abort(externalSignal.reason)
      );
    }
  }

  const timeout = setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
}
