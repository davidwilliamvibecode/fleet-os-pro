import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Chave do relay de e-mail da plataforma.
 *
 * Antes ela vivia fixa aqui — segredo em código, versionado no git. Agora a
 * configuração vem do ambiente: defina `VLY_EMAIL_API_KEY` no painel de chaves
 * do projeto. O valor abaixo é apenas o fallback de migração, para não derrubar
 * o login por e-mail antes da variável existir; assim que ela estiver definida,
 * apague a constante e **rotacione a chave** (a antiga está no histórico).
 */
const LEGACY_EMAIL_API_KEY = "fb_email_2crN1hqIArZP2bEfvjp5Qik4";

function emailApiKey() {
  return process.env.VLY_EMAIL_API_KEY ?? LEGACY_EMAIL_API_KEY;
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
