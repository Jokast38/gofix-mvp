import { useLocalSearchParams } from "expo-router";
import { QuoteEditorScreen } from "@/components/QuoteEditor";

/** New quote for a lead. */
export default function NewQuote() {
  const { id } = useLocalSearchParams();
  return <QuoteEditorScreen leadId={String(id)} />;
}
