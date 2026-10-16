import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useLocalized } from "@/i18n";
import { iconFor, neonFor } from "@/lib/icons";

export function CategoryTile({ cat, index, to }) {
  const loc = useLocalized();
  const Icon = iconFor(cat.icon);
  return (
    <Link to={to} className="gf-tile gf-fade-up" style={{ "--neon": neonFor(index), animationDelay: `${index * 50}ms` }}
      data-testid={`category-tile-${cat.key}`}>
      <Icon size={26} strokeWidth={1.6} aria-hidden="true" />
      <span className="gf-tile-label">{loc(cat)}</span>
    </Link>
  );
}

export function MoreTile({ to, label, index = 3 }) {
  return (
    <Link to={to} className="gf-tile gf-fade-up" style={{ "--neon": neonFor(index) }} data-testid="category-tile-more">
      <Plus size={26} strokeWidth={1.6} aria-hidden="true" />
      <span className="gf-tile-label">{label}</span>
    </Link>
  );
}
