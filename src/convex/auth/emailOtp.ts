import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Chave do relay de e-mail da plataforma.
 *
 * Configuração vem do ambiente: `VLY_EMAIL_API_KEY` definida no deployment do
 * Convex (gerenciável pelo painel de chaves do projeto). Sem fallback fixo:
 * segredo não pertence ao código versionado.
 */
function emailApiKey() {
  const key = process.env.VLY_EMAIL_API_KEY;
  if (!key) {
    throw new Error(
      "VLY_EMAIL_API_KEY não está definida no deployment do Convex — configure-a no painel de chaves.",
    );
  }
  return key;
}

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: email,
          otp: token,
          appName: process.env.VLY_APP_NAME || "a freebuff.com application",
        },
        {
          headers: {
            "x-api-key": emailApiKey(),
          },
        },
      );
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
