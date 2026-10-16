import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, GraduationCap, MonitorPlay, Wrench } from "lucide-react";
import { useI18n } from "@/i18n";
import { useConfig } from "@/hooks/usePublic";

const UNIVERSES = [
  { id: "services", key: "services", to: "/search", icon: Wrench, color: "var(--brand-electric)", img: "/assets/univers/services.jpg" },
  { id: "soutien", key: "academy", to: "/academy", icon: GraduationCap, color: "var(--brand-orange-ui)", img: "/assets/univers/soutien.jpg" },
  { id: "academy", key: "remote", to: "/academy?format=online", icon: MonitorPlay, color: "var(--brand-violet)", flag: "remote_courses", img: "/assets/univers/academy.jpg" },
];

function UniverseCard({ u, index }) {
  const { t } = useI18n();
  const c = t(`home.universes.${u.key}`);
  const Icon = u.icon;
  return (
    <Link to={u.to} data-testid={`univers-card-${u.id}`} style={{ animationDelay: `${index * 80}ms` }}
      className="gf-card gf-card-hover gf-fade-up relative block overflow-hidden group">
      <div className="relative h-40 overflow-hidden">
        <img src={u.img} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" aria-hidden="true" />
        <span className="absolute top-3 end-3 rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase text-white"
          style={{ background: u.color }}>{c.badge}</span>
      </div>
      <div className="p-5 sm:p-6 pt-3">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center h-11 w-11 rounded-xl border"
          style={{ color: u.color, borderColor: `color-mix(in srgb, ${u.color} 40%, transparent)`, background: `color-mix(in srgb, ${u.color} 12%, transparent)` }}>
          <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-lg font-bold">{c.title}</h3>
          <p className="text-xs text-muted-foreground">{c.subtitle}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-2">
        {c.items.map((it) => (
          <li key={it} className="flex items-center gap-2 text-sm">
            <CircleCheck size={16} strokeWidth={1.5} style={{ color: u.color }} aria-hidden="true" />{it}
          </li>
        ))}
      </ul>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold" style={{ color: u.color }}>
        {c.cta}
        <ArrowRight size={16} strokeWidth={2} className="rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" aria-hidden="true" />
      </span>
      </div>
    </Link>
  );
}

export function Universes() {
  const { flags } = useConfig();
  const list = UNIVERSES.filter((u) => !u.flag || flags[u.flag] !== false);
  return (
    <div className={`grid grid-cols-1 gap-6 ${list.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {list.map((u, i) => <UniverseCard key={u.id} u={u} index={i} />)}
    </div>
  );
}
