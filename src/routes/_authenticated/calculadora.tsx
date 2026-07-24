import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { brl, pct } from "@/lib/format";
import { Calculator } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calculadora")({
  head: () => ({ meta: [{ title: "Calculadora — Contract Insight" }] }),
  component: Calc,
});

type H = { antigo: number; novo: number; v: number; dif: number; at: string };

function Calc() {
  const [antigo, setAntigo] = useState("");
  const [novo, setNovo] = useState("");
  const [res, setRes] = useState<H | null>(null);
  const [hist, setHist] = useState<H[]>([]);

  const calc = () => {
    const a = parseFloat(antigo.replace(",", "."));
    const n = parseFloat(novo.replace(",", "."));
    if (!a || isNaN(n)) return;
    const v = ((n - a) / a) * 100;
    const item: H = { antigo: a, novo: n, v, dif: n - a, at: new Date().toLocaleString("pt-BR") };
    setRes(item);
    setHist((h) => [item, ...h].slice(0, 20));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calculadora de Reajuste</h1>
        <p className="text-muted-foreground mt-1">Calcule variação percentual entre dois preços.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Preço Antigo (R$)</Label>
              <Input inputMode="decimal" value={antigo} onChange={(e) => setAntigo(e.target.value)} placeholder="2,00" />
            </div>
            <div className="space-y-2">
              <Label>Preço Novo (R$)</Label>
              <Input inputMode="decimal" value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="2,87" />
            </div>
          </div>
          <Button onClick={calc} className="w-full bg-[oklch(0.77_0.14_82)] text-[oklch(0.15_0.03_265)] hover:bg-[oklch(0.82_0.14_82)] font-semibold">
            <Calculator className="h-4 w-4 mr-2" />Calcular
          </Button>

          {res && (
            <div className="mt-4 space-y-3 pt-4 border-t border-border/60">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Variação percentual</div>
                <div className={`text-4xl font-bold ${res.v >= 0 ? "text-orange-400" : "text-emerald-400"}`}>{pct(res.v)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-[10px] uppercase text-muted-foreground">Diferença</div><div className="font-semibold">{brl(res.dif)}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Valor absoluto</div><div className="font-semibold">{brl(Math.abs(res.dif))}</div></div>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/60"><h3 className="font-semibold">Histórico</h3></div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-right p-2">Antigo</th>
                  <th className="text-right p-2">Novo</th>
                  <th className="text-right p-2">Var.</th>
                  <th className="text-right p-2">Dif.</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((h, idx) => (
                  <tr key={idx} className="border-t border-border/40">
                    <td className="p-2 text-right">{brl(h.antigo)}</td>
                    <td className="p-2 text-right">{brl(h.novo)}</td>
                    <td className={`p-2 text-right font-semibold ${h.v >= 0 ? "text-orange-400" : "text-emerald-400"}`}>{pct(h.v)}</td>
                    <td className="p-2 text-right">{brl(h.dif)}</td>
                  </tr>
                ))}
                {hist.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum cálculo ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}