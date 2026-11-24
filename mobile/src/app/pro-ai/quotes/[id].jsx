import { useLocalSearchParams } from "expo-router";
import { QuoteEditorScreen } from "@/components/QuoteEditor";

/** A quote of the pro: editable while draft, then preview, send and follow-up. */
export default function ProQuote() {
  const { id, step } = useLocalSearchParams();
  return <QuoteEditorScreen key={String(id)} quoteId={String(id)} initialStep={step === "preview" ? "preview" : "edit"} />;
}
