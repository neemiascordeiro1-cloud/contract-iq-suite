import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, variacao, classifyVar, varColor, pct } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reajustes")({
  head: () => ({ meta: [{ title: "Reajustes — Contract Insight" }] }),
  component: Reajustes,
});

function Reajustes() {
  const { data: itens = [] } = useQuery({
    queryKey: ["itens-all"],
    queryFn: async () => (await supabase.from("itens").select("*")).data ?? [],
  });
  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*")).data ?? [],
  });

  const linhas = useMemo(() =>
    (itens as any[]).filter((i) => i.preco_anterior > 0).map((i) => {
      const c = (contratos as any[]).find((x) => x.id === i.contrato_id);
      const v = variacao(Number(i.preco_atual), Number(i.preco_anterior));
      return {
        id: i.id, codigo: i.codigo, descricao: i.descricao, fornecedor: c?.fornecedor ?? "—",
        antigo: Number(i.preco_anterior), novo: Number(i.preco_atual), v,
        impacto: Number(i.preco_atual) - Number(i.preco_anterior),
      };
    }), [itens, contratos]);

  const alertas = linhas.filter((l) => l.v > 15);
  const top20A = [...linhas].sort((a, b) => b.v - a.v).slice(0, 20);
  const top20R = [...linhas].sort((a, b) => a.v - b.v).slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Análise de Reajustes</h1>
        <p className="text-muted-foreground mt-1">Classificação automática por faixa de variação.</p>
      </div>

      {alertas.length > 0 && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-orange-300">{alertas.length} item(ns) com reajuste acima de 15%</div>
            <div className="text-sm text-orange-200/80">Revise essas variações — impacto significativo detectado.</div>
          </div>
        </div>
      )}

      <div className="glass-card rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Legend cor="bg-emerald-500" label="0 a 5% — Verde" />
        <Legend cor="bg-[oklch(0.77_0.14_82)]" label="5 a 15% — Dourado" />
        <Legend cor="bg-orange-500" label="Acima de 15% — Laranja" />
        <Legend cor="bg-sky-500" label="Redução — Azul" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tabela titulo="Top 20 Maiores Aumentos" rows={top20A} />
        <Tabela titulo="Top 20 Maiores Reduções" rows={top20R} />
      </div>
    </div>
  );
}

function Legend({ cor, label }: { cor: string; label: string }) {
  return <div className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${cor}`} /><span>{label}</span></div>;
}

function Tabela({ titulo, rows }: { titulo: string; rows: any[] }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border/60"><h3 className="font-semibold">{titulo}</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Código</th>
              <th className="text-left p-3">Fornecedor</th>
              <th className="text-right p-3">Antigo</th>
              <th className="text-right p-3">Novo</th>
              <th className="text-right p-3">Var.</th>
              <th className="text-right p-3">Impacto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cls = varColor[classifyVar(r.v)];
              return (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="p-3 font-mono text-xs">{r.codigo}</td>
                  <td className="p-3 text-xs truncate max-w-[140px]" title={r.fornecedor}>{r.fornecedor}</td>
                  <td className="p-3 text-right">{brl(r.antigo)}</td>
                  <td className="p-3 text-right">{brl(r.novo)}</td>
                  <td className={`p-3 text-right font-semibold ${cls}`}>{pct(r.v)}</td>
                  <td className={`p-3 text-right ${r.impacto > 0 ? "text-orange-400" : "text-emerald-400"}`}>{brl(r.impacto)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem dados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}