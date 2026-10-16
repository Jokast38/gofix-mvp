import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { userService } from "@/services/authService";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";

const ADDABLE = ["professional", "teacher", "student"];

export function ModeSwitcher() {
  const { t, te } = useI18n();
  const { user, setUser } = useAuth();

  const call = async (fn) => {
    try {
      setUser(await fn());
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };

  const hasProOrTeacher = user.roles.includes("professional") || user.roles.includes("teacher");
  const addable = ADDABLE.filter((r) => !user.roles.includes(r) && !(hasProOrTeacher && r !== "student"));

  return (
    <section className="gf-card p-5 sm:p-6 mt-6" aria-labelledby="mode-title">
      <h2 id="mode-title" className="text-lg font-bold">{t("account.modeTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("account.modeHint")}</p>
      <div role="radiogroup" className="mt-4 flex flex-wrap gap-2" data-testid="account-role-switcher">
        {user.roles.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={user.active_mode === r} data-testid={`mode-selector-${r}`}
            onClick={() => user.active_mode !== r && call(() => userService.setMode(r))}
            className={`min-h-[44px] rounded-full px-5 text-sm font-bold border transition-colors ${user.active_mode === r ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}>
            {t(`account.modes.${r}`)}
          </button>
        ))}
      </div>
      {addable.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase text-muted-foreground mb-2">{t("account.addRoleTitle")}</p>
          <div className="flex flex-wrap gap-2">
            {addable.map((r) => (
              <button key={r} type="button" className={ui.btnOutline} onClick={() => call(() => userService.addRole(r))} data-testid={`add-role-${r}`}>
                <Plus size={16} strokeWidth={1.5} />{t(`account.addRole.${r}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
