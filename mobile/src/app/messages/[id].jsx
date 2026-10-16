import { Fragment, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarPlus, Check, CheckCheck, Clock, Flag, Send, UserRound } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { jobService, socialService } from "@/api/services";
import { JobCard, ProposeJobSheet, ReportSheet } from "@/components/actions";
import { useI18n } from "@/i18n";
import { dayKey, daysAgo, formatDate, formatTime } from "@/lib/format";
import { BRAND, useTheme } from "@/theme";
import { Avatar, IconBtn, Loading, Sheet, Txt, useToast } from "@/ui";

const GAP = 5 * 60_000;

export default function Thread() {
  const { id } = useLocalSearchParams();
  const { c } = useTheme();
  const { t, te, rtl } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const scroller = useRef(null);
  const [body, setBody] = useState("");
  const [sheet, setSheet] = useState(null);
  const key = ["conversation", id];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => socialService.conversation(id), refetchInterval: 8_000 });
  const jobs = useQuery({ queryKey: ["jobs", "conv", id], queryFn: () => jobService.list({ conversation_id: id, status: "proposed,scheduled,disputed" }), refetchInterval: 20_000 });
  const count = data?.messages?.length || 0;
  useEffect(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 50); qc.invalidateQueries({ queryKey: ["conversations"] }); }, [count, qc]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setBody("");
    const temp = { id: `tmp-${Date.now()}`, body: text, mine: true, pending: true, created_at: new Date().toISOString() };
    qc.setQueryData(key, (d) => (d ? { ...d, messages: [...d.messages, temp] } : d));
    try { await socialService.send(id, text); } catch (err) {
      qc.setQueryData(key, (d) => (d ? { ...d, messages: d.messages.filter((m) => m.id !== temp.id) } : d));
      setBody(text);
      toast(te(errorCode(err)), "error");
    } finally { qc.invalidateQueries({ queryKey: key }); }
  };
  const Back = rtl ? ArrowRight : ArrowLeft;
  const profileLink = data?.role === "client" ? `/${data.kind === "teacher" ? "teacher" : "pro"}/${data.profile_id}` : null;
  const dayLabel = (d) => (daysAgo(d) <= 0 ? t("messages.today") : daysAgo(d) === 1 ? t("messages.yesterday") : formatDate(d));

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6, minHeight: 60, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
        <IconBtn onPress={() => (router.canGoBack() ? router.back() : router.replace("/messages"))} label={t("common.back")}><Back size={22} color={c.text} /></IconBtn>
        {data && (
          <Pressable onPress={() => profileLink && router.push(profileLink)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }} disabled={!profileLink}>
            <Avatar thumbKey={data.other.photo_thumb_key} name={data.other.name} size={40} color={BRAND.electric} />
            <View style={{ flex: 1 }}>
              <Txt weight={800} numberOfLines={1}>{data.other.name}</Txt>
              <Txt variant="tiny" muted>{data.role === "provider" ? t("messages.roles.client") : t(`messages.roles.${data.kind === "teacher" ? "teacher" : "professional"}`)}</Txt>
            </View>
          </Pressable>
        )}
        <IconBtn onPress={() => setSheet("job")} label={t("jobs.propose")} testID="thread-propose"><CalendarPlus size={21} color={c.text} /></IconBtn>
        <IconBtn onPress={() => setSheet("menu")} label={t("messages.options")}><Flag size={19} color={c.muted} /></IconBtn>
      </View>

      {jobs.data?.items?.length > 0 && (
        <ScrollView style={{ flexGrow: 0, maxHeight: 230, borderBottomWidth: 1, borderColor: c.border }} contentContainerStyle={{ padding: 10, gap: 8 }}>
          {jobs.data.items.map((j) => <JobCard key={j.id} job={j} compact />)}
        </ScrollView>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        <ScrollView ref={scroller} contentContainerStyle={{ padding: 12, paddingBottom: 16 }} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
          {isLoading ? <Loading /> : (data?.messages || []).map((m, i, arr) => {
            const prev = arr[i - 1];
            const next = arr[i + 1];
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const first = newDay || prev.mine !== m.mine || new Date(m.created_at) - new Date(prev.created_at) > GAP;
            const last = !next || next.mine !== m.mine || new Date(next.created_at) - new Date(m.created_at) > GAP;
            return (
              <Fragment key={m.id}>
                {newDay && <View style={{ alignItems: "center", marginVertical: 8 }}><View style={{ backgroundColor: c.cardAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}><Txt variant="tiny" muted weight={700}>{dayLabel(m.created_at)}</Txt></View></View>}
                <View style={{ alignItems: m.mine ? "flex-end" : "flex-start", marginTop: first ? 8 : 2 }}>
                  <View style={{ maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: m.mine ? BRAND.electric : c.cardAlt, opacity: m.pending ? 0.7 : 1,
                    ...(m.mine ? { borderBottomRightRadius: last ? 6 : 18 } : { borderBottomLeftRadius: last ? 6 : 18 }) }}>
                    <Txt auto color={m.mine ? BRAND.night : c.text}>{m.body}</Txt>
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Txt variant="tiny" color={m.mine ? "rgba(7,9,17,0.7)" : c.muted}>{formatTime(m.created_at)}</Txt>
                      {m.mine && (m.pending ? <Clock size={11} color="rgba(7,9,17,0.7)" /> : m.read_at ? <CheckCheck size={13} color="rgba(7,9,17,0.8)" /> : <Check size={13} color="rgba(7,9,17,0.8)" />)}
                    </View>
                  </View>
                </View>
              </Fragment>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
          <TextInput value={body} onChangeText={setBody} placeholder={t("messages.placeholder")} placeholderTextColor={c.muted} multiline maxLength={2000}
            style={{ flex: 1, maxHeight: 130, minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: c.input, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, color: c.text, fontSize: 16 }} testID="thread-input" />
          <Pressable onPress={send} disabled={!body.trim()} accessibilityRole="button" accessibilityLabel={t("messages.send")} testID="thread-send"
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: BRAND.pink, alignItems: "center", justifyContent: "center", opacity: body.trim() ? 1 : 0.4 }}>
            <Send size={20} color={BRAND.night} style={rtl ? { transform: [{ scaleX: -1 }] } : undefined} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {data && <ProposeJobSheet visible={sheet === "job"} onClose={() => setSheet(null)} conversationId={id} kind={data.kind} />}
      <Sheet visible={sheet === "menu"} onClose={() => setSheet(null)} title={t("messages.options")}>
        {profileLink && <Pressable onPress={() => { setSheet(null); router.push(profileLink); }} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10 }}><UserRound size={18} color={c.text} /><Txt>{t("messages.viewProfile")}</Txt></Pressable>}
        <Pressable onPress={() => setSheet("report")} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10 }}><Flag size={18} color="#F87171" /><Txt color="#F87171">{t("messages.report")}</Txt></Pressable>
      </Sheet>
      {data && <ReportSheet visible={sheet === "report"} onClose={() => setSheet(null)} targetType="user" targetId={data.other.id} />}
    </SafeAreaView>
  );
}
