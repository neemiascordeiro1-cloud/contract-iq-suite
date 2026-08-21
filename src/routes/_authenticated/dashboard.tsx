import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DATASET_RESET_EVENT } from "@/lib/dataset";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { brl, brlCompact, num, pct } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LabelList,
  Legend,
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
const COLOR_CONTRATO = "oklch(0.72 0.16 55)";  // laranja
const COLOR_GOLD = "oklch(0.77 0.14 82)";
const PIE_COLORS = [COLOR_SPEND, COLOR_GOLD, COLOR_SAVING, COLOR_CONTRATO, "oklch(0.65 0.18 300)", "oklch(0.55 0.22 15)"];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ALL = "__all__";

type PeriodoTipo = "mensal" | "trimestral" | "semestral" | "anual";

function Dashboard() {
  const navigate = useNavigate();

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*")).data ?? [],
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["itens-all"],
    queryFn: async () => (await supabase.from("itens").select("*")).data ?? [],
  });

  const [fFornecedor, setFFornecedor] = useState(ALL);
  const [fContrato, setFContrato] = useState(ALL);
  const [fCodigo, setFCodigo] = useState(ALL);
  const [fAno, setFAno] = useState(ALL);
  const [fMes, setFMes] = useState(ALL);
  const [fSemestre, setFSemestre] = useState(ALL);

  // Filtros específicos dos Cards
  const [periodoSpendDist, setPeriodoSpendDist] = useState<PeriodoTipo>("semestral");
  const [periodoTopFornSpend, setPeriodoTopFornSpend] = useState<"todos" | PeriodoTipo>("todos");
  const [granulSpendTemporal, setGranulSpendTemporal] = useState<PeriodoTipo>("mensal");
  const [fornSpendTemporal, setFornSpendTemporal] = useState<string>(ALL);

  const contratosById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of contratos as any[]) m.set(c.id, c);
    return m;
  }, [contratos]);

  // Enriquecer itens com fornecedor e data
  const itensEnr = useMemo(() => (itens as any[]).map((i) => {
    const c = contratosById.get(i.contrato_id);
    const d = new Date(i.data_atualizacao ?? i.created_at ?? Date.now());
    const mes = d.getMonth() + 1;
    return {
      ...i,
      preco_atual: Number(i.preco_atual) || 0,
      preco_anterior: Number(i.preco_anterior) || 0,
      fornecedor: c?.fornecedor ?? "—",
      numero_contrato: c?.numero_contrato ?? "—",
      contrato_id: i.contrato_id,
      _date: d,
      _ano: d.getFullYear(),
      _mes: mes,
      _trimestre: Math.ceil(mes / 3),
      _semestre: mes <= 6 ? 1 : 2,
    };
  }), [itens, contratosById]);

  // Opções para filtros (derivadas do universo total)
  const opts = useMemo(() => {
    const fornecedores = Array.from(new Set(itensEnr.map((i) => i.fornecedor))).filter((f) => f && f !== "—").sort();
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

  // Spend mensal (KPI)
  const spendMesAtual = useMemo(() => {
    const now = new Date();
    const kAno = now.getFullYear();
    const kMes = now.getMonth() + 1;
    const esteMes = filtrados.filter((i) => i._ano === kAno && i._mes === kMes);
    if (esteMes.length > 0) return esteMes.reduce((s, i) => s + i.preco_atual, 0);
    if (filtrados.length === 0) return 0;
    const sorted = [...filtrados].sort((a, b) => a._date.getTime() - b._date.getTime());
    const last = sorted.at(-1)!;
    return filtrados.filter((i) => i._ano === last._ano && i._mes === last._mes).reduce((s, i) => s + i.preco_atual, 0);
  }, [filtrados]);

  // Spend semestral (KPI)
  const spendSemestreAtual = useMemo(() => {
    const now = new Date();
    const kAno = now.getFullYear();
    const kSem = now.getMonth() < 6 ? 1 : 2;
    const esteSem = filtrados.filter((i) => i._ano === kAno && i._semestre === kSem);
    if (esteSem.length > 0) return esteSem.reduce((s, i) => s + i.preco_atual, 0);
    if (filtrados.length === 0) return 0;
    const sorted = [...filtrados].sort((a, b) => a._date.getTime() - b._date.getTime());
    const last = sorted.at(-1)!;
    return filtrados.filter((i) => i._ano === last._ano && i._semestre === last._semestre).reduce((s, i) => s + i.preco_atual, 0);
  }, [filtrados]);

  // Card 1: Distribuição de Spend por Período (Mensal / Trimestral / Semestral / Anual)
  const spendPorPeriodo = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of filtrados) {
      let k = "";
      if (periodoSpendDist === "mensal") {
        k = `${i._ano} · ${MESES[i._mes - 1]}`;
      } else if (periodoSpendDist === "trimestral") {
        k = `${i._ano} · T${i._trimestre}`;
      } else if (periodoSpendDist === "semestral") {
        k = `${i._ano} · S${i._semestre}`;
      } else {
        k = `${i._ano}`;
      }
      m[k] = (m[k] ?? 0) + i.preco_atual;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtrados, periodoSpendDist]);

  // Card 2: Top 10 fornecedores por Spend (com filtro de período)
  const topFornSpend = useMemo(() => {
    let base = filtrados;
    if (periodoTopFornSpend !== "todos" && filtrados.length > 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentQuarter = Math.ceil(currentMonth / 3);
      const currentSemester = currentMonth <= 6 ? 1 : 2;

      if (periodoTopFornSpend === "mensal") {
        const hasCurrent = filtrados.some((i) => i._ano === currentYear && i._mes === currentMonth);
        const tAno = hasCurrent ? currentYear : (filtrados.at(-1)?._ano ?? currentYear);
        const tMes = hasCurrent ? currentMonth : (filtrados.at(-1)?._mes ?? currentMonth);
        base = filtrados.filter((i) => i._ano === tAno && i._mes === tMes);
      } else if (periodoTopFornSpend === "trimestral") {
        const hasCurrent = filtrados.some((i) => i._ano === currentYear && i._trimestre === currentQuarter);
        const tAno = hasCurrent ? currentYear : (filtrados.at(-1)?._ano ?? currentYear);
        const tTri = hasCurrent ? currentQuarter : (filtrados.at(-1)?._trimestre ?? 1);
        base = filtrados.filter((i) => i._ano === tAno && i._trimestre === tTri);
      } else if (periodoTopFornSpend === "semestral") {
        const hasCurrent = filtrados.some((i) => i._ano === currentYear && i._semestre === currentSemester);
        const tAno = hasCurrent ? currentYear : (filtrados.at(-1)?._ano ?? currentYear);
        const tSem = hasCurrent ? currentSemester : (filtrados.at(-1)?._semestre ?? 1);
        base = filtrados.filter((i) => i._ano === tAno && i._semestre === tSem);
      } else if (periodoTopFornSpend === "anual") {
        const hasCurrent = filtrados.some((i) => i._ano === currentYear);
        const tAno = hasCurrent ? currentYear : (filtrados.at(-1)?._ano ?? currentYear);
        base = filtrados.filter((i) => i._ano === tAno);
      }
    }

    const m: Record<string, number> = {};
    for (const i of base) {
      if (i.fornecedor && i.fornecedor !== "—") {
        m[i.fornecedor] = (m[i.fornecedor] ?? 0) + i.preco_atual;
      }
    }
    return Object.entries(m).map(([fornecedor, spend]) => ({ fornecedor, spend }))
      .sort((a, b) => b.spend - a.spend).slice(0, 10);
  }, [filtrados, periodoTopFornSpend]);

  // Card 3: Top 10 fornecedores por Saving
  const topFornSaving = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of filtrados) {
      if (i.fornecedor && i.fornecedor !== "—" && i.preco_anterior > 0 && i.preco_atual < i.preco_anterior) {
        m[i.fornecedor] = (m[i.fornecedor] ?? 0) + (i.preco_anterior - i.preco_atual);
      }
    }
    return Object.entries(m).map(([fornecedor, saving]) => ({ fornecedor, saving }))
      .sort((a, b) => b.saving - a.saving).slice(0, 10);
  }, [filtrados]);

  // Card 4: Fornecedores com mais itens (clique redireciona para /fornecedor?nome=...)
  const fornMaisItens = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of filtrados) {
      if (i.fornecedor && i.fornecedor !== "—") {
        m[i.fornecedor] = (m[i.fornecedor] ?? 0) + 1;
      }
    }
    return Object.entries(m).map(([fornecedor, qtd]) => ({ fornecedor, qtd }))
      .sort((a, b) => b.qtd - a.qtd).slice(0, 10);
  }, [filtrados]);

  // Card 5: Spend Temporal (com filtro de período Mensal/Trimestral/Semestral/Anual e filtro de Fornecedor)
  const spendTemporal = useMemo(() => {
    const base = fornSpendTemporal === ALL
      ? filtrados
      : filtrados.filter((i) => i.fornecedor === fornSpendTemporal);

    const m: Record<string, { label: string; sortKey: string; total: number }> = {};
    for (const i of base) {
      let key = "";
      let label = "";
      let sortKey = "";

      if (granulSpendTemporal === "mensal") {
        key = `${i._ano}-${String(i._mes).padStart(2, "0")}`;
        label = `${MESES[i._mes - 1]}/${String(i._ano).slice(2)}`;
        sortKey = key;
      } else if (granulSpendTemporal === "trimestral") {
        key = `${i._ano}-T${i._trimestre}`;
        label = `${i._ano} · T${i._trimestre}`;
        sortKey = `${i._ano}-0${i._trimestre}`;
      } else if (granulSpendTemporal === "semestral") {
        key = `${i._ano}-S${i._semestre}`;
        label = `${i._ano} · S${i._semestre}`;
        sortKey = `${i._ano}-0${i._semestre}`;
      } else {
        key = `${i._ano}`;
        label = `${i._ano}`;
        sortKey = `${i._ano}`;
      }

      if (!m[key]) {
        m[key] = { label, sortKey, total: 0 };
      }
      m[key].total += i.preco_atual;
    }

    return Object.values(m)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((r) => ({ periodo: r.label, total: r.total }));
  }, [filtrados, fornSpendTemporal, granulSpendTemporal]);

  const limpar = () => {
    setFFornecedor(ALL); setFContrato(ALL); setFCodigo(ALL);
    setFAno(ALL); setFMes(ALL); setFSemestre(ALL);
    setPeriodoSpendDist("semestral");
    setPeriodoTopFornSpend("todos");
    setGranulSpendTemporal("mensal");
    setFornSpendTemporal(ALL);
  };

  // Nova importação / exclusão de planilha: zera filtros e métricas sem precisar de F5
  useEffect(() => {
    const onReset = () => limpar();
    window.addEventListener(DATASET_RESET_EVENT, onReset);
    return () => window.removeEventListener(DATASET_RESET_EVENT, onReset);
  }, []);



  const handleFornecedorClick = (nomeFornecedor?: string) => {
    if (nomeFornecedor && nomeFornecedor !== "—") {
      navigate({ to: "/fornecedor", search: { nome: nomeFornecedor } });
    }
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

      {/* Filtros Globais */}
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
        {/* Card Spend Distribuição com Filtro de Período */}
        <ChartCard
          title="Distribuição de Spend"
          subtitle={`Visão percentual por período (${periodoSpendDist})`}
          extra={
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">Período:</span>
              <Select value={periodoSpendDist} onValueChange={(v: any) => setPeriodoSpendDist(v)}>
                <SelectTrigger className="w-[125px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal" className="text-xs">Mensal</SelectItem>
                  <SelectItem value="trimestral" className="text-xs">Trimestral</SelectItem>
                  <SelectItem value="semestral" className="text-xs">Semestral</SelectItem>
                  <SelectItem value="anual" className="text-xs">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={spendPorPeriodo}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(e: any) => `${e.name}: ${brlCompact(e.value)}`}
                labelLine={false}
              >
                {spendPorPeriodo.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tt} formatter={(v: any) => brl(v as number)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Card Top 10 Fornecedores por Spend com Filtro de Período */}
        <ChartCard
          title="Top 10 Fornecedores por Spend"
          subtitle="Valor total contratado"
          extra={
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">Período:</span>
              <Select value={periodoTopFornSpend} onValueChange={(v: any) => setPeriodoTopFornSpend(v)}>
                <SelectTrigger className="w-[145px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">Todos os períodos</SelectItem>
                  <SelectItem value="mensal" className="text-xs">Mensal (Último/Atual)</SelectItem>
                  <SelectItem value="trimestral" className="text-xs">Trimestral (Atual)</SelectItem>
                  <SelectItem value="semestral" className="text-xs">Semestral (Atual)</SelectItem>
                  <SelectItem value="anual" className="text-xs">Anual (Atual)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        >
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

        {/* Card Top 10 Fornecedores por Saving */}
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

        {/* Card Fornecedores com Mais Itens (Clicável -> Página do Fornecedor) */}
        <ChartCard
          title="Fornecedores com Mais Itens"
          subtitle="Top 10 por quantidade · Clique na coluna para ver detalhes do fornecedor"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={fornMaisItens}
              margin={{ top: 20 }}
              onClick={(state: any) => {
                const f = state?.activePayload?.[0]?.payload?.fornecedor;
                if (f) handleFornecedorClick(f);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis
                dataKey="fornecedor"
                stroke="oklch(0.72 0.03 265)"
                fontSize={10}
                angle={-20}
                textAnchor="end"
                height={60}
                interval={0}
                className="cursor-pointer"
              />
              <YAxis stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <Tooltip
                contentStyle={tt}
                formatter={(v: any) => [`${num(v as number)} itens (Clique para abrir)`, "Quantidade"]}
              />
              <Bar
                dataKey="qtd"
                fill={COLOR_GOLD}
                radius={[6, 6, 0, 0]}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onClick={(entry: any) => handleFornecedorClick(entry?.fornecedor)}
              >
                <LabelList dataKey="qtd" position="top" style={{ fill: "oklch(0.85 0.02 265)", fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Card Spend Temporal com Filtro de Período e Filtro de Fornecedor */}
        <ChartCard
          title="Evolução de Spend por Período"
          subtitle="Acompanhamento temporal do gasto com filtros de período e fornecedor"
          className="lg:col-span-2"
          extra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground hidden sm:inline">Período:</span>
                <Select value={granulSpendTemporal} onValueChange={(v: any) => setGranulSpendTemporal(v)}>
                  <SelectTrigger className="w-[125px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal" className="text-xs">Mensal</SelectItem>
                    <SelectItem value="trimestral" className="text-xs">Trimestral</SelectItem>
                    <SelectItem value="semestral" className="text-xs">Semestral</SelectItem>
                    <SelectItem value="anual" className="text-xs">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground hidden sm:inline">Fornecedor:</span>
                <Select value={fornSpendTemporal} onValueChange={setFornSpendTemporal}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Todos os fornecedores" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value={ALL} className="text-xs">Todos os fornecedores</SelectItem>
                    {opts.fornecedores.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={spendTemporal} margin={{ top: 24, left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis dataKey="periodo" stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <YAxis stroke="oklch(0.72 0.03 265)" fontSize={11} tickFormatter={brlCompact} />
              <Tooltip contentStyle={tt} formatter={(v: any) => [brl(v as number), "Spend"]} />
              <Bar dataKey="total" fill={COLOR_SPEND} radius={[6, 6, 0, 0]}>
                <LabelList dataKey="total" position="top" formatter={(v: any) => brlCompact(Number(v))} style={{ fill: "oklch(0.85 0.02 265)", fontSize: 10 }} />
              </Bar>
            </BarChart>
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
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
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
