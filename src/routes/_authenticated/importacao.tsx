import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, CheckCircle2, FileSpreadsheet, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { num } from "@/lib/format";
import { wipeDataset, resetClientState } from "@/lib/dataset";
import { inferirTipoCompra } from "@/lib/compras";


export const Route = createFileRoute("/_authenticated/importacao")({
  head: () => ({ meta: [{ title: "Importação — Contract Insight" }] }),
  component: Importacao,
});

function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const epoch = new Date(Math.round((v - 25569) * 86400 * 1000));
    return epoch.toISOString();
  }
  const d = new Date(v);
  return isNaN(+d) ? null : d.toISOString();
}

function Importacao() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const qc = useQueryClient();

  const { data: hist = [] } = useQuery({
    queryKey: ["importacoes"],
    queryFn: async () => (await supabase.from("importacoes").select("*").order("data_importacao", { ascending: false }).limit(20)).data ?? [],
  });

  const importar = async (file: File) => {
    setLoading(true);
    setProgress("Lendo arquivo...");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
      if (rows.length === 0) throw new Error("Planilha vazia.");

      // Normalize column keys (case/accent insensitive)
      const norm = (s: string) => s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const findKey = (row: any, ...alts: string[]) => {
        for (const k of Object.keys(row)) if (alts.some((a) => norm(k) === norm(a) || norm(k).includes(norm(a)))) return k;
        return null;
      };
      const first = rows[0];
      const kContrato = findKey(first, "Contrato", "Nr Contrato", "Numero Contrato");
      const kFornecedor = findKey(first, "Fornecedor", "Nome Abrev");
      const kCodigo = findKey(first, "Codigo", "Item");
      const kDesc = findKey(first, "Descricao", "Desc Item");
      const kUnid = findKey(first, "Unidade");
      const kPreco = findKey(first, "Preco Atual", "Valor Unit", "Valor Unitario Negociado", "Valor Unitario Inicial", "Preco");
      const kData = findKey(first, "Data Atualizacao", "Dt Emissao", "Data Pedido");
      const kQtd = findKey(first, "Quantidade", "Qtd", "Qtde", "Quant");
      const kTipo = findKey(first, "Tipo de Compra", "Tipo Compra", "Tipo", "Grupo", "Familia", "Categoria");
      const kVencSist = findKey(first, "Data Vencimento Contrato Sistemico", "Vencimento Sistemico", "Data Vencimento", "Vencimento");
      const kContratoJur = findKey(first, "Contrato Juridico", "Nr Contrato Juridico", "Numero Contrato Juridico");

      if (!kContrato || !kCodigo || !kPreco) throw new Error("Colunas obrigatórias não encontradas (Contrato, Código, Preço).");

      const soData = (v: any) => {
        const iso = parseDate(v);
        return iso ? iso.slice(0, 10) : null;
      };

      // Group by contract
      const contratosMap = new Map<string, { fornecedor: string; vencSist: string | null; contratoJur: string | null; itens: Map<string, any> }>();
      for (const r of rows) {
        const numContrato = String(r[kContrato] ?? "").trim();
        if (!numContrato || numContrato === "0" || numContrato.toLowerCase() === "null") continue;
        const fornecedor = String((kFornecedor && r[kFornecedor]) ?? "—").trim();
        const codigo = String(r[kCodigo] ?? "").trim();
        if (!codigo) continue;
        const preco = Number(r[kPreco] ?? 0);
        if (!isFinite(preco) || preco <= 0) continue;
        const desc = String((kDesc && r[kDesc]) ?? "").trim();
        const unidade = kUnid ? String(r[kUnid] ?? "").trim() : null;
        const dataAt = kData ? parseDate(r[kData]) : null;
        const qtdRaw = kQtd ? Number(String(r[kQtd] ?? "").toString().replace(/\./g, "").replace(",", ".")) : 0;
        const quantidade = isFinite(qtdRaw) && qtdRaw > 0 ? qtdRaw : 0;
        const tipoCompra = kTipo && r[kTipo] ? String(r[kTipo]).trim() : inferirTipoCompra(desc);
        const vencSist = kVencSist ? soData(r[kVencSist]) : null;
        const contratoJur = kContratoJur && r[kContratoJur] ? String(r[kContratoJur]).trim() : null;

        if (!contratosMap.has(numContrato)) contratosMap.set(numContrato, { fornecedor, vencSist, contratoJur, itens: new Map() });
        const bucket = contratosMap.get(numContrato)!;
        if (!bucket.vencSist && vencSist) bucket.vencSist = vencSist;
        if (!bucket.contratoJur && contratoJur) bucket.contratoJur = contratoJur;
        const prev = bucket.itens.get(codigo);
        if (!prev) {
          bucket.itens.set(codigo, { codigo, descricao: desc, unidade, preco, dataAt, quantidade, tipoCompra });
        } else {
          prev.quantidade = Number(prev.quantidade ?? 0) + quantidade;
          if (dataAt && (!prev.dataAt || dataAt > prev.dataAt)) {
            prev.descricao = desc || prev.descricao;
            prev.unidade = unidade ?? prev.unidade;
            prev.preco = preco;
            prev.dataAt = dataAt;
            prev.tipoCompra = tipoCompra ?? prev.tipoCompra;
          }
        }
      }

      // Fonte de dados única: remove todo o dataset anterior antes de gravar o novo
      setProgress("Removendo dados da importação anterior...");
      await wipeDataset({ incluirImportacoes: true });
      await resetClientState(qc);

      let totalItens = 0;
      let contratoIdx = 0;
      for (const [numero, { fornecedor, vencSist, contratoJur, itens }] of contratosMap.entries()) {
        contratoIdx++;
        setProgress(`Salvando contrato ${contratoIdx}/${contratosMap.size} · ${numero}`);

        // Upsert contrato
        const { data: existing } = await supabase.from("contratos").select("id").eq("numero_contrato", numero).maybeSingle();
        let contratoId = existing?.id;
        const camposContrato: any = {
          fornecedor,
          data_vencimento_sistemico: vencSist,
          numero_contrato_juridico: contratoJur,
        };
        if (!contratoId) {
          const { data, error } = await supabase.from("contratos").insert({ numero_contrato: numero, status: "Ativo", ...camposContrato } as any).select("id").single();
          if (error) throw error;
          contratoId = data.id;
        } else {
          await supabase.from("contratos").update({ ...camposContrato, updated_at: new Date().toISOString() } as any).eq("id", contratoId);
        }

        // Existing items to preserve preco_anterior
        const { data: exItens } = await supabase.from("itens").select("id, codigo, preco_atual").eq("contrato_id", contratoId);
        const existMap = new Map((exItens ?? []).map((i: any) => [i.codigo, i]));

        const toInsert: any[] = [];
        const toUpdate: any[] = [];
        const histRows: any[] = [];
        for (const it of itens.values()) {
          const prev = existMap.get(it.codigo);
          const dataAt = it.dataAt ?? new Date().toISOString();
          if (prev) {
            toUpdate.push({
              id: prev.id,
              preco_atual: it.preco,
              preco_anterior: Number(prev.preco_atual) !== it.preco ? Number(prev.preco_atual) : undefined,
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              tipo_compra: it.tipoCompra,
              data_atualizacao: dataAt,
            });
            if (Number(prev.preco_atual) !== it.preco) {
              histRows.push({ item_id: prev.id, codigo: it.codigo, preco: it.preco, data_referencia: dataAt });
            }
          } else {
            toInsert.push({ contrato_id: contratoId, codigo: it.codigo, descricao: it.descricao, unidade: it.unidade, preco_atual: it.preco, quantidade: it.quantidade, tipo_compra: it.tipoCompra, data_atualizacao: dataAt });
          }
        }


        if (toInsert.length) {
          const { data: inserted, error } = await supabase.from("itens").insert(toInsert).select("id, codigo, preco_atual, data_atualizacao");
          if (error) throw error;
          for (const r of inserted ?? []) histRows.push({ item_id: r.id, codigo: r.codigo, preco: r.preco_atual, data_referencia: r.data_atualizacao });
        }
        for (const u of toUpdate) {
          const { id, ...rest } = u;
          await supabase.from("itens").update(rest).eq("id", id);
        }
        if (histRows.length) await supabase.from("historico_precos").insert(histRows);
        totalItens += toInsert.length + toUpdate.length;
      }

      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("importacoes").insert({
        arquivo: file.name,
        quantidade_registros: totalItens,
        usuario_id: userData.user?.id ?? null,
        usuario_nome: userData.user?.user_metadata?.full_name ?? userData.user?.email ?? null,
      });

      toast.success(`Importação concluída · ${totalItens} item(ns) processados`);
      setProgress("");
      await resetClientState(qc);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Erro na importação");
      setProgress("");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removerImportacao = async (id: string, nomeArquivo?: string) => {
  if (
    !window.confirm(
      `Deseja realmente remover a importação "${nomeArquivo || id}" e limpar todos os dados carregados?`
    )
  ) {
    return;
  }

  try {
    setLoading(true);

    // Exclusão da planilha = limpeza completa do dataset associado
    await wipeDataset();

    const { error: erroImportacao } = await supabase
      .from("importacoes")
      .delete()
      .eq("id", id);

    if (erroImportacao) throw erroImportacao;

    toast.success("Importação e dados removidos com sucesso");

    await resetClientState(qc);
  } catch (err: any) {
    console.error(err);
    toast.error(err.message ?? "Erro ao remover dados");
} finally {
  setLoading(false);
}
};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importação de Dados</h1>
        <p className="text-muted-foreground mt-1">Envie uma planilha Excel com os contratos e itens.</p>
      </div>

      <div className="glass-card rounded-xl p-8">
        <label className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[oklch(0.77_0.14_82)]/40 bg-white/2 p-12 text-center transition-all ${loading ? "opacity-60" : "hover:bg-white/5 cursor-pointer"}`}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])}
          />
          <Upload className="h-10 w-10 text-[oklch(0.77_0.14_82)] mb-3" />
          <div className="text-lg font-semibold">Clique para enviar planilha Excel</div>
          <div className="text-sm text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls</div>
          {loading && <div className="text-sm text-[oklch(0.77_0.14_82)] mt-4">{progress || "Processando..."}</div>}
        </label>
        <div className="mt-4 text-xs text-muted-foreground">
          Colunas reconhecidas automaticamente: <b>Contrato</b>, <b>Fornecedor</b>, <b>Código</b>, <b>Descrição</b>, <b>Unidade</b>, <b>Preço Atual</b>, <b>Data Atualização</b>. Nomes flexíveis (ex.: <i>Nr Contrato</i>, <i>Nome Abrev</i>, <i>Item</i>, <i>Valor Unitário Negociado</i>, <i>Dt Emissão</i>).
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-[oklch(0.77_0.14_82)]" />
          <h3 className="font-semibold">Histórico de Importações</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Arquivo</th>
                <th className="text-left p-3">Usuário</th>
                <th className="text-right p-3">Registros</th>
                <th className="text-right p-3">Data</th>
                <th className="text-right p-3">Status</th>
                <th className="text-center p-3 w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(hist as any[]).map((h) => (
                <tr key={h.id} className="border-t border-border/40">
                  <td className="p-3 font-medium">{h.arquivo}</td>
                  <td className="p-3 text-muted-foreground">{h.usuario_nome ?? "—"}</td>
                  <td className="p-3 text-right font-medium">{num(h.quantidade_registros)}</td>
                  <td className="p-3 text-right text-muted-foreground">{new Date(h.data_importacao).toLocaleString("pt-BR")}</td>
                  <td className="p-3 text-right"><span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />{h.status}</span></td>
                  <td className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Excluir importação"
                      onClick={() => removerImportacao(h.id, h.arquivo)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {hist.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma importação ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
