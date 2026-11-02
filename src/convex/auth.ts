import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { LEGAL_VERSION } from "../lib/legal";
import { validatePassword } from "../lib/password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params): { [key: string]: string | number; email: string } {
        const email =
          typeof params.email === "string"
            ? params.email.trim().toLowerCase()
            : "";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254)
          throw new Error("Informe um e-mail válido.");
        if (params.flow === "signUp") {
          if (params.legalVersion !== LEGAL_VERSION)
            throw new Error(
              "Leia e aceite os termos e a política de privacidade.",
            );
          const name =
            typeof params.name === "string"
              ? params.name.trim().slice(0, 80)
              : "";
          if (!name) throw new Error("Informe seu nome.");
          return {
            email,
            name,
            termsAcceptedAt: Date.now(),
            legalVersion: LEGAL_VERSION,
          };
        }
        return { email };
      },
      validatePasswordRequirements: validatePassword,
    }),
  ],
});
