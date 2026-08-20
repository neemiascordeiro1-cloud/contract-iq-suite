import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileUp, Trash2, Play, ShieldAlert, FileSpreadsheet, FileText, FileType2, Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { extractText } from "@/lib/doc-extract";
import { compararContratos, recomendacoes, type Resultado, type Nivel } from "@/lib/contract-diff";
import { analisarRiscosIA } from "@/lib/analise-ia.functions";

export const Route = createFileRoute("/_authenticated/analisador")({
  head: () => ({
    meta: [
      { title: "Analisador de Contratos — Contract Insight" },
      { name: "description", content: "Compare duas versões de contrato em PDF ou Word, identifique alterações de cláusulas, valores e prazos e gere um relatório de riscos." },
      { property: "og:title", content: "Analisador de Contratos — Contract Insight" },
      { property: "og:description", content: "Comparação automática de versões de contrato com painel de riscos e exportação em PDF, Word e Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Analisador,
});

type Doc = { file: File; texto: string } | null;

const nivelClass: Record<Nivel, string> = {
  Alto: "bg-[oklch(0.62_0.20_25)]/15 text-[oklch(0.72_0.18_25)] border-[oklch(0.62_0.20_25)]/40",
  "Médio": "bg-[oklch(0.72_0.16_55)]/15 text-[oklch(0.80_0.14_60)] border-[oklch(0.72_0.16_55)]/40",
  Baixo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
};

function Analisador() {
  const [antigo, setAntigo] = useState<Doc>(null);
  const [atual, setAtual] = useState<Doc>(null);
  const [carregando, setCarregando] = useState<"antigo" | "atual" | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [usouIA, setUsouIA] = useState(false);
  const analisarIA = useServerFn(analisarRiscosIA);

  const carregar = async (which: "antigo" | "atual", file: File) => {
    setCarregando(which);
    try {
      const texto = await extractText(file);
      if (texto.trim().length < 50) throw new Error("Não foi possível extrair texto do arquivo (PDF pode ser digitalizado/imagem).");
      const doc = { file, texto };
      which === "antigo" ? setAntigo(doc) : setAtual(doc);
      setRes(null);
      toast.success(`${file.name} carregado`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao ler arquivo");
    } finally {
      setCarregando(null);
    }
  };

  const analisar = async () => {
    if (!antigo || !atual) return;
    setAnalisando(true);
    setUsouIA(false);
    try {
      const r = compararContratos(antigo.texto, atual.texto);
      setRes(r);
      // Enriquecimento por IA nas 40 alterações mais relevantes
      const itens = r.alteracoes.slice(0, 40).map((a) => ({
        id: a.id, tipo: a.tipo, categoria: a.categoria,
        original: a.original, alterado: a.alterado,
      }));
      if (itens.length) {
        const ia = await analisarIA({ data: { itens } });
        if (ia.ok && ia.riscos.length) {
          const map = new Map<number, any>(ia.riscos.map((x: any) => [Number(x.id), x]));
          const enriquecidas = r.alteracoes.map((a) => {
            const x = map.get(a.id);
            if (!x) return a;
            return {
              ...a,
              risco: (["Alto", "Médio", "Baixo"].includes(x.risco) ? x.risco : a.risco) as Nivel,
              justificativa: x.justificativa || a.justificativa,
              impacto: x.impacto || a.impacto,
              descricao: x.descricao || a.descricao,
            };
          });
          const alto = enriquecidas.filter((a) => a.risco === "Alto").length;
          const medio = enriquecidas.filter((a) => a.risco === "Médio").length;
          const baixo = enriquecidas.filter((a) => a.risco === "Baixo").length;
          const bruto = alto * 10 + medio * 4 + baixo;
          const score = Math.min(100, Math.round((bruto / Math.max(10, (r.resumo.clausulasAntigo + r.resumo.clausulasAtual) / 2)) * 12));
          const ordem: Record<Nivel, number> = { Alto: 0, "Médio": 1, Baixo: 2 };
          setRes({
            alteracoes: [...enriquecidas].sort((a, b) => ordem[a.risco] - ordem[b.risco]),
            resumo: { ...r.resumo, alto, medio, baixo, score },
          });
          setUsouIA(true);
        } else if (!ia.ok) {
          toast.warning(`Análise jurídica por IA indisponível: ${ia.message} Exibindo análise automática por regras.`);
        }
      }
      toast.success("Análise concluída");
    } catch (e: any) {
      toast.error(e.message ?? "Erro na análise");
    } finally {
      setAnalisando(false);
    }
  };

  const linhas = () => (res?.alteracoes ?? []).map((a) => ({
    "#": a.id, Tipo: a.tipo, Categoria: a.categoria, Risco: a.risco, Cláusula: a.titulo,
    "Trecho original": a.original.slice(0, 800), "Trecho alterado": a.alterado.slice(0, 800),
    "Descrição": a.descricao, "Justificativa do risco": a.justificativa, "Impacto": a.impacto,
    "Valores antes": a.valores.de.join("; "), "Valores depois": a.valores.para.join("; "),
    "Datas/prazos antes": a.datas.de.join("; "), "Datas/prazos depois": a.datas.para.join("; "),
  }));

  const exportXlsx = () => {
    if (!res) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Indicador: "Cláusulas (antigo)", Valor: res.resumo.clausulasAntigo },
      { Indicador: "Cláusulas (atual)", Valor: res.resumo.clausulasAtual },
      { Indicador: "Total de alterações", Valor: res.resumo.total },
      { Indicador: "Adicionadas", Valor: res.resumo.adicionadas },
      { Indicador: "Removidas", Valor: res.resumo.removidas },
      { Indicador: "Alteradas", Valor: res.resumo.alteradas },
      { Indicador: "Riscos altos", Valor: res.resumo.alto },
      { Indicador: "Riscos médios", Valor: res.resumo.medio },
      { Indicador: "Riscos baixos", Valor: res.resumo.baixo },
      { Indicador: "Score geral de risco", Valor: res.resumo.score },
    ]), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas()), "Alterações");
    XLSX.writeFile(wb, "analise-contratos.xlsx");
  };

  const exportPdf = () => {
    if (!res) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(15); doc.text("Analisador de Contratos — Relatório Executivo", 14, 14);
    doc.setFontSize(9);
    doc.text(`Antigo: ${antigo?.file.name ?? "—"}   |   Atual: ${atual?.file.name ?? "—"}`, 14, 21);
    doc.text(
      `Alterações: ${res.resumo.total}  ·  Adicionadas: ${res.resumo.adicionadas}  ·  Removidas: ${res.resumo.removidas}  ·  Alteradas: ${res.resumo.alteradas}  ·  Riscos: ${res.resumo.alto} altos / ${res.resumo.medio} médios / ${res.resumo.baixo} baixos  ·  Score: ${res.resumo.score}/100`,
      14, 27,
    );
    autoTable(doc, {
      startY: 33,
      head: [["#", "Tipo", "Categoria", "Risco", "Cláusula", "Original", "Alterado", "Justificativa", "Impacto"]],
      body: res.alteracoes.map((a) => [
        a.id, a.tipo, a.categoria, a.risco, a.titulo,
        a.original.slice(0, 300), a.alterado.slice(0, 300), a.justificativa, a.impacto,
      ]),
      headStyles: { fillColor: [11, 22, 51] },
      styles: { fontSize: 7, cellWidth: "wrap" },
      columnStyles: { 5: { cellWidth: 55 }, 6: { cellWidth: 55 }, 7: { cellWidth: 40 }, 8: { cellWidth: 35 } },
    });
    const y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(11); doc.text("Recomendações Finais", 14, y);
    doc.setFontSize(9);
    recomendacoes(res).forEach((r, i) => doc.text(`• ${r}`, 14, y + 6 + i * 5));
    doc.save("analise-contratos.pdf");
  };

  const exportWord = () => {
    if (!res) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>
      body{font-family:Arial;font-size:11pt} h1{font-size:16pt} h2{font-size:13pt}
      table{border-collapse:collapse;width:100%} td,th{border:1px solid #999;padding:4px;font-size:9pt;vertical-align:top}
      th{background:#0B1633;color:#fff}</style></head><body>
      <h1>Analisador de Contratos — Relatório Executivo</h1>
      <p><b>Contrato antigo:</b> ${esc(antigo?.file.name ?? "—")}<br/><b>Contrato atual:</b> ${esc(atual?.file.name ?? "—")}</p>
      <h2>Resumo Executivo</h2>
      <p>Total de alterações: ${res.resumo.total} (${res.resumo.adicionadas} adicionadas, ${res.resumo.removidas} removidas, ${res.resumo.alteradas} alteradas).<br/>
      Alterações financeiras: ${res.resumo.financeiras} · vigência: ${res.resumo.vigencia} · penalidades: ${res.resumo.penalidades} · obrigações: ${res.resumo.obrigacoes}.<br/>
      Riscos: ${res.resumo.alto} altos, ${res.resumo.medio} médios, ${res.resumo.baixo} baixos. <b>Score geral de risco: ${res.resumo.score}/100</b>.</p>
      <h2>Comparação Cláusula a Cláusula</h2>
      <table><tr><th>#</th><th>Tipo</th><th>Categoria</th><th>Risco</th><th>Cláusula</th><th>Trecho original</th><th>Trecho alterado</th><th>Justificativa</th><th>Impacto</th></tr>
      ${res.alteracoes.map((a) => `<tr><td>${a.id}</td><td>${a.tipo}</td><td>${a.categoria}</td><td>${a.risco}</td><td>${esc(a.titulo)}</td><td>${esc(a.original.slice(0, 900))}</td><td>${esc(a.alterado.slice(0, 900))}</td><td>${esc(a.justificativa)}</td><td>${esc(a.impacto)}</td></tr>`).join("")}
      </table>
      <h2>Recomendações Finais</h2><ul>${recomendacoes(res).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      </body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "analise-contratos.doc"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analisador de Contratos</h1>
        <p className="text-muted-foreground mt-1">Compare duas versões de contrato (.pdf, .docx) e gere um relatório detalhado de alterações e riscos.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UploadCard
          titulo="Contrato Antigo" subtitulo="Versão de referência"
          doc={antigo} loading={carregando === "antigo"}
          onPick={(f) => carregar("antigo", f)}
          onRemove={() => { setAntigo(null); setRes(null); }}
          removeLabel="Remover Contrato Antigo"
          importLabel="Importar Contrato Antigo"
        />
        <UploadCard
          titulo="Contrato Atual" subtitulo="Versão em análise"
          doc={atual} loading={carregando === "atual"}
          onPick={(f) => carregar("atual", f)}
          onRemove={() => { setAtual(null); setRes(null); }}
          removeLabel="Remover Contrato Atual"
          importLabel="Importar Contrato Atual"
        />
      </div>

      <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-3">
        <Button onClick={analisar} disabled={!antigo || !atual || analisando}>
          {analisando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
          {analisando ? "Analisando..." : "Iniciar Análise"}
        </Button>
        {res && (
          <>
            <Button variant="outline" onClick={exportPdf}><FileText className="h-4 w-4 mr-1.5" />PDF</Button>
            <Button variant="outline" onClick={exportWord}><FileType2 className="h-4 w-4 mr-1.5" />Word</Button>
            <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
            <span className="text-xs text-muted-foreground">{usouIA ? "Riscos avaliados com apoio de IA jurídica." : "Riscos avaliados por regras automáticas."}</span>
          </>
        )}
        {!antigo || !atual ? <span className="text-xs text-muted-foreground">Carregue as duas versões para habilitar a análise.</span> : null}
      </div>

      {res && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Riscos Altos" value={String(res.resumo.alto)} tone="text-[oklch(0.72_0.18_25)]" />
            <Stat label="Riscos Médios" value={String(res.resumo.medio)} tone="text-[oklch(0.80_0.14_60)]" />
            <Stat label="Riscos Baixos" value={String(res.resumo.baixo)} tone="text-emerald-400" />
            <Stat label="Score Geral de Risco" value={`${res.resumo.score}/100`} tone="text-[oklch(0.77_0.14_82)]" />
          </div>

          <div className="glass-card rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[oklch(0.77_0.14_82)]" />
              <h2 className="font-semibold">Resumo Executivo</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
              <Mini label="Alterações" value={res.resumo.total} />
              <Mini label="Adicionadas" value={res.resumo.adicionadas} />
              <Mini label="Removidas" value={res.resumo.removidas} />
              <Mini label="Alteradas" value={res.resumo.alteradas} />
              <Mini label="Cláusulas (antigo)" value={res.resumo.clausulasAntigo} />
              <Mini label="Cláusulas (atual)" value={res.resumo.clausulasAtual} />
              <Mini label="Financeiras" value={res.resumo.financeiras} />
              <Mini label="Vigência" value={res.resumo.vigencia} />
              <Mini label="Penalidades" value={res.resumo.penalidades} />
              <Mini label="Obrigações" value={res.resumo.obrigacoes} />
            </div>
            <div className="pt-3 border-t border-border/60">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recomendações Finais</div>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                {recomendacoes(res).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border/60 font-semibold">Comparação Cláusula a Cláusula · Tabela de Alterações</div>
            <div className="overflow-x-auto max-h-[640px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card/95 backdrop-blur text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">#</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Categoria</th>
                    <th className="text-left p-3">Risco</th>
                    <th className="text-left p-3">Cláusula</th>
                    <th className="text-left p-3">Trecho original</th>
                    <th className="text-left p-3">Trecho alterado</th>
                    <th className="text-left p-3">Justificativa / Impacto</th>
                  </tr>
                </thead>
                <tbody>
                  {res.alteracoes.map((a) => (
                    <tr key={a.id} className="border-t border-border/40 align-top hover:bg-white/5">
                      <td className="p-3 text-xs text-muted-foreground">{a.id}</td>
                      <td className="p-3 text-xs">{a.tipo}</td>
                      <td className="p-3 text-xs">{a.categoria}</td>
                      <td className="p-3">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${nivelClass[a.risco]}`}>{a.risco}</span>
                      </td>
                      <td className="p-3 text-xs font-medium max-w-[180px]">{a.titulo}</td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[280px]">{a.original.slice(0, 400)}{a.original.length > 400 ? "…" : ""}</td>
                      <td className="p-3 text-xs max-w-[280px]">{a.alterado.slice(0, 400)}{a.alterado.length > 400 ? "…" : ""}</td>
                      <td className="p-3 text-xs max-w-[260px]">
                        <div>{a.descricao}</div>
                        <div className="text-muted-foreground mt-1">{a.justificativa}</div>
                        <div className="text-muted-foreground mt-1 italic">{a.impacto}</div>
                        {(a.valores.de.length || a.valores.para.length) ? (
                          <div className="mt-1 text-[11px]">Valores: {a.valores.de.join(", ") || "—"} → {a.valores.para.join(", ") || "—"}</div>
                        ) : null}
                        {(a.datas.de.length || a.datas.para.length) ? (
                          <div className="text-[11px]">Datas/prazos: {a.datas.de.join(", ") || "—"} → {a.datas.para.join(", ") || "—"}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {res.alteracoes.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhuma alteração relevante identificada entre as versões.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UploadCard({
  titulo, subtitulo, doc, loading, onPick, onRemove, importLabel, removeLabel,
}: {
  titulo: string; subtitulo: string; doc: Doc; loading: boolean;
  onPick: (f: File) => void; onRemove: () => void; importLabel: string; removeLabel: string;
}) {
  return (
    <div className="glass-card rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-semibold">{titulo}</h3>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </div>
      <label className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[oklch(0.77_0.14_82)]/40 p-8 text-center ${loading ? "opacity-60" : "cursor-pointer hover:bg-white/5"}`}>
        <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={loading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.currentTarget.value = ""; }} />
        {loading ? <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.77_0.14_82)]" /> : <FileUp className="h-8 w-8 text-[oklch(0.77_0.14_82)]" />}
        <div className="mt-2 text-sm font-medium">{importLabel}</div>
        <div className="text-xs text-muted-foreground">.pdf, .doc, .docx</div>
      </label>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs truncate">
          {doc ? <span className="text-emerald-400">{doc.file.name}</span> : <span className="text-muted-foreground">Nenhum arquivo carregado</span>}
        </div>
        <Button size="sm" variant="outline" disabled={!doc} onClick={onRemove}>
          <Trash2 className="h-4 w-4 mr-1.5" />{removeLabel}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone}`}>{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}