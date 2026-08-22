import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, num, pct } from "@/lib/format";
import { analisePorFornecedor, tipoCompraDoItem } from "@/lib/compras";
import { Search, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/analise-fornecedores")({
  head: () => ({
    meta: [
      { title: "Análise de Compras por Fornecedor — Contract Insight" },
      { name: "description", content: "Valor total comprado, quantidade e participação percentual de cada fornecedor sobre o total de compras." },
      { property: "og:title", content: "Análise de Compras por Fornecedor — Contract Insight" },
      { property: "og:description", content: "Ranking de fornecedores por valor comprado e volume, com participação percentual." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnaliseFornecedores,
});


const ALL = "__all__";

function AnaliseFornecedores() {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState(ALL);

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*")).data ?? [],
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["itens-all"],
    queryFn: async () => (await supabase.from("itens").select("*")).data ?? [],
  });

  const tipos = useMemo(
    () => [...new Set((itens as any[]).map((i) => tipoCompraDoItem(i)))].sort((a, b) => a.localeCompare(b)),
    [itens],
  );

  const linhas = useMemo(() => {
    const base = tipo === ALL ? (itens as any[]) : (itens as any[]).filter((i) => tipoCompraDoItem(i) === tipo);
    const l = analisePorFornecedor(base, contratos as any[]);
    const q = busca.trim().toLowerCase();
    return q ? l.filter((r) => r.fornecedor.toLowerCase().includes(q)) : l;
  }, [itens, contratos, tipo, busca]);

  const totalValor = useMemo(() => linhas.reduce((s, l) => s + l.valorTotal, 0), [linhas]);
  const totalQtd = useMemo(() => linhas.reduce((s, l) => s + l.quantidade, 0), [linhas]);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(linhas.map((r) => ({
      Fornecedor: r.fornecedor,
      "Total Comprado (R$)": Number(r.valorTotal.toFixed(2)),
      "Quantidade Comprada": r.quantidade,
      "% da Quantidade Total": Number(r.pctQuantidade.toFixed(2)),
      "% do Valor Total": Number(r.pctValor.toFixed(2)),
      Contratos: r.contratos,
      Itens: r.itens,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Compras por Fornecedor");
    XLSX.writeFile(wb, "analise-compras-fornecedor.xlsx");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Análise de Compras por Fornecedor</h1>
        <p className="text-muted-foreground mt-1">
          Um fornecedor por linha, com valor total comprado, quantidade e participação sobre o total da base de compras.
        </p>
      </div>

      <div className="glass-card rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar fornecedor..." className="pl-10" />
        </div>
        <div className="min-w-[200px]">
          <label className="text-xs uppercase text-muted-foreground mb-1.5 block">Tipo de compra</label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Fornecedores" value={num(linhas.length)} />
        <Stat label="Valor total comprado" value={brl(totalValor)} />
        <Stat label="Quantidade total comprada" value={num(totalQtd)} />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Fornecedor</th>
                <th className="text-right p-3">Total Comprado (R$)</th>
                <th className="text-right p-3">Quantidade Comprada</th>
                <th className="text-right p-3">% da Quantidade Total</th>
                <th className="text-right p-3">% do Valor Total</th>
                <th className="text-right p-3">Contratos</th>
                <th className="text-right p-3">Itens</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((r) => (
                <tr key={r.fornecedor} className="border-t border-border/40 hover:bg-white/5">
                  <td className="p-3 font-medium">
                    <Link to="/fornecedor" search={{ nome: r.fornecedor }} className="hover:text-[oklch(0.77_0.14_82)]">
                      {r.fornecedor}
                    </Link>
                  </td>
                  <td className="p-3 text-right font-semibold text-[oklch(0.77_0.14_82)]">{brl(r.valorTotal)}</td>
                  <td className="p-3 text-right">{num(r.quantidade)}</td>
                  <td className="p-3 text-right text-sky-400">{pct(r.pctQuantidade)}</td>
                  <td className="p-3 text-right text-emerald-400">{pct(r.pctValor)}</td>
                  <td className="p-3 text-right text-muted-foreground">{num(r.contratos)}</td>
                  <td className="p-3 text-right text-muted-foreground">{num(r.itens)}</td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Sem dados de compras.</td></tr>
              )}
            </tbody>
            {linhas.length > 0 && (
              <tfoot>
                <tr className="border-t border-border/60 bg-white/5 font-semibold">
                  <td className="p-3">Total</td>
                  <td className="p-3 text-right">{brl(totalValor)}</td>
                  <td className="p-3 text-right">{num(totalQtd)}</td>
                  <td className="p-3 text-right">{pct(100)}</td>
                  <td className="p-3 text-right">{pct(100)}</td>
                  <td className="p-3" />
                  <td className="p-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
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
