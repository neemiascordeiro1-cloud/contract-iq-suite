import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Contract Insight" }] }),
  component: Config,
});

function Config() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      setEmail(data?.email ?? u.user.email ?? "");
      setNome(data?.nome ?? "");
      setPerfil(data?.perfil ?? "user");
    })();
  }, []);

  const save = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").update({ nome }).eq("id", u.user.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado.");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Dados da conta.</p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input value={email} disabled />
        </div>
        <div className="space-y-2">
          <Label>Perfil</Label>
          <Input value={perfil} disabled />
        </div>
        <Button onClick={save} disabled={loading} className="bg-[oklch(0.77_0.14_82)] text-[oklch(0.15_0.03_265)] hover:bg-[oklch(0.82_0.14_82)] font-semibold">
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}