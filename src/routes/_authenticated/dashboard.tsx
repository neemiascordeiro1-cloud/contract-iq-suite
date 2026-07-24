import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { brl, num, pct, variacao } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { FileText, Users, Package, TrendingUp, TrendingDown, PiggyBank, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Contract Insight" }] }),
  component: Dashboard,
});

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

  const stats = useMemo(() => {
    const fornecedores = new Set(contratos.map((c: any) => c.fornecedor)).size;
    const codigos = new Set(itens.map((i: any) => i.codigo)).size;
    let aumentos = 0, reducoes = 0, impacto = 0, economia = 0;
    for (const it of itens as any[]) {
      if (it.preco_anterior && it.preco_anterior > 0) {
        const v = variacao(Number(it.preco_atual), Number(it.preco_anterior));
        const dif = Number(it.preco_atual) - Number(it.preco_anterior);
        if (v > 0) { aumentos++; impacto += dif; }
        else if (v < 0) { reducoes++; economia += -dif; }
      }
    }
    return { fornecedores, codigos, aumentos, reducoes, impacto, economia };
  }, [contratos, itens]);

  const porContrato = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of itens as any[]) {
      const c = contratos.find((x: any) => x.id === it.contrato_id);
      if (!c) continue;
      map[c.numero_contrato] = (map[c.numero_contrato] ?? 0) + 1;
    }
    return Object.entries(map).map(([k, v]) => ({ contrato: k, qtd: v })).sort((a, b) => b.qtd - a.qtd).slice(0, 10);
  }, [itens, contratos]);

  const evolucao = useMemo(() => {
    const byMonth: Record<string, { m: string; total: number; n: number }> = {};
    for (const h of hist as any[]) {
      const m = new Date(h.data_referencia).toISOString().slice(0, 7);
      byMonth[m] = byMonth[m] || { m, total: 0, n: 0 };
      byMonth[m].total += Number(h.preco);
      byMonth[m].n += 1;
    }
    return Object.values(byMonth).sort((a, b) => a.m.localeCompare(b.m)).map((r) => ({ mes: r.m, medio: r.total / r.n }));
  }, [hist]);

  const topAumentos = useMemo(() => (itens as any[])
    .filter((i) => i.preco_anterior > 0)
    .map((i) => ({ codigo: i.codigo, v: variacao(Number(i.preco_atual), Number(i.preco_anterior)) }))
    .sort((a, b) => b.v - a.v).slice(0, 10), [itens]);

  const topReducoes = useMemo(() => (itens as any[])
    .filter((i) => i.preco_anterior > 0)
    .map((i) => ({ codigo: i.codigo, v: variacao(Number(i.preco_atual), Number(i.preco_anterior)) }))
    .sort((a, b) => a.v - b.v).slice(0, 10), [itens]);

  const fornecedoresTop = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of itens as any[]) {
      const c = contratos.find((x: any) => x.id === it.contrato_id);
      if (!c) continue;
      map[c.fornecedor] = (map[c.fornecedor] ?? 0) + 1;
    }
    return Object.entries(map).map(([k, v]) => ({ fornecedor: k, qtd: v })).sort((a, b) => b.qtd - a.qtd).slice(0, 10);
  }, [itens, contratos]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Executivo</h1>
        <p className="text-muted-foreground mt-1">Visão consolidada de contratos, preços e reajustes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total de Contratos" value={num(contratos.length)} icon={FileText} accent="gold" />
        <KpiCard label="Fornecedores" value={num(stats.fornecedores)} icon={Users} accent="blue" />
        <KpiCard label="Códigos Únicos" value={num(stats.codigos)} icon={Package} accent="gold" />
        <KpiCard label="Itens com Aumento" value={num(stats.aumentos)} icon={TrendingUp} accent="orange" />
        <KpiCard label="Itens com Redução" value={num(stats.reducoes)} icon={TrendingDown} accent="emerald" />
        <KpiCard label="Economia Potencial" value={brl(stats.economia)} icon={PiggyBank} accent="emerald" />
        <KpiCard label="Impacto Financeiro" value={brl(stats.impacto)} icon={DollarSign} accent="orange" />
        <KpiCard label="Variação Média" value={pct(stats.aumentos + stats.reducoes > 0 ? ((stats.impacto - stats.economia) / Math.max(1, stats.aumentos + stats.reducoes)) : 0, 2)} accent="gold" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Códigos por Contrato" subtitle="Top 10 contratos com mais itens">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porContrato}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis dataKey="contrato" stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <YAxis stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="qtd" fill="oklch(0.77 0.14 82)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolução dos Preços" subtitle="Preço médio por mês">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis dataKey="mes" stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <YAxis stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <Tooltip contentStyle={tt} formatter={(v: any) => brl(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="medio" name="Preço médio" stroke="oklch(0.58 0.16 245)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Maiores Aumentos" subtitle="% de variação">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topAumentos} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis type="number" stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <YAxis dataKey="codigo" type="category" stroke="oklch(0.72 0.03 265)" fontSize={11} width={90} />
              <Tooltip contentStyle={tt} formatter={(v: any) => pct(v)} />
              <Bar dataKey="v" fill="oklch(0.65 0.18 30)" radius={[0,6,6,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Maiores Reduções" subtitle="% de variação">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topReducoes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis type="number" stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <YAxis dataKey="codigo" type="category" stroke="oklch(0.72 0.03 265)" fontSize={11} width={90} />
              <Tooltip contentStyle={tt} formatter={(v: any) => pct(v)} />
              <Bar dataKey="v" fill="oklch(0.68 0.15 160)" radius={[0,6,6,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Fornecedores com Mais Itens" subtitle="Top 10 fornecedores" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fornecedoresTop}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
              <XAxis dataKey="fornecedor" stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <YAxis stroke="oklch(0.72 0.03 265)" fontSize={11} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="qtd" fill="oklch(0.58 0.16 245)" radius={[6,6,0,0]} />
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

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card rounded-xl p-5 ${className ?? ""}`}>
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}