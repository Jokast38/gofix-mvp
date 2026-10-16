import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/common/PageSkeleton";
import { useConfig } from "@/hooks/usePublic";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";
import NotFound from "./NotFound";

const SLUGS = ["mentions", "cgu", "cgv", "privacy"];

/** Replaces {company_rc}-style fields with the values set in the back-office; empty ones are highlighted. */
function Filled({ text, settings, missing }) {
  const parts = String(text).split(/(\{\w+\})/g);
  return parts.map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    if (!m) return <Fragment key={i}>{part}</Fragment>;
    const value = settings[m[1]];
    return value
      ? <Fragment key={i}>{value}</Fragment>
      : <span key={i} className="rounded bg-brand-orange/15 px-1 font-semibold text-brand-orange" data-testid="legal-missing">[{missing}]</span>;
  });
}

export default function Legal() {
  const { slug } = useParams();
  const { t } = useI18n();
  const { settings = {} } = useConfig();
  if (!SLUGS.includes(slug)) return <NotFound />;
  const doc = t(`legal.${slug}`);
  const missing = t("legal.missing");
  const fill = (text) => <Filled text={text} settings={settings} missing={missing} />;
  return (
    <div className={`${ui.container} py-10 max-w-3xl`} data-testid={`legal-page-${slug}`}>
      <PageHeader title={doc.title} />
      <p className="-mt-4 mb-6 text-sm text-muted-foreground" data-testid="legal-version">{fill(t("legal.version"))}</p>
      {!settings.legal_reviewed && (
        <p className="mb-8 flex gap-2 rounded-xl border border-brand-orange/40 bg-brand-orange/5 p-4 text-sm" role="note" data-testid="legal-disclaimer">
          <TriangleAlert size={18} strokeWidth={1.5} className="shrink-0 text-brand-orange" aria-hidden="true" />{t("legal.disclaimer")}
        </p>
      )}
      <div className="space-y-7">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-lg font-bold">{s.h}</h2>
            {s.table && (
              <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary"><tr>{s.table.head.map((h) => <th key={h} className="px-3 py-2 text-start font-bold">{h}</th>)}</tr></thead>
                  <tbody>{s.table.rows.map((r) => (
                    <tr key={r[0]} className="border-t border-border">{r.map((c, i) => <td key={i} className="px-3 py-2 align-top text-muted-foreground">{c}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {[].concat(s.p || []).map((p) => (
              <p key={p.slice(0, 40)} className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">{fill(p)}</p>
            ))}
            {s.items && (
              <ul className="mt-2 space-y-1.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
                {s.items.map((it) => <li key={it} className="flex gap-2"><span aria-hidden="true" className="text-brand-electric">•</span><span>{fill(it)}</span></li>)}
              </ul>
            )}
          </section>
        ))}
      </div>
      <h2 className="mt-12 text-sm font-bold text-muted-foreground">{t("legal.nav")}</h2>
      <nav className="mt-3 flex flex-wrap gap-2">
        {SLUGS.filter((x) => x !== slug).map((x) => (
          <Link key={x} to={`/legal/${x}`} className={ui.btnOutline} data-testid={`legal-link-${x}`}>{t(`legal.${x}.title`)}</Link>
        ))}
      </nav>
    </div>
  );
}
