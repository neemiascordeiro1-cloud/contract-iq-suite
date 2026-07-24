import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { brl, brlCompact, num, pct } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  LineChart, Line, Legend, PieChart, Pie, Cell, LabelList,
} from "recharts";
import {
  FileText, Users, Package, PiggyBank, DollarSign, ShoppingCart, TrendingUp, Layers,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard Executivo — Contract Insight" }] }),
  component: Dashboard,
});

// Paleta semântica
const COLOR_SPEND = "oklch(0.58 0.16 245)";    // azul
const COLOR_SAVING = "oklch(0.68 0.15 160)";   // verde
const COLOR_AUMENTO = "oklch(0.62 0.20 25)";   // vermelho
const COLOR_CONTRATO = "oklch(0.72 0.16 55)";  // laranja
const COLOR_GOLD = "oklch(0.77 0.14 82)";
const PIE_COLORS = [COLOR_SPEND, COLOR_GOLD, COLOR_SAVING, COLOR_CONTRATO, "oklch(0.65 0.18 300)"];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ALL = "__all__";

function Dashboard() {
  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*")).data ?? [],
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["itens-all"],
    queryFn: async () => (await supabase.from("itens").select("*")).data ?? [],
  });
  const { data: hist = [] } = useQuery({
    queryKey: ["hist-all"],
    queryFn: async () => (await supabase.from("historico_precos").select("*").order("data_referencia", { ascending: true })).data ?? [],
  });

  // Filtros
  const [fFornecedor, setFFornecedor] = useState(ALL);
  const [fContrato, setFContrato] = useState(ALL);
  const [fCodigo, setFCodigo] = useState(ALL);
  const [fAno, setFAno] = useState(ALL);
  const [fMes, setFMes] = useState(ALL);
  const [fSemestre, setFSemestre] = useState(ALL);

  const contratosById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of contratos as any[]) m.set(c.id, c);
    return m;
  }, [contratos]);

  // Enriquecer itens com fornecedor e data
  const itensEnr = useMemo(() => (itens as any[]).map((i) => {
    const c = contratosById.get(i.contrato_id);
    const d = new Date(i.data_atualizacao ?? i.created_at ?? Date.now());
    return {
      ...i,
      preco_atual: Number(i.preco_atual) || 0,
      preco_anterior: Number(i.preco_anterior) || 0,
      fornecedor: c?.fornecedor ?? "—",
      numero_contrato: c?.numero_contrato ?? "—",
      contrato_id: i.contrato_id,
      _date: d,
      _ano: d.getFullYear(),
      _mes: d.getMonth() + 1,
      _semestre: d.getMonth() < 6 ? 1 : 2,
    };
  }), [itens, contratosById]);

  // Opções para filtros (derivadas do universo total)
  const opts = useMemo(() => {
    const fornecedores = Array.from(new Set(itensEnr.map((i) => i.fornecedor))).filter(Boolean).sort();
    const codigos = Array.from(new Set(itensEnr.map((i) => i.codigo))).filter(Boolean).sort();
    const numeros = Array.from(new Set(itensEnr.map((i) => i.numero_contrato))).filter((x) => x && x !== "—").sort();
    const anos = Array.from(new Set(itensEnr.map((i) => i._ano))).sort((a, b) => b - a);
    return { fornecedores, codigos, numeros, anos };
  }, [itensEnr]);

  const filtrados = useMemo(() => itensEnr.filter((i) => {
    if (fFornecedor !== ALL && i.fornecedor !== fFornecedor) return false;
    if (fContrato !== ALL && i.numero_contrato !== fContrato) return false;
    if (fCodigo !== ALL && i.codigo !== fCodigo) return false;
    if (fAno !== ALL && String(i._ano) !== fAno) return false;
    if (fMes !== ALL && String(i._mes) !== fMes) return false;
    if (fSemestre !== ALL && String(i._semestre) !== fSemestre) return false;
    return true;
  }), [itensEnr, fFornecedor, fContrato, fCodigo, fAno, fMes, fSemestre]);

  // KPIs
  const kpis = useMemo(() => {
    let spend = 0, saving = 0;
    const fornecedoresAtivos = new Set<string>();
    const codigosSet = new Set<string>();
    const contratosSet = new Set<string>();
    for (const i of filtrados) {
      spend += i.preco_atual;
      if (i.preco_anterior > 0 && i.preco_atual < i.preco_anterior) {
        saving += i.preco_anterior - i.preco_atual;
      }
      if (i.fornecedor && i.fornecedor !== "—") fornecedoresAtivos.add(i.fornecedor);
      if (i.codigo) codigosSet.add(i.codigo);
      if (i.contrato_id) contratosSet.add(i.contrato_id);
    }
    return {
      spend, saving,
      qtdCompras: contratosSet.size,
      qtdItens: filtrados.length,
      codigosUnicos: codigosSet.size,
      fornecedoresAtivos: fornecedoresAtivos.size,
    };
  }, [filtrados]);

  // Spend mensal (filtrado)
  const spendMensal = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of filtrados) {
      const k = `${i._ano}-${String(i._mes).padStart(2, "0")}`;
      m[k] = (m[k] ?? 0) + i.preco_atual;
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, total]) => ({ mes, total }));
  }, [filtrados]);

  const spendMesAtual = useMemo(() => {
    const now = new Date();
    const k = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return spendMensal.find((r) => r.mes === k)?.total ?? (spendMensal.at(-1)?.total ?? 0);
  }, [spendMensal]);

  // Spend por semestre (pizza)
  const spendPorSemestre = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of filtrados) {
      const k = `${i._ano} · S${i._semestre}`;
      m[k] = (m[k] ?? 0) + i.preco_atual;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtrados]);

  const spendSemestreAtual = useMemo(() => {
    const now = new Date();
    const k = `${now.getFullYear()} · S${now.getMonth() < 6 ? 1 : 2}`;
    return spendPorSemestre.find((r) => r.name === k)?.value ?? (spendPorSemestre[0]?.value ?? 0);
  }, [spendPorSemestre]);

  // Top 10 fornecedores por spend
  const topFornSpend = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of filtrados) m[i.fornecedor] = (m[i.fornecedor] ?? 0) + i.preco_atual;
    return Object.entries(m).map(([fornecedor, spend]) => ({ fornecedor, spend }))
      .sort((a, b) => b.spend - a.spend).slice(0, 10);
  }, [filtrados]);

  // Top 10 fornecedores por saving
  const topFornSaving = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of filtrados) {
      if (i.preco_anterior > 0 && i.preco_atual < i.preco_anterior) {
        m[i.fornecedor] = (m[i.fornecedor] ?? 0) + (i.preco_anterior - i.preco_atual);
      }
    }
    return Object.entries(m).map(([fornecedor, saving]) => ({ fornecedor, saving }))
      .sort((a, b) => b.saving - a.saving).slice(0, 10);
  }, [filtrados]);

  // Fornecedores com mais itens
  const fornMaisItens = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of filtrados) m[i.fornecedor] = (m[i.fornecedor] ?? 0) + 1;
    return Object.entries(m).map(([fornecedor, qtd]) => ({ fornecedor, qtd }))
      .sort((a, b) => b.qtd - a.qtd).slice(0, 10);
  }, [filtrados]);

  // Códigos por contrato
  const codigosPorContrato = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const i of filtrados) {
      if (!m[i.numero_contrato]) m[i.numero_contrato] = new Set();
      m[i.numero_contrato].add(i.codigo);
    }
    return Object.entries(m).map(([contrato, s]) => ({ contrato, qtd: s.size }))
      .sort((a, b) => b.qtd - a.qtd).slice(0, 10);
  }, [filtrados]);

  // Saving por Fornecedor (todos, ordenado)
  const savingPorForn = topFornSaving;

  // Evolução de preço por código (usa histórico + preço atual)
  const codigosFiltro = useMemo(() => {
    const set = new Set(filtrados.map((i) => i.codigo));
    return Array.from(set).sort();
  }, [filtrados]);
  const [codigoEvo, setCodigoEvo] = useState<string>("");
  const codigoAtivo = codigoEvo || codigosFiltro[0] || "";

  const evolucaoCodigo = useMemo(() => {
    if (!codigoAtivo) return [];
    const rows = (hist as any[])
      .filter((h) => h.codigo === codigoAtivo)
      .map((h) => ({ data: h.data_referencia, preco: Number(h.preco) }))
      .sort((a, b) => a.data.localeCompare(b.data));
    return rows.map((r) => ({
      mes: r.data.slice(0, 7),
      preco: r.preco,
    }));
  }, [hist, codigoAtivo]);

  const limpar = () => {
    setFFornecedor(ALL); setFContrato(ALL); setFCodigo(ALL);
    setFAno(ALL); setFMes(ALL); setFSemestre(ALL);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Executivo</h1>
          <p className="text-muted-foreground mt-1">Spend Analysis, Performance de Fornecedores e Resultados de Negociação.</p>
        </div>
        <button onClick={limpar} className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
          Limpar filtros
        </button>
      </div>

      {/* Filtros */}
      <div className="glass-card rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <FilterSelect label="Fornecedor" value={fFornecedor} onChange={setFFornecedor} options={opts.fornecedores} />
        <FilterSelect label="Contrato" value={fContrato} onChange={setFContrato} options={opts.numeros} />
        <FilterSelect label="Código" value={fCodigo} onChange={setFCodigo} options={opts.codigos} />
        <FilterSelect label="Ano" value={fAno} onChange={setFAno} options={opts.anos.map(String)} />
        <FilterSelect label="Mês" value={fMes} onChange={setFMes}
          options={MESES.map((m, idx) => ({ value: String(idx + 1), label: m }))} />
        <FilterSelect label="Semestre" value={fSemestre} onChange={setFSemestre}
          options={[{ value: "1", label: "1º Semestre" }, { value: "2", label: "2º Semestre" }]} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Spend Total" value={brl(kpis.spend)} icon={DollarSign} accent="blue" />
        <KpiCard label="Saving Acumulado" value={brl(kpis.saving)} icon={PiggyBank} accent="emerald" />
        <KpiCard label="Spend Mensal" value={brl(spendMesAtual)} hint="Mês corrente / último" icon={TrendingUp} accent="blue" />
        <KpiCard label="Spend Semestral" value={brl(spendSemestreAtual)} hint="Semestre atual" icon={TrendingUp} accent="gold" />
        <KpiCard label="Fornecedores Ativos" value={num(kpis.fornecedoresAtivos)} icon={Users} accent="gold" />
        <KpiCard label="Qtd. Compras" value={num(kpis.qtdCompras)} hint="Contratos" icon={ShoppingCart} accent="orange" />
        <KpiCard label="Qtd. Itens" value={num(kpis.qtdItens)} icon={Package} accent="gold" />
        <KpiCard label="Códigos Únicos" value={num(kpis.codigosUnicos)} icon={Layers} accent="blue" />
        <KpiCard label="% Saving / Spend" value={pct(kpis.spend > 0 ? (kpis.saving / kpis.spend) * 100 : 0)} icon={PiggyBank} accent="emerald" />
        <KpiCard label="Contratos" value={num(contratos.length)} icon={FileText} accent="orange" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Spend por Semestre" subtitle="Distribuição percentual">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={spendPorSemestre}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(e: any) => `${e.name}: ${brlCompact(e.value)}`}
                labelLine={false}
              >
                {spendPorSemestre.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tt} formatter={(v: any) => brl(v as number)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Fornecedores por Spend" subtitle="Valor total contratado">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topFornSpend} layout="vertical" margin={{ left: 8, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis type="number" stroke="oklch(0.72 0.03 265)" fontSize={11} tickFormatter={brlCompact} />
              <YAxis dataKey="fornecedor" type="category" stroke="oklch(0.72 0.03 265)" fontSize={11} width={130} />
              <Tooltip contentStyle={tt} formatter={(v: any) => brl(v as number)} />
              <Bar dataKey="spend" fill={COLOR_SPEND} radius={[0, 6, 6, 0]}>
                <LabelList dataKey="spend" position="right" formatter={(v: any) => brlCompact(Number(v))} style={{ fill: "oklch(0.85 0.02 265)", fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Fornecedores por Saving" subtitle="Economia gerada">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topFornSaving} layout="vertical" margin={{ left: 8, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis type="number" stroke="oklch(0.72 0.03 265)" fontSize={11} tickFormatter={brlCompact} />
              <YAxis dataKey="fornecedor" type="category" stroke="oklch(0.72 0.03 265)" fontSize={11} width={130} />
              <Tooltip contentStyle={tt} formatter={(v: any) => brl(v as number)} />
              <Bar dataKey="saving" fill={COLOR_SAVING} radius={[0, 6, 6, 0]}>
                <LabelList dataKey="saving" position="right" formatter={(v: any) => brlCompact(Number(v))} style={{ fill: "oklch(0.85 0.02 265)", fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Fornecedores com Mais Itens" subtitle="Top 10 por quantidade">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={fornMaisItens} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis dataKey="fornecedor" stroke="oklch(0.72 0.03 265)" fontSize={10} angle={-20} textAnchor="end" height={60} interval={0} />
              <YAxis stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <Tooltip contentStyle={tt} formatter={(v: any) => num(v as number)} />
              <Bar dataKey="qtd" fill={COLOR_GOLD} radius={[6, 6, 0, 0]}>
                <LabelList dataKey="qtd" position="top" style={{ fill: "oklch(0.85 0.02 265)", fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Códigos por Contrato" subtitle="Top 10 contratos por qtd. de códigos">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={codigosPorContrato} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis dataKey="contrato" stroke="oklch(0.72 0.03 265)" fontSize={10} angle={-20} textAnchor="end" height={60} interval={0} />
              <YAxis stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <Tooltip contentStyle={tt} formatter={(v: any) => num(v as number)} />
              <Bar dataKey="qtd" fill={COLOR_CONTRATO} radius={[6, 6, 0, 0]}>
                <LabelList dataKey="qtd" position="top" style={{ fill: "oklch(0.85 0.02 265)", fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Saving por Fornecedor" subtitle="Ordenado do maior para o menor">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={savingPorForn} layout="vertical" margin={{ left: 8, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis type="number" stroke="oklch(0.72 0.03 265)" fontSize={11} tickFormatter={brlCompact} />
              <YAxis dataKey="fornecedor" type="category" stroke="oklch(0.72 0.03 265)" fontSize={11} width={130} />
              <Tooltip contentStyle={tt} formatter={(v: any) => brl(v as number)} />
              <Bar dataKey="saving" fill={COLOR_SAVING} radius={[0, 6, 6, 0]}>
                <LabelList dataKey="saving" position="right" formatter={(v: any) => brlCompact(Number(v))} style={{ fill: "oklch(0.85 0.02 265)", fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Spend Mensal" subtitle="Evolução temporal do gasto" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={spendMensal} margin={{ top: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis dataKey="mes" stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <YAxis stroke="oklch(0.72 0.03 265)" fontSize={11} tickFormatter={brlCompact} />
              <Tooltip contentStyle={tt} formatter={(v: any) => brl(v as number)} />
              <Bar dataKey="total" fill={COLOR_SPEND} radius={[6, 6, 0, 0]}>
                <LabelList dataKey="total" position="top" formatter={(v: any) => brlCompact(Number(v))} style={{ fill: "oklch(0.85 0.02 265)", fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Evolução de Preço por Código"
          subtitle="Histórico de preço unitário"
          className="lg:col-span-2"
          extra={
            <Select value={codigoAtivo} onValueChange={setCodigoEvo}>
              <SelectTrigger className="w-[220px] h-9 text-xs">
                <SelectValue placeholder="Selecione um código" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {codigosFiltro.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs font-mono">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolucaoCodigo}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis dataKey="mes" stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <YAxis stroke="oklch(0.72 0.03 265)" fontSize={11} tickFormatter={(v) => brlCompact(v as number)} />
              <Tooltip contentStyle={tt} formatter={(v: any) => brl(v as number)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="preco" name={`Preço · ${codigoAtivo || "—"}`} stroke={COLOR_AUMENTO} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

const tt = {
  background: "oklch(0.19 0.05 265)",
  border: "1px solid oklch(0.77 0.14 82 / 0.3)",
  borderRadius: 10,
  color: "white",
};

function ChartCard({
  title, subtitle, children, className, extra,
}: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string; extra?: React.ReactNode;
}) {
  return (
    <div className={`glass-card rounded-xl p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}

type Opt = string | { value: string; label: string };
function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: Opt[] }) {
  return (
    <div>
      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 h-9 text-xs">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent className="max-h-[320px]">
          <SelectItem value={ALL} className="text-xs">Todos</SelectItem>
          {options.map((o) => {
            const v = typeof o === "string" ? o : o.value;
            const l = typeof o === "string" ? o : o.label;
            return <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>;
          })}
        </SelectContent>
      </Select>
    </div>
  );
}