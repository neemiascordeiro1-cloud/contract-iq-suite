import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, num, pct, variacao } from "@/lib/format";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileSpreadsheet, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Contract Insight" }] }),
  component: Relatorios,
});

type Tipo = "contratos" | "itens" | "reajustes" | "fornecedores" | "economia";

function Relatorios() {
  const [tipo, setTipo] = useState<Tipo>("contratos");
  const { data: contratos = [] } = useQuery({ queryKey: ["contratos"], queryFn: async () => (await supabase.from("contratos").select("*")).data ?? [] });
  const { data: itens = [] } = useQuery({ queryKey: ["itens-all"], queryFn: async () => (await supabase.from("itens").select("*")).data ?? [] });

  const rows = useMemo(() => {
    const list: any[] = [];
    if (tipo === "contratos") {
      for (const c of contratos as any[]) {
        const qtd = (itens as any[]).filter((i) => i.contrato_id === c.id).length;
        const total = (itens as any[]).filter((i) => i.contrato_id === c.id).reduce((s, i) => s + Number(i.preco_atual ?? 0), 0);
        list.push({ Contrato: c.numero_contrato, Fornecedor: c.fornecedor, Status: c.status, Itens: qtd, "Valor Total": total });
      }
    } else if (tipo === "itens") {
      for (const i of itens as any[]) {
        const c = (contratos as any[]).find((x) => x.id === i.contrato_id);
        list.push({ Código: i.codigo, Descrição: i.descricao, Unidade: i.unidade, Contrato: c?.numero_contrato, Fornecedor: c?.fornecedor, "Preço Atual": Number(i.preco_atual) });
      }
    } else if (tipo === "reajustes") {
      for (const i of (itens as any[]).filter((x) => x.preco_anterior > 0)) {
        const c = (contratos as any[]).find((x) => x.id === i.contrato_id);
        const v = variacao(Number(i.preco_atual), Number(i.preco_anterior));
        list.push({ Código: i.codigo, Fornecedor: c?.fornecedor, Antigo: Number(i.preco_anterior), Novo: Number(i.preco_atual), "Var %": v });
      }
    } else if (tipo === "fornecedores") {
      const map: Record<string, { qtd: number; total: number }> = {};
      for (const i of itens as any[]) {
        const c = (contratos as any[]).find((x) => x.id === i.contrato_id);
        if (!c) continue;
        map[c.fornecedor] = map[c.fornecedor] || { qtd: 0, total: 0 };
        map[c.fornecedor].qtd++; map[c.fornecedor].total += Number(i.preco_atual);
      }
      for (const [k, v] of Object.entries(map)) list.push({ Fornecedor: k, Itens: v.qtd, "Valor Total": v.total });
    } else if (tipo === "economia") {
      for (const i of (itens as any[]).filter((x) => x.preco_anterior > 0 && x.preco_atual < x.preco_anterior)) {
        const c = (contratos as any[]).find((x) => x.id === i.contrato_id);
        list.push({ Código: i.codigo, Fornecedor: c?.fornecedor, Antigo: Number(i.preco_anterior), Novo: Number(i.preco_atual), Economia: Number(i.preco_anterior) - Number(i.preco_atual) });
      }
    }
    return list;
  }, [tipo, contratos, itens]);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipo);
    XLSX.writeFile(wb, `relatorio-${tipo}.xlsx`);
  };
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14); doc.text(`Relatório — ${tipo}`, 14, 14);
    const cols = Object.keys(rows[0] ?? { info: "sem dados" });
    autoTable(doc, {
      startY: 20,
      head: [cols],
      body: rows.map((r) => cols.map((c) => {
        const v = r[c];
        return typeof v === "number" ? (c.toLowerCase().includes("var") ? pct(v) : brl(v)) : v ?? "";
      })),
      headStyles: { fillColor: [11, 22, 51] },
      styles: { fontSize: 8 },
    });
    doc.save(`relatorio-${tipo}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Gere relatórios exportáveis para Excel ou PDF.</p>
      </div>

      <div className="glass-card rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs uppercase text-muted-foreground mb-1.5 block">Tipo</label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contratos">Contratos</SelectItem>
              <SelectItem value="itens">Itens</SelectItem>
              <SelectItem value="reajustes">Reajustes</SelectItem>
              <SelectItem value="fornecedores">Fornecedores</SelectItem>
              <SelectItem value="economia">Economia Potencial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
        <Button variant="outline" onClick={exportPdf}><FileText className="h-4 w-4 mr-1.5" />PDF</Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-3 text-xs text-muted-foreground border-b border-border/60">{num(rows.length)} registro(s)</div>
        <div className="overflow-x-auto max-h-[560px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur text-xs uppercase text-muted-foreground">
              <tr>{Object.keys(rows[0] ?? {}).map((c) => <th key={c} className="text-left p-3">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border/40">
                  {Object.entries(r).map(([k, v]: any) => (
                    <td key={k} className="p-3">{typeof v === "number" ? (k.toLowerCase().includes("var") ? pct(v) : brl(v)) : v}</td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="p-8 text-center text-muted-foreground">Sem dados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}