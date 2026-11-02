import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { LEGAL_VERSION } from "@/lib/legal";
import logo from "@/assets/logo.svg";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

export default function AuthPage({
  redirectAfterAuth = "/dashboard",
}: {
  redirectAfterAuth?: string;
}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requested = searchParams.get("returnTo");
  const redirect =
    requested?.startsWith("/") &&
    !requested.startsWith("//") &&
    !requested.includes("\\")
      ? requested
      : redirectAfterAuth;
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(redirect, { replace: true });
  }, [authLoading, isAuthenticated, navigate, redirect]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("flow", flow);
    if (flow === "signUp") data.set("legalVersion", LEGAL_VERSION);
    setBusy(true);
    setError("");
    try {
      await signIn("password", data);
    } catch {
      setError(
        flow === "signIn"
          ? "E-mail ou senha incorretos. Confira os dados e tente novamente."
          : "Não foi possível criar a conta. Use uma senha de pelo menos 8 caracteres. Se já tem conta, escolha Entrar.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto">
            <img src={logo} alt="Fleet OS Pro" width={56} height={56} />
          </Link>
          <CardTitle>
            {flow === "signIn" ? "Entrar no Fleet OS Pro" : "Criar sua conta"}
          </CardTitle>
          <CardDescription>Acesse com seu e-mail e senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {flow === "signUp" && (
              <div>
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  maxLength={80}
                  required
                  disabled={busy}
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  flow === "signUp" ? "new-password" : "current-password"
                }
                minLength={8}
                maxLength={128}
                required
                disabled={busy}
              />
              {flow === "signUp" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Pelo menos 8 caracteres.
                </p>
              )}
            </div>
            {flow === "signUp" && (
              <label className="flex items-start gap-2 text-xs leading-5">
                <input
                  type="checkbox"
                  required
                  disabled={busy}
                  className="mt-1"
                />
                <span>
                  Li e aceito os{" "}
                  <Link to="/termos" target="_blank" className="underline">
                    termos de uso
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacidade" target="_blank" className="underline">
                    política de privacidade
                  </Link>
                  .
                </span>
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {flow === "signIn" ? "Entrar" : "Criar conta"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={busy}
              onClick={() => {
                setFlow(flow === "signIn" ? "signUp" : "signIn");
                setError("");
              }}
            >
              {flow === "signIn"
                ? "Ainda não tenho conta"
                : "Já tenho conta: entrar"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Esqueceu a senha? Entre em contato com o responsável pelo sistema.
              A recuperação exige confirmação da sua identidade.
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
