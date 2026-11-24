import { useState } from "react";
import { Alert, Share, Switch, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Plus, QrCode, Share2, Trash2, X } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { passportService } from "@/api/services";
import { PassportCard } from "@/components/passport";
import { useConfig } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { BRAND, useTheme } from "@/theme";
import { Btn, Card, IconBtn, Input, Loading, Row, Screen, Section, TopBar, Txt, useToast } from "@/ui";

const VIS = ["full_name", "city", "photo", "rating", "trust"];
const CREDS = ["id_card", "diploma", "trade_register"];
const CRED_COLOR = { validated: BRAND.electric, submitted: BRAND.orange, expired: "#ef4444", rejected: "#ef4444" };

function History() {
  const { t } = useI18n();
  const { data = [] } = useQuery({ queryKey: ["passport-history"], queryFn: passportService.history });
  if (!data.length) return <Txt variant="small" muted>{t("passport.historyEmpty")}</Txt>;
  return (
    <View style={{ gap: 8 }}>
      {data.map((h, i) => (
        <Row key={i} style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Txt variant="small" style={{ flex: 1 }}>
            <Txt variant="small" weight={700}>{t(`passport.actions.${h.action.split(".")[1]}`)}</Txt>
            {h.meta?.label || h.meta?.type ? ` · ${h.meta.label || t(`passport.creds.${h.meta.type}`)}` : ""}
          </Txt>
          <Txt variant="tiny" muted>{formatDate(h.at)} · {t(`passport.by.${h.by}`)}</Txt>
        </Row>
      ))}
    </View>
  );
}

