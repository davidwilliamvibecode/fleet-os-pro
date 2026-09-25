import { ConvexError } from "convex/values";

/**
 * Turns anything thrown by a Convex function into a sentence a non-technical
 * fleet manager can act on. Validation failures raise `ConvexError` with a
 * plain message in `error.data`.
 */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof ConvexError) {
    const data = error.data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    return fallback;
  }
  if (error instanceof Error && error.message) {
    if (/Failed to fetch|NetworkError/i.test(error.message)) {
      return "We could not reach the server. Check your connection and try again.";
    }
    return error.message;
  }
  return fallback;
}
