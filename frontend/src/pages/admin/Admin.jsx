import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageSkeleton";
import { AdminDashboard } from "./AdminDashboard";
import { AdminUsers } from "./AdminUsers";
import { AdminFlags } from "./AdminFlags";
import { AdminSettings } from "./AdminSettings";
import { AdminAudit } from "./AdminAudit";
import { AdminTaxonomy } from "./AdminTaxonomy";
import { AdminValidation } from "./AdminValidation";
import { AdminDisputes, AdminReports, AdminTickets, AdminTrust } from "./AdminModeration";
import { AdminPayments, AdminPlans } from "./AdminPlans";
import { AdminPaymentConfig } from "./AdminPaymentConfig";
import { AdminCompany } from "./AdminCompany";
import { AdminEmailConfig } from "./AdminEmailConfig";
import { AdminFaq } from "./AdminFaq";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";

// roles: who sees the tab (null = every admin, [] = super-admin only); edit: who may change things there.
const TABS = [
  { key: "dashboard", C: AdminDashboard, roles: null, edit: [] },
  { key: "users", C: AdminUsers, roles: ["moderator", "support"], edit: [] },
  { key: "validation", C: AdminValidation, roles: ["moderator", "support"], edit: ["moderator"] },
  { key: "reports", C: AdminReports, roles: ["moderator"], edit: ["moderator"] },
  { key: "disputes", C: AdminDisputes, roles: ["moderator", "support"], edit: ["moderator"] },
  { key: "trust", C: AdminTrust, roles: ["moderator"], edit: ["moderator"] },
  { key: "tickets", C: AdminTickets, roles: ["moderator", "support"], edit: ["moderator", "support"] },
  { key: "faq", C: AdminFaq, roles: ["support"], edit: ["support"] },
  { key: "plans", C: AdminPlans, roles: null, edit: [] },
  { key: "payments", C: AdminPayments, roles: ["moderator", "support"], edit: [] },
  { key: "gateway", C: AdminPaymentConfig, roles: [], edit: [] },
  { key: "mail", C: AdminEmailConfig, roles: [], edit: [] },
  { key: "company", C: AdminCompany, roles: [], edit: [] },
  { key: "taxonomy", C: AdminTaxonomy, roles: ["moderator", "support"], edit: ["moderator"] },
  { key: "flags", C: AdminFlags, roles: null, edit: [] },
  { key: "settings", C: AdminSettings, roles: null, edit: [] },
  { key: "audit", C: AdminAudit, roles: [], edit: [] },
];

export default function Admin() {
  const { t } = useI18n();
  const { user } = useAuth();
  const role = user.admin_role;
  const tabs = TABS.filter((x) => role === "super_admin" || x.roles === null || x.roles.includes(role));
  const [tab, setTab] = useState("dashboard");

  return (
    <div className={`${ui.container} py-8`} data-testid="admin-page">
      <PageHeader title={t("admin.title")} subtitle={`${t("admin.subtitle")} · ${role}`} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-2xl bg-secondary p-1">
          {tabs.map((x) => (
            <TabsTrigger key={x.key} value={x.key} className="min-h-[40px] rounded-xl px-4 font-semibold" data-testid={`admin-tab-${x.key}`}>
              {t(`admin.tabs.${x.key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(({ key, C, edit }) => (
          <TabsContent key={key} value={key} className="mt-6"><C canEdit={role === "super_admin" || edit.includes(role)} /></TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
