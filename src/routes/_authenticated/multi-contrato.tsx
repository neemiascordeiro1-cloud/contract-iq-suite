import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { brl4, num, pct } from "@/lib/format";
import { Search, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/multi-contrato")({
  head: () => ({
    meta: [
      { title: "Itens em Mais de Um Contrato — Contract Insight" },
      { name: "description", content: "Identifique itens cadastrados em múltiplos contratos e compare os valores unitários entre fornecedores." },
      { property: "og:title", content: "Itens em Mais de Um Contrato — Contract Insight" },
      { property: "og:description", content: "Comparação de valores unitários de itens presentes em dois ou mais contratos." },
    ],
  }),
  component: MultiContrato,
});

function fmtData(v: any): string {
  if (!v) return "—";
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return isNaN(+d) ? "—" : d.toLocaleDateString("pt-BR");
}

export type Combo = {
  codigo: string;
  descricao: string;
  contratoA: string; fornecedorA: string; valorA: number; vencSistA: string; juridicoA: string;
  contratoB: string; fornecedorB: string; valorB: number; vencSistB: string; juridicoB: string;
  dif: number;
};

function MultiContrato() {
  const [busca, setBusca] = useState("");

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*")).data ?? [],
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["itens-all"],
    queryFn: async () => (await supabase.from("itens").select("*")).data ?? [],
  });

  const combos = useMemo<Combo[]>(() => {
    const cById = new Map((contratos as any[]).map((c) => [c.id, c]));
    const byCodigo = new Map<string, any[]>();
    for (const i of itens as any[]) {
      const c = cById.get(i.contrato_id);
      if (!c) continue;
      const arr = byCodigo.get(i.codigo) ?? [];
      arr.push({
        ...i,
        numero_contrato: c.numero_contrato,
        fornecedor: c.fornecedor,
        venc_sistemico: fmtData(c.data_vencimento_sistemico),
        contrato_juridico: c.numero_contrato_juridico ?? "—",
        preco: Number(i.preco_atual) || 0,
      });
      byCodigo.set(i.codigo, arr);
    }
    const out: Combo[] = [];
    for (const [codigo, arr] of byCodigo) {
      const uniq = new Map<string, any>();
      for (const r of arr) if (!uniq.has(r.contrato_id)) uniq.set(r.contrato_id, r);
      const list = [...uniq.values()].sort((a, b) => a.preco - b.preco);
      if (list.length < 2) continue;
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          const A = list[a], B = list[b];
          out.push({
            codigo,
            descricao: A.descricao ?? B.descricao ?? "",
            contratoA: A.numero_contrato, fornecedorA: `${A.fornecedor} · ${A.numero_contrato}`, valorA: A.preco,
            vencSistA: A.venc_sistemico, juridicoA: A.contrato_juridico,
            contratoB: B.numero_contrato, fornecedorB: `${B.fornecedor} · ${B.numero_contrato}`, valorB: B.preco,
            vencSistB: B.venc_sistemico, juridicoB: B.contrato_juridico,
            dif: A.preco > 0 ? ((B.preco - A.preco) / A.preco) * 100 : 0,
          });
        }
      }
    }
    return out.sort((x, y) => y.dif - x.dif);
  }, [itens, contratos]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return combos;
    return combos.filter((r) =>
      r.codigo.toLowerCase().includes(q) ||
      (r.descricao ?? "").toLowerCase().includes(q) ||
      r.fornecedorA.toLowerCase().includes(q) ||
      r.fornecedorB.toLowerCase().includes(q));
  }, [combos, busca]);

  const codigosUnicos = useMemo(() => new Set(filtered.map((r) => r.codigo)).size, [filtered]);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map((r) => ({
      Código: r.codigo, Descrição: r.descricao,
      "Contrato A": r.contratoA, "Fornecedor A": r.fornecedorA, "Valor Unitário A": r.valorA,
      "Venc. Contrato Sistêmico A": r.vencSistA, "Nº Contrato Jurídico A": r.juridicoA,
      "Contrato B": r.contratoB, "Fornecedor B": r.fornecedorB, "Valor Unitário B": r.valorB,
      "Venc. Contrato Sistêmico B": r.vencSistB, "Nº Contrato Jurídico B": r.juridicoB,
      "Diferença %": Number(r.dif.toFixed(2)),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Multi-Contrato");
    XLSX.writeFile(wb, "itens-multi-contrato.xlsx");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Itens em Mais de Um Contrato</h1>
        <p className="text-muted-foreground mt-1">Itens cadastrados em múltiplos contratos, com todas as combinações e a diferença percentual de valor unitário.</p>
      </div>

      <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por código, descrição ou fornecedor..." className="pl-10" />
        </div>
        <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Códigos em 2+ contratos" value={num(codigosUnicos)} />
        <Stat label="Combinações comparadas" value={num(filtered.length)} />
        <Stat label="Maior diferença" value={filtered.length ? pct(filtered[0].dif) : "—"} />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Código</th>
                <th className="text-left p-3">Descrição</th>
                <th className="text-left p-3">Contrato A</th>
                <th className="text-left p-3">Fornecedor A</th>
                <th className="text-right p-3">Valor Unit. A</th>
                <th className="text-left p-3">Venc. Contrato Sistêmico A</th>
                <th className="text-left p-3">Nº Contrato Jurídico A</th>
                <th className="text-left p-3">Contrato B</th>
                <th className="text-left p-3">Fornecedor B</th>
                <th className="text-right p-3">Valor Unit. B</th>
                <th className="text-left p-3">Venc. Contrato Sistêmico B</th>
                <th className="text-left p-3">Nº Contrato Jurídico B</th>
                <th className="text-right p-3">Diferença %</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((r, idx) => (
                <tr key={idx} className="border-t border-border/40 hover:bg-white/5">
                  <td className="p-3 font-mono text-xs">
                    <Link to="/comparador" search={{ codigo: r.codigo }} className="hover:text-[oklch(0.77_0.14_82)]">{r.codigo}</Link>
                  </td>
                  <td className="p-3 max-w-[220px] truncate" title={r.descricao}>{r.descricao}</td>
                  <td className="p-3">{r.contratoA}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.fornecedorA}</td>
                  <td className="p-3 text-right text-emerald-400 font-medium">{brl4(r.valorA)}</td>
                  <td className="p-3 text-xs whitespace-nowrap">{r.vencSistA}</td>
                  <td className="p-3 text-xs">{r.juridicoA}</td>
                  <td className="p-3">{r.contratoB}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.fornecedorB}</td>
                  <td className="p-3 text-right">{brl4(r.valorB)}</td>
                  <td className="p-3 text-xs whitespace-nowrap">{r.vencSistB}</td>
                  <td className="p-3 text-xs">{r.juridicoB}</td>
                  <td className={`p-3 text-right font-semibold ${r.dif > 0 ? "text-[oklch(0.62_0.20_25)]" : "text-emerald-400"}`}>{pct(r.dif)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={13} className="p-8 text-center text-muted-foreground">Nenhum item em mais de um contrato.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div className="p-3 text-xs text-muted-foreground border-t border-border/60">Exibindo as 500 maiores diferenças de {num(filtered.length)} combinações. Use o filtro ou exporte para Excel.</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}