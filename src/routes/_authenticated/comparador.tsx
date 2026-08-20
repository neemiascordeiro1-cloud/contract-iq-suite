import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { brl4, num, pct } from "@/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comparador")({
  validateSearch: (search: Record<string, unknown>): { codigo: string } => ({
    codigo: typeof search.codigo === "string" ? search.codigo : "",
  }),
  head: () => ({
    meta: [
      { title: "Comparativo por Item — Contract Insight" },
      { name: "description", content: "Compare o valor unitário de um item entre todos os contratos em que ele aparece." },
      { property: "og:title", content: "Comparativo por Item — Contract Insight" },
      { property: "og:description", content: "Informe o código do item e veja os contratos, fornecedores e diferenças percentuais." },
    ],
  }),
  component: Comparador,
});

function Comparador() {
  const { codigo } = Route.useSearch();
  const navigate = useNavigate({ from: "/comparador" });
  const [termo, setTermo] = useState(codigo);

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*")).data ?? [],
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["itens-all"],
    queryFn: async () => (await supabase.from("itens").select("*")).data ?? [],
  });

  const codigosDisponiveis = useMemo(() => {
    const set = new Map<string, number>();
    for (const i of itens as any[]) set.set(i.codigo, (set.get(i.codigo) ?? 0) + 1);
    return [...set.entries()].filter(([, n]) => n >= 2).map(([c]) => c).sort();
  }, [itens]);

  const linhas = useMemo(() => {
    const cod = codigo.trim().toUpperCase();
    if (!cod) return [];
    const cById = new Map((contratos as any[]).map((c) => [c.id, c]));
    const rows = (itens as any[])
      .filter((i) => String(i.codigo).toUpperCase() === cod)
      .map((i) => {
        const c = cById.get(i.contrato_id);
        return {
          id: i.id,
          descricao: i.descricao ?? "",
          unidade: i.unidade ?? "",
          contrato: c?.numero_contrato ?? "—",
          contratoId: i.contrato_id,
          fornecedor: c?.fornecedor ?? "—",
          preco: Number(i.preco_atual) || 0,
          data: i.data_atualizacao,
        };
      })
      .sort((a, b) => a.preco - b.preco);
    const menor = rows[0]?.preco ?? 0;
    return rows.map((r) => ({ ...r, dif: menor > 0 ? ((r.preco - menor) / menor) * 100 : 0, melhor: r.preco === menor }));
  }, [codigo, itens, contratos]);

  const buscar = (v: string) => navigate({ search: { codigo: v.trim() } });
  const descricao = linhas[0]?.descricao;
  const maiorDif = linhas.at(-1)?.dif ?? 0;
  const economia = linhas.length > 1 ? (linhas.at(-1)!.preco - linhas[0].preco) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Comparativo por Item</h1>
        <p className="text-muted-foreground mt-1">Informe o código do item para ver todos os contratos em que ele aparece e comparar os valores unitários.</p>
      </div>

      <div className="glass-card rounded-xl p-4">
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(e) => { e.preventDefault(); buscar(termo); }}
        >
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              list="codigos-multi"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Código do item (ex.: 100234)"
              className="pl-10 font-mono"
            />
            <datalist id="codigos-multi">
              {codigosDisponiveis.slice(0, 500).map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <Button type="submit">Comparar</Button>
        </form>
        <div className="mt-2 text-xs text-muted-foreground">{num(codigosDisponiveis.length)} código(s) presentes em dois ou mais contratos.</div>
      </div>

      {!codigo.trim() ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">Informe um código de item para iniciar a comparação.</div>
      ) : linhas.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">Nenhum item encontrado para o código <b className="font-mono">{codigo}</b>.</div>
      ) : linhas.length === 1 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          O item <b className="font-mono">{codigo}</b> está em apenas um contrato ({linhas[0].contrato} · {linhas[0].fornecedor}) — valor unitário {brl4(linhas[0].preco)}.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Item" value={codigo} hint={descricao} />
            <Stat label="Contratos encontrados" value={num(linhas.length)} hint="Item presente em múltiplos contratos" />
            <Stat label="Maior diferença" value={pct(maiorDif)} hint={`Economia potencial unitária ${brl4(economia)}`} />
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Contrato</th>
                    <th className="text-left p-3">Fornecedor</th>
                    <th className="text-left p-3">Descrição</th>
                    <th className="text-left p-3">Unid.</th>
                    <th className="text-right p-3">Valor Unitário</th>
                    <th className="text-right p-3">Diferença % (vs. menor)</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id} className={`border-t border-border/40 ${l.melhor ? "bg-emerald-500/5" : ""}`}>
                      <td className="p-3 font-semibold">{l.contrato}</td>
                      <td className="p-3">{l.fornecedor}</td>
                      <td className="p-3 max-w-[260px] truncate" title={l.descricao}>{l.descricao}</td>
                      <td className="p-3">{l.unidade}</td>
                      <td className={`p-3 text-right font-medium ${l.melhor ? "text-emerald-400" : ""}`}>{brl4(l.preco)}</td>
                      <td className={`p-3 text-right font-semibold ${l.dif > 0 ? "text-[oklch(0.62_0.20_25)]" : "text-emerald-400"}`}>
                        {l.melhor ? "Melhor preço" : pct(l.dif)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1 truncate">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1 truncate" title={hint}>{hint}</div>}
    </div>
  );
}