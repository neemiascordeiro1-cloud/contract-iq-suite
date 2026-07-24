import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Senha atualizada."); nav({ to: "/auth" }); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <form onSubmit={submit} className="glass-card w-full max-w-md space-y-4 rounded-2xl p-8">
        <h1 className="text-2xl font-bold">Nova senha</h1>
        <div className="space-y-2">
          <Label>Senha</Label>
          <Input type="password" minLength={6} required value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </div>
        <Button disabled={loading} className="w-full bg-[oklch(0.77_0.14_82)] text-[oklch(0.15_0.03_265)] hover:bg-[oklch(0.82_0.14_82)]">
          {loading ? "Salvando..." : "Salvar senha"}
        </Button>
      </form>
    </div>
  );
}