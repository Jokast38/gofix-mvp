import { SafeAreaView } from "react-native-safe-area-context";
import { CatalogScreen } from "@/components/CatalogScreen";
import { useTheme } from "@/theme";

export default function SearchTab() {
  const { c } = useTheme();
  return <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}><CatalogScreen kind="professional" /></SafeAreaView>;
}
