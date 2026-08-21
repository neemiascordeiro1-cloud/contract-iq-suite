import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DATASET_RESET_EVENT } from "@/lib/dataset";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { brl, variacao, classifyVar, varColor, pct } from "@/lib/format";
import { Search } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/itens")({
  head: () => ({ meta: [{ title: "Itens — Contract Insight" }] }),
  component: Itens,
});

function Itens() {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    const onReset = () => { setSel(null); setBusca(""); };
    window.addEventListener(DATASET_RESET_EVENT, onReset);
    return () => window.removeEventListener(DATASET_RESET_EVENT, onReset);
  }, []);


  const { data: itens = [] } = useQuery({
    queryKey: ["itens-all"],
    queryFn: async () => (await supabase.from("itens").select("*").order("codigo")).data ?? [],
  });
  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*")).data ?? [],
  });

  const filtered = useMemo(() => {
    const b = busca.toLowerCase();
    return (itens as any[]).filter((i) => {
      if (!b) return true;
      const c = (contratos as any[]).find((x) => x.id === i.contrato_id);
      return i.codigo.toLowerCase().includes(b)
        || (i.descricao ?? "").toLowerCase().includes(b)
        || (c?.numero_contrato ?? "").toLowerCase().includes(b)
        || (c?.fornecedor ?? "").toLowerCase().includes(b);
    }).slice(0, 300);
  }, [itens, contratos, busca]);

  const item = (itens as any[]).find((i) => i.id === sel);
  const contrato = item && (contratos as any[]).find((c) => c.id === item.contrato_id);

  const { data: hist = [] } = useQuery({
    queryKey: ["hist-item", item?.codigo],
    queryFn: async () => item ? ((await supabase.from("historico_precos").select("*").eq("codigo", item.codigo).order("data_referencia")).data ?? []) : [],
    enabled: !!item,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Itens</h1>
        <p className="text-muted-foreground mt-1">Consulte códigos, preços e histórico.</p>
      </div>

      <div className="glass-card rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar por código, descrição, contrato ou fornecedor..." className="pl-10" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="glass-card rounded-xl overflow-hidden lg:col-span-3">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/95 backdrop-blur text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Código</th>
                  <th className="text-left p-3">Descrição</th>
                  <th className="text-left p-3">Contrato</th>
                  <th className="text-right p-3">Preço Atual</th>
                  <th className="text-right p-3">Anterior</th>
                  <th className="text-right p-3">Var.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i: any) => {
                  const c = (contratos as any[]).find((x) => x.id === i.contrato_id);
                  const v = i.preco_anterior > 0 ? variacao(Number(i.preco_atual), Number(i.preco_anterior)) : null;
                  const cls = v !== null ? varColor[classifyVar(v)] : "";
                  return (
                    <tr key={i.id} onClick={() => setSel(i.id)}
                        className={`border-t border-border/40 cursor-pointer hover:bg-white/5 ${sel === i.id ? "bg-[oklch(0.77_0.14_82)]/10" : ""}`}>
                      <td className="p-3 font-mono text-xs">{i.codigo}</td>
                      <td className="p-3 max-w-[280px] truncate" title={i.descricao}>{i.descricao}</td>
                      <td className="p-3 text-xs text-muted-foreground">{c?.numero_contrato}</td>
                      <td className="p-3 text-right font-medium">{brl(i.preco_atual)}</td>
                      <td className="p-3 text-right text-muted-foreground">{i.preco_anterior ? brl(i.preco_anterior) : "—"}</td>
                      <td className={`p-3 text-right font-medium ${cls}`}>{v !== null ? pct(v) : "—"}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum item.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 lg:col-span-2">
          {!item ? (
            <div className="text-center text-muted-foreground py-12">Selecione um item para ver detalhes e histórico.</div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Código</div>
                <div className="font-mono font-bold text-lg">{item.codigo}</div>
                <div className="text-sm mt-1">{item.descricao}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-[10px] uppercase text-muted-foreground">Contrato</div><div>{contrato?.numero_contrato}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Fornecedor</div><div className="truncate">{contrato?.fornecedor}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Unidade</div><div>{item.unidade ?? "—"}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Atualizado</div><div>{new Date(item.data_atualizacao).toLocaleDateString("pt-BR")}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Preço Atual</div><div className="text-[oklch(0.77_0.14_82)] font-bold">{brl(item.preco_atual)}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Último Preço</div><div>{item.preco_anterior ? brl(item.preco_anterior) : "—"}</div></div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-2">Histórico</div>
                {hist.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">Sem histórico ainda.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={(hist as any[]).map((h) => ({ d: new Date(h.data_referencia).toLocaleDateString("pt-BR"), p: Number(h.preco) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                      <XAxis dataKey="d" stroke="oklch(0.72 0.03 265)" fontSize={10} />
                      <YAxis stroke="oklch(0.72 0.03 265)" fontSize={10} />
                      <Tooltip contentStyle={{ background: "oklch(0.19 0.05 265)", border: "1px solid oklch(0.77 0.14 82 / 0.3)", borderRadius: 8 }} formatter={(v: any) => brl(v)} />
                      <Line type="monotone" dataKey="p" stroke="oklch(0.77 0.14 82)" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}