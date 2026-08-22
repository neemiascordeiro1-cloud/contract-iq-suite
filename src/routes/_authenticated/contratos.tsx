import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { Search, FileSpreadsheet, FileText as FileIcon } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Contract Insight" }] }),
  component: Contratos,
});

function Contratos() {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*").order("numero_contrato")).data ?? [],
  });

  const filtered = useMemo(
    () => (contratos as any[]).filter((c) =>
      !busca || c.numero_contrato.toLowerCase().includes(busca.toLowerCase()) || c.fornecedor.toLowerCase().includes(busca.toLowerCase())
    ),
    [contratos, busca],
  );

  const contrato = (contratos as any[]).find((c) => c.id === sel);

  const { data: itens = [] } = useQuery({
    queryKey: ["itens", sel],
    queryFn: async () => sel ? ((await supabase.from("itens").select("*").eq("contrato_id", sel).order("codigo")).data ?? []) : [],
    enabled: !!sel,
  });

  const valorTotal = useMemo(() => (itens as any[]).reduce((a, i) => a + Number(i.preco_atual ?? 0), 0), [itens]);

  const exportXlsx = () => {
    if (!contrato) return;
    const ws = XLSX.utils.json_to_sheet((itens as any[]).map((i) => ({
      Código: i.codigo, Descrição: i.descricao, Unidade: i.unidade,
      "Preço Atual": Number(i.preco_atual), "Última Atualização": new Date(i.data_atualizacao).toLocaleDateString("pt-BR"),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Itens");
    XLSX.writeFile(wb, `contrato-${contrato.numero_contrato}.xlsx`);
  };

  const exportPdf = () => {
    if (!contrato) return;
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text(`Contrato ${contrato.numero_contrato}`, 14, 15);
    doc.setFontSize(10); doc.text(`Fornecedor: ${contrato.fornecedor}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Código", "Descrição", "Unid.", "Preço Atual", "Atualização"]],
      body: (itens as any[]).map((i) => [i.codigo, i.descricao ?? "", i.unidade ?? "", brl(i.preco_atual), new Date(i.data_atualizacao).toLocaleDateString("pt-BR")]),
      headStyles: { fillColor: [11, 22, 51] },
    });
    doc.save(`contrato-${contrato.numero_contrato}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contratos</h1>
        <p className="text-muted-foreground mt-1">Consulte contratos, itens e valores.</p>
      </div>

      <div className="glass-card rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar por número do contrato ou fornecedor..." className="pl-10" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card rounded-xl p-4 lg:col-span-1 max-h-[520px] overflow-auto">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Contratos ({filtered.length})</div>
          <div className="space-y-1">
            {filtered.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSel(c.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-all ${sel === c.id ? "bg-[oklch(0.77_0.14_82)]/15 border border-[oklch(0.77_0.14_82)]/40" : "hover:bg-white/5 border border-transparent"}`}
              >
                <div className="font-semibold text-sm">{c.numero_contrato}</div>
                <div className="text-xs text-muted-foreground truncate">{c.fornecedor}</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-sm text-muted-foreground p-4 text-center">Nenhum contrato.</div>}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!contrato ? (
            <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
              Selecione um contrato para ver detalhes.
            </div>
          ) : (
            <>
              <div className="glass-card rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Contrato</div>
                    <h2 className="text-2xl font-bold">{contrato.numero_contrato}</h2>
                    <div className="text-sm text-muted-foreground mt-1">{contrato.fornecedor}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
                    <Button size="sm" variant="outline" onClick={exportPdf}><FileIcon className="h-4 w-4 mr-1.5" />PDF</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Info label="Status" value={<span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-medium">{contrato.status ?? "Ativo"}</span>} />
                  <Info label="Início" value={contrato.data_inicio ? new Date(contrato.data_inicio).toLocaleDateString("pt-BR") : "—"} />
                  <Info label="Fim" value={contrato.data_fim ? new Date(contrato.data_fim).toLocaleDateString("pt-BR") : "—"} />
                  <Info label="Códigos" value={itens.length} />
                  <Info
                    label="Venc. contrato sistêmico"
                    value={contrato.data_vencimento_sistemico ? new Date(`${String(contrato.data_vencimento_sistemico).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—"}
                  />
                  <Info label="Nº contrato jurídico" value={contrato.numero_contrato_juridico ?? "—"} />
                </div>

                <div className="pt-2 border-t border-border/60">
                  <div className="text-xs uppercase text-muted-foreground">Valor total (soma dos preços atuais)</div>
                  <div className="text-2xl font-bold text-[oklch(0.77_0.14_82)]">{brl(valorTotal)}</div>
                </div>
              </div>

              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left p-3">Código</th>
                        <th className="text-left p-3">Descrição</th>
                        <th className="text-left p-3">Unid.</th>
                        <th className="text-right p-3">Preço Atual</th>
                        <th className="text-right p-3">Atualização</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(itens as any[]).map((i) => (
                        <tr key={i.id} className="border-t border-border/40 hover:bg-white/5">
                          <td className="p-3 font-mono text-xs">{i.codigo}</td>
                          <td className="p-3">{i.descricao}</td>
                          <td className="p-3">{i.unidade}</td>
                          <td className="p-3 text-right font-medium">{brl(i.preco_atual)}</td>
                          <td className="p-3 text-right text-muted-foreground">{new Date(i.data_atualizacao).toLocaleDateString("pt-BR")}</td>
                        </tr>
                      ))}
                      {itens.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Sem itens neste contrato.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}