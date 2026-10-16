import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageHeader, PageSkeleton } from "@/components/common/PageSkeleton";
import { useFaq } from "@/hooks/usePublic";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";

export default function Faq() {
  const { t, lang } = useI18n();
  const { data, isLoading, isError, refetch } = useFaq(lang);
  if (isLoading) return <PageSkeleton />;

  const groups = (data || []).reduce((acc, e) => ({ ...acc, [e.category]: [...(acc[e.category] || []), e] }), {});
  return (
    <div className={`${ui.container} py-10 max-w-3xl`} data-testid="faq-page">
      <PageHeader title={t("faq.title")} subtitle={t("faq.subtitle")} />
      {isError && <button type="button" onClick={() => refetch()} className={ui.btnOutline} data-testid="faq-retry">{t("common.retry")}</button>}
      {lang === "ar" && t("faq.arNotice") && <p className="mb-6 text-sm text-muted-foreground">{t("faq.arNotice")}</p>}
      {!isError && !data?.length && <p className="text-muted-foreground">{t("faq.empty")}</p>}
      {Object.entries(groups).map(([cat, entries]) => (
        <section key={cat} className="mb-8">
          <h2 className="gf-eyebrow mb-2">{t(`faq.categories.${cat}`)}</h2>
          <Accordion type="single" collapsible className="gf-card px-4">
            {entries.map((e, i) => (
              <AccordionItem key={e.question_fr} value={`${cat}-${i}`} className="last:border-0">
                <AccordionTrigger className="text-start font-bold min-h-[52px]" data-testid={`faq-q-${cat}-${i}`}>
                  {(lang === "ar" && e.question_ar) || e.question_fr}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed" lang={lang === "ar" && e.answer_ar ? "ar" : "fr"}>
                  {(lang === "ar" && e.answer_ar) || e.answer_fr}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
