import { Skeleton } from "@/components/ui/skeleton";
import { ui } from "@/lib/ui";

export function PageSkeleton() {
  return (
    <div className={`${ui.container} py-10 space-y-4`} data-testid="page-skeleton" aria-busy="true">
      <Skeleton className="h-8 w-2/3 rounded-xl" />
      <Skeleton className="h-4 w-full rounded-xl" />
      <Skeleton className="h-4 w-5/6 rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, testId }) {
  return (
    <header className="mb-8 gf-fade-up" data-testid={testId}>
      {eyebrow && <p className="gf-eyebrow mb-2">{eyebrow}</p>}
      <h1 className="text-3xl sm:text-4xl font-extrabold">{title}</h1>
      {subtitle && <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-2xl">{subtitle}</p>}
    </header>
  );
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className={ui.label}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="mt-1 text-sm text-destructive" role="alert" data-testid={`${id}-error`}>{error}</p>
      )}
    </div>
  );
}

export function FormError({ message, testId = "form-error" }) {
  if (!message) return null;
  return (
    <div role="alert" data-testid={testId} className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      {message}
    </div>
  );
}
