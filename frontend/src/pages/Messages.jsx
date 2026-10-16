import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Check, CheckCheck, Clock, Flag, MessageCircle, MoreVertical, Search, Send, UserRound } from "lucide-react";
import { JobCard, ProposeJobDialog } from "@/components/jobs/Jobs";
import { toast } from "sonner";
import { Avatar } from "@/components/catalog/Cards";
import { ReportButton } from "@/components/common/ReportButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { dayKey, daysAgo, errorCode, formatDate, formatTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { jobService, socialService } from "@/services/marketplaceService";

const GROUP_GAP_MS = 5 * 60_000;

function useWhen() {
  const { t } = useI18n();
  return (d, withTimeToday = true) => {
    const n = daysAgo(d);
    if (n <= 0) return withTimeToday ? formatTime(d) : t("messages.today");
    if (n === 1) return t("messages.yesterday");
    return formatDate(d);
  };
}

function roleLabel(c, t) {
  if (c.role === "provider") return t("messages.roles.client");
  return t(`messages.roles.${c.kind === "teacher" ? "teacher" : "professional"}`);
}

// ---------- Conversation list (full width rows, thumb-friendly) ----------
function ConversationList({ activeId }) {
  const { t } = useI18n();
  const when = useWhen();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["conversations"], queryFn: socialService.conversations, refetchInterval: 20_000 });
  const items = useMemo(() => {
    const all = data?.items || [];
    const s = q.trim().toLowerCase();
    return s ? all.filter((c) => `${c.other.name} ${c.last_message?.body || ""}`.toLowerCase().includes(s)) : all;
  }, [data, q]);

  if (isLoading) {
    return <div className="space-y-1 p-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}</div>;
  }
  if (!data?.items.length) {
    return (
      <div className="px-6 py-16 text-center text-muted-foreground" data-testid="messages-empty">
        <span className="mx-auto mb-4 grid place-items-center h-16 w-16 rounded-full bg-secondary"><MessageCircle size={30} strokeWidth={1.4} /></span>
        <p className="text-sm">{t("messages.empty")}</p>
        <Link to="/requests" className={`${ui.btnGradient} mt-5`}>{t("catalog.publishRequest")}</Link>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <div className="px-4 pt-1 pb-3 md:p-3 md:border-b md:border-border">
        <label className="relative block">
          <span className="sr-only">{t("messages.search")}</span>
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-muted-foreground" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("messages.search")} type="search"
            className="w-full min-h-[44px] rounded-full border border-input bg-secondary/60 ps-10 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" data-testid="messages-search" />
        </label>
      </div>
      {!items.length ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("messages.noResults")}</p> : (
        <ul className="divide-y divide-border/70" data-testid="conversation-list">
          {items.map((c) => {
            const unread = c.unread > 0;
            const mine = c.last_message && c.last_message.sender_id !== c.other.id;
            return (
              <li key={c.id}>
                <Link to={`/messages/${c.id}`} data-testid={`conversation-${c.id}`} aria-current={activeId === c.id ? "page" : undefined}
                  className={`flex items-center gap-3 px-4 min-h-[76px] py-2.5 transition-colors active:bg-secondary ${activeId === c.id ? "bg-secondary" : "hover:bg-secondary/60"}`}>
                  <Avatar thumbKey={c.other.photo_thumb_key} name={c.other.name} size="h-12 w-12 text-base" color={c.role === "provider" ? "var(--brand-orange)" : "var(--brand-electric)"} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={`flex-1 min-w-0 truncate ${unread ? "font-extrabold" : "font-bold"}`}>{c.other.name}</span>
                      <span className={`shrink-0 text-[11px] ${unread ? "text-brand-electric font-bold" : "text-muted-foreground"}`}>{c.last_message?.at ? when(c.last_message.at) : ""}</span>
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">{roleLabel(c, t)}</span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className={`flex-1 min-w-0 truncate text-sm ${unread ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {mine && <span className="text-muted-foreground font-normal">{t("messages.you")} : </span>}<bdi>{c.last_message?.body || "…"}</bdi>
                      </span>
                      {unread && <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full gf-gradient-bg text-[11px] font-extrabold grid place-items-center" data-testid="conversation-unread">{c.unread > 99 ? "99+" : c.unread}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Thread ----------
function DaySeparator({ date }) {
  const when = useWhen();
  return (
    <li className="flex justify-center py-2" aria-hidden="false">
      <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">{when(date, false)}</span>
    </li>
  );
}

function Bubble({ m, first, last }) {
  const { t } = useI18n();
  const mine = m.mine;
  const shape = mine
    ? `rounded-2xl ${last ? "rounded-ee-md" : ""} ${first ? "" : "rounded-se-md"}`
    : `rounded-2xl ${last ? "rounded-es-md" : ""} ${first ? "" : "rounded-ss-md"}`;
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"} ${first ? "mt-2" : "mt-0.5"}`}>
      <div className={`max-w-[82%] sm:max-w-[70%] px-3.5 py-2 text-[15px] leading-snug shadow-sm ${shape} ${mine ? "gf-gradient-bg text-[#070911]" : "bg-secondary"} ${m.pending ? "opacity-70" : ""}`}
        data-testid={mine ? "message-mine" : "message-other"}>
        <p dir="auto" className="whitespace-pre-line break-words [overflow-wrap:anywhere] text-start">{m.body}</p>
        <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-[#070911]/70" : "text-muted-foreground"}`}>
          {formatTime(m.created_at)}
          {mine && (m.pending ? <Clock size={11} aria-label={t("messages.sending")} /> : m.read_at
            ? <CheckCheck size={13} aria-label={t("messages.read")} /> : <Check size={13} aria-label={t("messages.sent")} />)}
        </p>
      </div>
    </li>
  );
}

function Composer({ onSend }) {
  const { t } = useI18n();
  const [body, setBody] = useState("");
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [body]);
  const submit = (e) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBody("");
    onSend(text, () => setBody(text));
    ref.current?.focus();
  };
  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-border bg-card px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <label htmlFor="msg-input" className="sr-only">{t("messages.placeholder")}</label>
      <textarea id="msg-input" ref={ref} rows={1} dir="auto" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("messages.placeholder")}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) submit(e); }}
        enterKeyHint="send"
        className="flex-1 min-w-0 resize-none rounded-3xl border border-input bg-background/60 px-4 py-[11px] text-base leading-snug max-h-[140px] focus:outline-none focus:ring-2 focus:ring-ring"
        data-testid="thread-input" />
      <button type="submit" disabled={!body.trim()} aria-label={t("messages.send")} data-testid="thread-send"
        className="grid place-items-center h-11 w-11 shrink-0 rounded-full gf-gradient-bg disabled:opacity-40 active:scale-95 transition-transform">
        <Send size={19} className="rtl:-scale-x-100" />
      </button>
    </form>
  );
}

function Thread({ id }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const scroller = useRef(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const key = ["conversation", id];
  const jobs = useQuery({ queryKey: ["jobs", "conv", id], queryFn: () => jobService.list({ conversation_id: id, status: "proposed,scheduled,disputed" }), refetchInterval: 20_000 });
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => socialService.conversation(id), refetchInterval: 8_000 });
  const count = data?.messages?.length || 0;

  // Mobile full-screen layer: freeze the page behind it.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, id]);
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["conversations"] });
    qc.invalidateQueries({ queryKey: ["unread"] });
  }, [count, qc]);

  const send = async (text, restore) => {
    const temp = { id: `tmp-${Date.now()}`, body: text, mine: true, pending: true, created_at: new Date().toISOString() };
    qc.setQueryData(key, (d) => (d ? { ...d, messages: [...d.messages, temp] } : d));
    try {
      await socialService.send(id, text);
    } catch (err) {
      qc.setQueryData(key, (d) => (d ? { ...d, messages: d.messages.filter((m) => m.id !== temp.id) } : d));
      restore();
      toast.error(te(errorCode(err)));
    } finally {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
  };

  const profileLink = data && data.role === "client" ? `/${data.kind === "teacher" ? "teacher" : "pro"}/${data.profile_id}` : null;

  return (
    // Mobile: full-screen layer above the site header and the bottom nav. Desktop: right pane.
    <section className="fixed inset-0 z-50 flex flex-col bg-background md:static md:z-auto md:h-full md:bg-transparent" data-testid="thread" aria-label={data?.other?.name}>
      <header className="flex items-center gap-2 border-b border-border bg-card px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 md:pt-2">
        <button type="button" onClick={() => navigate("/messages")} className={`${ui.btnGhost} md:hidden`} aria-label={t("common.back")} data-testid="thread-back">
          <ArrowLeft size={22} className="rtl:rotate-180" />
        </button>
        {isLoading ? <Skeleton className="h-10 w-40 rounded-full" /> : data && (
          <>
            {profileLink ? (
              <Link to={profileLink} className="flex min-w-0 flex-1 items-center gap-3 rounded-full py-1 pe-2" data-testid="thread-profile-link">
                <Avatar thumbKey={data.other.photo_thumb_key} name={data.other.name} size="h-10 w-10 text-sm" color="var(--brand-electric)" />
                <span className="min-w-0"><span className="block font-extrabold truncate" data-testid="thread-name">{data.other.name}</span><span className="block text-[11px] text-muted-foreground truncate">{roleLabel(data, t)}</span></span>
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3 py-1">
                <Avatar thumbKey={data.other.photo_thumb_key} name={data.other.name} size="h-10 w-10 text-sm" color="var(--brand-orange)" />
                <span className="min-w-0"><span className="block font-extrabold truncate" data-testid="thread-name">{data.other.name}</span><span className="block text-[11px] text-muted-foreground truncate">{roleLabel(data, t)}</span></span>
              </div>
            )}
            <button type="button" onClick={() => setProposeOpen(true)} className={ui.btnGhost} aria-label={t("jobs.propose")} data-testid="thread-propose-job">
              <CalendarPlus size={20} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={ui.btnGhost} aria-label={t("messages.options")} data-testid="thread-menu"><MoreVertical size={20} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {profileLink && <DropdownMenuItem onSelect={() => navigate(profileLink)} className="min-h-[44px] gap-2"><UserRound size={16} />{t("messages.viewProfile")}</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => setReportOpen(true)} className="min-h-[44px] gap-2 text-destructive" data-testid="thread-report"><Flag size={16} />{t("messages.report")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </header>

      {jobs.data?.items?.length > 0 && (
        <div className="border-b border-border bg-card/60 px-3 py-2 max-h-[38vh] overflow-y-auto space-y-2" data-testid="thread-jobs">
          {jobs.data.items.map((j) => <JobCard key={j.id} job={j} compact />)}
        </div>
      )}
      <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5" aria-live="polite">
        {isLoading ? <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className={`h-12 w-2/3 rounded-2xl ${i % 2 ? "ms-auto" : ""}`} />)}</div>
          : error || !data ? <p className="py-10 text-center text-muted-foreground">{t("notFound.title")}</p> : (
            <ol className="mx-auto max-w-3xl">
              {data.messages.map((m, i) => {
                const prev = data.messages[i - 1];
                const next = data.messages[i + 1];
                const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
                const first = newDay || prev.mine !== m.mine || new Date(m.created_at) - new Date(prev.created_at) > GROUP_GAP_MS;
                const last = !next || next.mine !== m.mine || dayKey(next.created_at) !== dayKey(m.created_at) || new Date(next.created_at) - new Date(m.created_at) > GROUP_GAP_MS;
                return <Fragment key={m.id}>{newDay && <DaySeparator date={m.created_at} />}<Bubble m={m} first={first} last={last} /></Fragment>;
              })}
            </ol>
          )}
      </div>

      {data && <Composer onSend={send} />}
      {data && <ReportButton targetType="user" targetId={data.other.id} open={reportOpen} onOpenChange={setReportOpen} hideTrigger />}
      {data && <ProposeJobDialog open={proposeOpen} onOpenChange={setProposeOpen} conversationId={id} kind={data.kind} />}
    </section>
  );
}

export default function Messages() {
  const { id } = useParams();
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-6xl md:px-6 md:py-8" data-testid="messages-page">
      <h1 className="px-4 pt-5 pb-3 text-2xl font-extrabold md:hidden">{t("messages.title")}</h1>
      <div className="md:grid md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:h-[calc(100dvh-10rem)] md:min-h-[480px] md:gf-card md:overflow-hidden">
        <aside className="min-w-0 md:border-e md:border-border md:overflow-y-auto">
          <h1 className="hidden md:block px-4 pt-4 text-xl font-extrabold">{t("messages.title")}</h1>
          <ConversationList activeId={id} />
        </aside>
        {id ? <Thread key={id} id={id} /> : (
          <div className="hidden md:grid place-items-center text-center text-muted-foreground p-8">
            <div><MessageCircle size={40} strokeWidth={1.2} className="mx-auto mb-3" /><p className="text-sm">{t("messages.pick")}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}
