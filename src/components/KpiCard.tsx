import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: "gold" | "blue" | "emerald" | "orange";
}

const accents: Record<string, string> = {
  gold: "from-[oklch(0.77_0.14_82)]/25 to-transparent text-[oklch(0.77_0.14_82)]",
  blue: "from-[oklch(0.58_0.16_245)]/25 to-transparent text-[oklch(0.65_0.16_245)]",
  emerald: "from-emerald-500/25 to-transparent text-emerald-400",
  orange: "from-orange-500/25 to-transparent text-orange-400",
};

export function KpiCard({ label, value, hint, icon: Icon, accent = "gold" }: Props) {
  return (
    <div className="glass-card group relative overflow-hidden rounded-xl p-5 transition-all hover:border-[oklch(0.77_0.14_82)]/40 hover:shadow-[0_8px_40px_-12px_oklch(0.77_0.14_82_/_0.3)]">
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-60 blur-2xl", accents[accent])} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-white/5", accents[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}