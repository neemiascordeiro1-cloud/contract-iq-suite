import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, TrendingUp, LineChart, ShieldCheck, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { nome } },
        });
        if (error) throw error;
        toast.success("Conta criada. Você já pode entrar.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/", replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const recover = async () => {
    if (!email) return toast.error("Digite seu e-mail acima.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de recuperação para seu e-mail.");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12"
           style={{ background: "linear-gradient(135deg, oklch(0.16 0.05 265) 0%, oklch(0.22 0.07 260) 60%, oklch(0.30 0.09 250) 100%)" }}>
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[oklch(0.77_0.14_82)]/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full bg-[oklch(0.58_0.16_245)]/25 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.77_0.14_82)] to-[oklch(0.62_0.13_60)] shadow-lg">
            <Sparkles className="h-6 w-6 text-[oklch(0.15_0.03_265)]" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">Contract Insight</div>
            <div className="text-[11px] uppercase tracking-widest text-[oklch(0.77_0.14_82)]">Procurement Intelligence</div>
          </div>
        </div>

        <div className="relative max-w-lg space-y-6">
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
            Portal Inteligente de <span className="text-[oklch(0.77_0.14_82)]">Gestão de Contratos</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed">
            Monitore preços, analise reajustes, compare contratos e identifique oportunidades de economia em tempo real.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { icon: TrendingUp, t: "Análise de Reajustes" },
              { icon: LineChart, t: "Evolução de Preços" },
              { icon: BarChart3, t: "Dashboard Executivo" },
              { icon: ShieldCheck, t: "Dados Seguros" },
            ].map(({ icon: Icon, t }) => (
              <div key={t} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <Icon className="h-5 w-5 text-[oklch(0.77_0.14_82)]" />
                <span className="text-sm font-medium">{t}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Contract Insight — Inteligência de Compras</p>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="glass-card w-full max-w-md rounded-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
            <p className="mt-1 text-sm text-muted-foreground">Acesse sua conta corporativa para continuar.</p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid w-full grid-cols-2 bg-muted/40">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <TabsContent value="signup" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
                </div>
              </TabsContent>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail corporativo</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === "signin" && (
                    <button type="button" onClick={recover} className="text-xs text-[oklch(0.77_0.14_82)] hover:text-[oklch(0.82_0.14_82)]">
                      Recuperar senha
                    </button>
                  )}
                </div>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>

              <Button
                type="submit" disabled={loading}
                className="w-full bg-[oklch(0.77_0.14_82)] text-[oklch(0.15_0.03_265)] hover:bg-[oklch(0.82_0.14_82)] font-semibold shadow-lg shadow-[oklch(0.77_0.14_82)]/20"
              >
                {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>
            </form>
          </Tabs>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Ao continuar, você concorda com os termos de uso corporativo.
          </p>
        </div>
      </div>
    </div>
  );
}