export default function MyPassport() {
  const { c } = useTheme();
  const { t, te } = useI18n();
  const { flag } = useConfig();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ["passport-me"], queryFn: passportService.me, retry: false, enabled: flag("passport") });
  const [skill, setSkill] = useState("");
  const [busy, setBusy] = useState(null);
  const run = async (key, action) => {
    setBusy(key);
    try {
      qc.setQueryData(["passport-me"], await action());
      qc.invalidateQueries({ queryKey: ["passport-history"] });
      return true;
    } catch (err) {
      toast(te(errorCode(err)), "error");
      return false;
    } finally { setBusy(null); }
  };
  const addSkill = async () => {
    if (skill.trim().length >= 2 && await run("skill", () => passportService.addSkill(skill.trim()))) setSkill("");
  };
  const revoke = () => Alert.alert(t("passport.revoke"), t("passport.revokeConfirm"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("passport.revoke"), style: "destructive", onPress: () => run("revoke", passportService.revoke) },
  ]);

  let body;
  if (!flag("passport")) body = <Card><Txt variant="small">{t("errors.feature_disabled")}</Txt></Card>;
  else if (isLoading) body = <Loading />;
  else if (error) body = <Card><Txt variant="small">{te(errorCode(error))}</Txt></Card>;
  else {
    const published = data.status === "published";
    const isPublicProfile = ["verified", "unverified"].includes(data.profile_status);
    const token = data.share?.url.split("/p/")[1];
    body = (
      <View style={{ gap: 4 }}>
        <Txt variant="small" muted>{t("passport.subtitle")}</Txt>
        <Card style={{ gap: 10, marginTop: 12 }} testID="passport-status">
          <Row style={{ justifyContent: "space-between" }}>
            <Txt weight={800} color={published ? BRAND.electric : BRAND.orange}>{t(`passport.status.${data.status}`)}</Txt>
            <Txt variant="small" weight={700}>{t("passport.completeness", { pct: data.completeness })}</Txt>
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.border, overflow: "hidden" }}>
            <View style={{ height: 8, width: `${data.completeness}%`, backgroundColor: BRAND.electric }} />
          </View>
          {!isPublicProfile ? <Txt variant="small" color={BRAND.orange}>{t("passport.notPublic")}</Txt> : null}
          <Btn small variant={published ? "outline" : "gradient"} title={t(published ? "passport.unpublish" : "passport.publish")} loading={busy === "publish"}
            disabled={!published && !isPublicProfile} onPress={() => run("publish", () => passportService.publish(!published))} testID="passport-publish" />
        </Card>

        <Section title={t("passport.checksTitle")}>
          <View style={{ gap: 8 }}>
            {CREDS.map((k) => {
              const cr = data.credentials[k];
              return (
                <Row key={k} style={{ justifyContent: "space-between", borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <Txt variant="small" weight={700}>{t(`passport.creds.${k}`)}</Txt>
                  <Txt variant="tiny" weight={700} color={CRED_COLOR[cr.status]} muted={!CRED_COLOR[cr.status]}>
                    {t(`passport.credStatus.${cr.status}`)}{cr.expires_at && cr.status === "validated" ? ` · ${t("passport.expiresOn", { date: formatDate(cr.expires_at) })}` : ""}
                  </Txt>
                </Row>
              );
            })}
            <Btn small variant="outline" title={t("passport.addDocs")} onPress={() => router.push("/dashboard")} />
          </View>
        </Section>

        <Section title={t("passport.skillsTitle")}>
          <View style={{ gap: 8 }} testID="passport-skills">
            <Txt variant="tiny" muted>{t("passport.skillsHint")}</Txt>
            <Row gap={8}>
              <Input value={skill} onChangeText={setSkill} maxLength={60} placeholder={t("passport.skillPlaceholder")} style={{ flex: 1 }} onSubmitEditing={addSkill} testID="passport-skill-input" />
              <Btn small icon={Plus} title={t("passport.addSkill")} loading={busy === "skill"} disabled={skill.trim().length < 2} onPress={addSkill} testID="passport-skill-add" />
            </Row>
            {data.skills.map((s) => (
              <Row key={s.id} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingStart: 12 }}>
                <Txt variant="small" auto style={{ flex: 1 }}>{s.label}</Txt>
                <Txt variant="tiny" weight={700} color={s.verified ? BRAND.electric : undefined} muted={!s.verified}>{t(s.verified ? "passport.verified" : "passport.declared")}</Txt>
                <IconBtn label={t("passport.removeSkill", { label: s.label })} onPress={() => run(`rm-${s.id}`, () => passportService.removeSkill(s.id))}><Trash2 size={18} color={c.muted} /></IconBtn>
              </Row>
            ))}
          </View>
        </Section>

        <Section title={t("passport.visibilityTitle")}>
          <View style={{ gap: 4 }}>
            {VIS.map((v) => (
              <Row key={v} style={{ justifyContent: "space-between", minHeight: 44 }}>
                <Txt variant="small" style={{ flex: 1 }}>{t(`passport.vis.${v}`)}</Txt>
                <Switch value={Boolean(data.visibility[v])} onValueChange={(on) => run(`vis-${v}`, () => passportService.update({ visibility: { [v]: on } }))}
                  trackColor={{ true: BRAND.electric }} accessibilityLabel={t(`passport.vis.${v}`)} testID={`passport-vis-${v}`} />
              </Row>
            ))}
            <Txt variant="tiny" muted>{t("passport.phoneHidden")} · {t("passport.docsPrivate")}</Txt>
          </View>
        </Section>

        <Section title={t("passport.shareTitle")}>
          <View style={{ gap: 10 }} testID="passport-share">
            <Txt variant="tiny" muted>{t("passport.shareHint")}</Txt>
            {!published ? <Txt variant="small" color={BRAND.orange}>{t("passport.publishFirst")}</Txt> : null}
            {data.share ? (
              <>
                <View style={{ alignItems: "center" }}>
                  <Image source={{ uri: data.share.qr }} style={{ width: 200, height: 200, borderRadius: 12, backgroundColor: "#fff" }} contentFit="contain"
                    accessibilityLabel={t("passport.shareTitle")} testID="passport-qr" />
                </View>
                <Txt variant="tiny" selectable style={{ textAlign: "left", writingDirection: "ltr" }} testID="passport-url">{data.share.url}</Txt>
                <Btn small variant="gradient" icon={Share2} title={t("passport.share")} onPress={() => Share.share({ message: data.share.url, url: data.share.url }).catch(() => {})} />
                <Btn small variant="outline" icon={Globe} title={t("passport.preview")} onPress={() => router.push(`/p/${token}`)} />
                <Btn small variant="ghost" icon={X} title={t("passport.revoke")} onPress={revoke} testID="passport-revoke" />
              </>
            ) : (
              <Btn small variant="gradient" icon={QrCode} title={t("passport.createLink")} loading={busy === "share"} onPress={() => run("share", passportService.share)} testID="passport-create-link" />
            )}
          </View>
        </Section>

        <Section title={t("passport.preview")}><PassportCard data={data.preview} /></Section>
        <Section title={t("passport.historyTitle")}><History /></Section>
      </View>
    );
  }
  return (
    <Screen padded={false} refreshing={isRefetching} onRefresh={refetch}>
      <TopBar title={t("passport.title")} />
      <View style={{ padding: 16, paddingBottom: 32 }} testID="passport-page">{body}</View>
    </Screen>
  );
}
