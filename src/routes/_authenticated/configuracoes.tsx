import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Contract Insight" }] }),
  component: Config,
});

function Config() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Preferências do sistema.</p>
      </div>

      <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
        Acesso aberto — sem autenticação de usuário.
      </div>
    </div>
  );
}