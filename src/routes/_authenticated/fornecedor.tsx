import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { brl, brl4, num, pct } from "@/lib/format";
import { ArrowLeft, FileSpreadsheet, FileText as FileIcon } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/fornecedor")({
  validateSearch: (search: Record<string, unknown>) => ({
    nome: typeof search.nome === "string" ? search.nome : "",
  }),
  head: () => ({
    meta: [
      { title: "Detalhamento do Fornecedor — Contract Insight" },
      { name: "description", content: "Contratos, itens, spend e saving detalhados por fornecedor." },
      { property: "og:title", content: "Detalhamento do Fornecedor — Contract Insight" },
      { property: "og:description", content: "Visão consolidada de contratos e itens de um fornecedor." },
    ],
  }),
  component: FornecedorDetalhe,
});

function FornecedorDetalhe() {
  const { nome } = Route.useSearch();

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*").order("numero_contrato")).data ?? [],
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["itens-all"],
    queryFn: async () => (await supabase.from("itens").select("*")).data ?? [],
  });

  const doFornecedor = useMemo(
    () => (contratos as any[]).filter((c) => c.fornecedor === nome),
    [contratos, nome],
  );
  const ids = useMemo(() => new Set(doFornecedor.map((c) => c.id)), [doFornecedor]);
  const linhas = useMemo(() => {
    const byId = new Map(doFornecedor.map((c) => [c.id, c]));
    return (itens as any[])
      .filter((i) => ids.has(i.contrato_id))
      .map((i) => {
        const atual = Number(i.preco_atual) || 0;
        const ant = Number(i.preco_anterior) || 0;
        return {
          ...i,
          preco: atual,
          anterior: ant,
          variacao: ant > 0 ? ((atual - ant) / ant) * 100 : 0,
          numero_contrato: byId.get(i.contrato_id)?.numero_contrato ?? "—",
        };
      })
      .sort((a, b) => a.numero_contrato.localeCompare(b.numero_contrato) || a.codigo.localeCompare(b.codigo));
  }, [itens, ids, doFornecedor]);

  const spend = linhas.reduce((s, i) => s + i.preco, 0);
  const saving = linhas.reduce((s, i) => s + (i.anterior > 0 && i.preco < i.anterior ? i.anterior - i.preco : 0), 0);
  const codigos = new Set(linhas.map((i) => i.codigo)).size;

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(linhas.map((i) => ({
      Contrato: i.numero_contrato, Código: i.codigo, Descrição: i.descricao, Unidade: i.unidade,
      "Preço Anterior": i.anterior, "Preço Atual": i.preco, "Variação %": Number(i.variacao.toFixed(2)),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Itens");
    XLSX.writeFile(wb, `fornecedor-${nome || "sem-nome"}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14); doc.text(`Fornecedor: ${nome || "—"}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Contratos: ${doFornecedor.length}  ·  Itens: ${linhas.length}  ·  Spend: ${brl(spend)}  ·  Saving: ${brl(saving)}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Contrato", "Código", "Descrição", "Unid.", "Preço Anterior", "Preço Atual", "Var %"]],
      body: linhas.map((i) => [i.numero_contrato, i.codigo, i.descricao ?? "", i.unidade ?? "", brl4(i.anterior), brl4(i.preco), pct(i.variacao)]),
      headStyles: { fillColor: [11, 22, 51] },
      styles: { fontSize: 8 },
    });
    doc.save(`fornecedor-${nome || "sem-nome"}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />Voltar ao dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-1">{nome || "Fornecedor não informado"}</h1>
          <p className="text-muted-foreground mt-1">Detalhamento de contratos e itens do fornecedor.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
          <Button size="sm" variant="outline" onClick={exportPdf}><FileIcon className="h-4 w-4 mr-1.5" />PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card label="Contratos" value={num(doFornecedor.length)} />
        <Card label="Itens" value={num(linhas.length)} />
        <Card label="Códigos Únicos" value={num(codigos)} />
        <Card label="Spend Total" value={brl(spend)} tone="text-sky-400" />
        <Card label="Saving" value={brl(saving)} tone="text-emerald-400" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card rounded-xl p-4 max-h-[560px] overflow-auto">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Contratos ({doFornecedor.length})</div>
          <div className="space-y-1">
            {doFornecedor.map((c: any) => {
              const qtd = linhas.filter((i) => i.contrato_id === c.id).length;
              const tot = linhas.filter((i) => i.contrato_id === c.id).reduce((s, i) => s + i.preco, 0);
              return (
                <div key={c.id} className="rounded-lg px-3 py-2.5 border border-transparent hover:bg-white/5">
                  <div className="font-semibold text-sm">{c.numero_contrato}</div>
                  <div className="text-xs text-muted-foreground">{num(qtd)} item(ns) · {brl(tot)}</div>
                </div>
              );
            })}
            {doFornecedor.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhum contrato encontrado.</div>}
          </div>
        </div>

        <div className="glass-card rounded-xl overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto max-h-[560px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/95 backdrop-blur text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Contrato</th>
                  <th className="text-left p-3">Código</th>
                  <th className="text-left p-3">Descrição</th>
                  <th className="text-left p-3">Unid.</th>
                  <th className="text-right p-3">Preço Anterior</th>
                  <th className="text-right p-3">Preço Atual</th>
                  <th className="text-right p-3">Var %</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((i) => (
                  <tr key={i.id} className="border-t border-border/40 hover:bg-white/5">
                    <td className="p-3 text-xs">{i.numero_contrato}</td>
                    <td className="p-3 font-mono text-xs">{i.codigo}</td>
                    <td className="p-3 max-w-[240px] truncate" title={i.descricao}>{i.descricao}</td>
                    <td className="p-3 text-xs">{i.unidade}</td>
                    <td className="p-3 text-right text-muted-foreground">{i.anterior ? brl4(i.anterior) : "—"}</td>
                    <td className="p-3 text-right font-medium">{brl4(i.preco)}</td>
                    <td className={`p-3 text-right font-semibold ${i.variacao > 0 ? "text-[oklch(0.62_0.20_25)]" : i.variacao < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {i.anterior ? pct(i.variacao) : "—"}
                    </td>
                  </tr>
                ))}
                {linhas.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum item para este fornecedor.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-1 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}