import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react-native";
import { jobService } from "@/api/services";
import { useI18n } from "@/i18n";
import { Chip, Empty, Loading, Row } from "@/ui";
import { JobCard } from "./actions";

const TABS = { upcoming: ["proposed", "scheduled", "disputed"], past: ["completed", "cancelled", "failed"] };

export function JobsList({ role }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("upcoming");
  const { data, isLoading } = useQuery({ queryKey: ["jobs", tab], queryFn: () => jobService.list({ status: TABS[tab].join(",") }), refetchInterval: 30_000 });
  const items = (data?.items || []).filter((j) => !role || j.role === role);
  const sorted = tab === "upcoming" ? [...items].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)) : items;
  return (
    <View style={{ gap: 12 }}>
      <Row gap={8}>{Object.keys(TABS).map((k) => <Chip key={k} label={t(`jobs.tabs.${k}`)} selected={tab === k} onPress={() => setTab(k)} testID={`jobs-${k}`} />)}</Row>
      {isLoading ? <Loading /> : !sorted.length ? <Empty icon={CalendarClock} text={t(`jobs.empty.${tab}`)} /> : sorted.map((j) => <JobCard key={j.id} job={j} />)}
    </View>
  );
}
