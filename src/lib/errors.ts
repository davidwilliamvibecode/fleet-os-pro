import { ConvexError } from "convex/values";

/**
 * Turns anything thrown by a Convex function into a sentence a non-technical
 * fleet manager can act on. Validation failures raise `ConvexError` with a
 * plain message in `error.data`.
 */
export function errorMessage(error: unknown, fallback = "Algo deu errado. Tente novamente.") {
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
      return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
    }
    return error.message;
  }
  return fallback;
}
