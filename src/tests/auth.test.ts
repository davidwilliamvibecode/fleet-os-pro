import { generateKeyPairSync } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { LEGAL_VERSION } from "../lib/legal";

const modules = import.meta.glob("../convex/**/*.ts");
const oldPrivateKey = process.env.JWT_PRIVATE_KEY;
const oldSiteUrl = process.env.CONVEX_SITE_URL;
beforeAll(() => {
  process.env.JWT_PRIVATE_KEY = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  })
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString();
  process.env.CONVEX_SITE_URL = "https://test.convex.site";
});
afterAll(() => {
  if (oldPrivateKey === undefined) delete process.env.JWT_PRIVATE_KEY;
  else process.env.JWT_PRIVATE_KEY = oldPrivateKey;
  if (oldSiteUrl === undefined) delete process.env.CONVEX_SITE_URL;
  else process.env.CONVEX_SITE_URL = oldSiteUrl;
});
const params = {
  email: " Cliente@Example.TEST ",
  password: "SenhaTeste123!",
  name: "Cliente",
  flow: "signUp",
  legalVersion: LEGAL_VERSION,
};

describe("autenticação independente", () => {
  it("cadastro e login com senha, e-mail normalizado, aceite persistido e senha protegida", async () => {
    const t = convexTest(schema, modules);
    const result = await t.action(api.auth.signIn, {
      provider: "password",
      params,
    });
    expect(result.tokens?.token).toBeTruthy();
    const user = await t.run((ctx) => ctx.db.query("users").unique());
    expect(user?.email).toBe("cliente@example.test");
    expect(user?.legalVersion).toBe(LEGAL_VERSION);
    expect(user?.termsAcceptedAt).toBeGreaterThan(0);
    expect(user?.emailVerificationTime).toBeUndefined();
    const account = await t.run((ctx) => ctx.db.query("authAccounts").unique());
    expect(account?.secret).toBeTruthy();
    expect(account?.secret).not.toBe(params.password);
    const login = await t.action(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "signIn",
        email: "cliente@example.test",
        password: params.password,
      },
    });
    expect(login.tokens?.token).toBeTruthy();
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: {
          flow: "signIn",
          email: "cliente@example.test",
          password: "errada123",
        },
      }),
    ).rejects.toThrow();
  });
  it("não aceita cadastro sem os termos ou com senha curta", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { ...params, legalVersion: "" },
      }),
    ).rejects.toThrow();
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { ...params, password: "1234567" },
      }),
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
      0,
    );
  });
  it("suporte interno recupera a senha e invalida as sessões sem liberar reset público", async () => {
    const t = convexTest(schema, modules);
    await t.action(api.auth.signIn, { provider: "password", params });
    const user = await t.run((ctx) => ctx.db.query("users").unique());
    await expect(
      t.action(internal.support.resetPassword, {
        userId: user!._id,
        email: "outro@example.test",
        newPassword: "NovaSenha123!",
      }),
    ).rejects.toThrow();
    await t.action(internal.support.resetPassword, {
      userId: user!._id,
      email: "cliente@example.test",
      newPassword: "NovaSenha123!",
    });
    expect(
      await t.run((ctx) => ctx.db.query("authSessions").collect()),
    ).toHaveLength(0);
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: {
          flow: "signIn",
          email: "cliente@example.test",
          password: params.password,
        },
      }),
    ).rejects.toThrow();
    const login = await t.action(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "signIn",
        email: "cliente@example.test",
        password: "NovaSenha123!",
      },
    });
    expect(login.tokens?.token).toBeTruthy();
  });
  it("login anônimo não está disponível", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.auth.signIn, { provider: "anonymous", params: {} }),
    ).rejects.toThrow();
  });
});
