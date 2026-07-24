import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, pct, variacao } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/comparador")({
  head: () => ({ meta: [{ title: "Comparador — Contract Insight" }] }),
  component: Comparador,
});

function Comparador() {
  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*").order("numero_contrato")).data ?? [],
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["itens-all"],
    queryFn: async () => (await supabase.from("itens").select("*")).data ?? [],
  });

  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");

  const linhas = useMemo(() => {
    if (!a || !b) return [];
    const mapA = new Map<string, any>();
    const mapB = new Map<string, any>();
    (itens as any[]).filter((i) => i.contrato_id === a).forEach((i) => mapA.set(i.codigo, i));
    (itens as any[]).filter((i) => i.contrato_id === b).forEach((i) => mapB.set(i.codigo, i));
    const codigos = new Set<string>([...mapA.keys(), ...mapB.keys()]);
    return [...codigos].map((cod) => {
      const iA = mapA.get(cod), iB = mapB.get(cod);
      const pA = iA ? Number(iA.preco_atual) : null;
      const pB = iB ? Number(iB.preco_atual) : null;
      let dif = null, melhor: "A" | "B" | null = null, economia = 0;
      if (pA !== null && pB !== null) {
        dif = variacao(pB, pA);
        melhor = pA <= pB ? "A" : "B";
        economia = Math.abs(pA - pB);
      }
      return { codigo: cod, descricao: iA?.descricao ?? iB?.descricao, pA, pB, dif, melhor, economia };
    }).sort((x, y) => (y.economia ?? 0) - (x.economia ?? 0));
  }, [a, b, itens]);

  const totalEconomia = linhas.reduce((s, l) => s + (l.economia ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Comparador de Contratos</h1>
        <p className="text-muted-foreground mt-1">Compare preços entre dois contratos e identifique economia.</p>
      </div>

      <div className="glass-card rounded-xl p-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs uppercase text-muted-foreground mb-1.5 block">Contrato A</label>
          <Select value={a} onValueChange={setA}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {(contratos as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.numero_contrato} — {c.fornecedor}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs uppercase text-muted-foreground mb-1.5 block">Contrato B</label>
          <Select value={b} onValueChange={setB}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {(contratos as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.numero_contrato} — {c.fornecedor}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {a && b && (
        <>
          <div className="glass-card rounded-xl p-5">
            <div className="text-xs uppercase text-muted-foreground">Economia potencial total</div>
            <div className="text-3xl font-bold text-[oklch(0.77_0.14_82)] mt-1">{brl(totalEconomia)}</div>
            <div className="text-xs text-muted-foreground mt-1">Soma da diferença absoluta entre os preços comparáveis.</div>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card/95 backdrop-blur text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Código</th>
                    <th className="text-left p-3">Descrição</th>
                    <th className="text-right p-3">Preço A</th>
                    <th className="text-right p-3">Preço B</th>
                    <th className="text-right p-3">Diferença</th>
                    <th className="text-right p-3">Melhor</th>
                    <th className="text-right p-3">Economia</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.codigo} className="border-t border-border/40">
                      <td className="p-3 font-mono text-xs">{l.codigo}</td>
                      <td className="p-3 max-w-[260px] truncate" title={l.descricao}>{l.descricao}</td>
                      <td className={`p-3 text-right ${l.melhor === "A" ? "text-emerald-400 font-semibold" : ""}`}>{l.pA !== null ? brl(l.pA) : "—"}</td>
                      <td className={`p-3 text-right ${l.melhor === "B" ? "text-emerald-400 font-semibold" : ""}`}>{l.pB !== null ? brl(l.pB) : "—"}</td>
                      <td className="p-3 text-right">{l.dif !== null ? pct(l.dif) : "—"}</td>
                      <td className="p-3 text-right">{l.melhor ? `Contrato ${l.melhor}` : "—"}</td>
                      <td className="p-3 text-right text-[oklch(0.77_0.14_82)] font-semibold">{brl(l.economia)}</td>
                    </tr>
                  ))}
                  {linhas.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem itens para comparar.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}