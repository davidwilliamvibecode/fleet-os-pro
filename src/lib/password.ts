export function validatePassword(password: string) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new Error("Use uma senha entre 8 e 128 caracteres.");
  }
}
