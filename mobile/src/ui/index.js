import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Lock, Search, X } from "lucide-react-native";
import { fileUrl } from "@/api/client";
import { useI18n } from "@/i18n";
import { alpha, BRAND, RADIUS, TAP, useTheme } from "@/theme";

const AR_FONT = { 400: "Tajawal_400Regular", 500: "Tajawal_500Medium", 700: "Tajawal_700Bold", 800: "Tajawal_800ExtraBold" };
const SIZES = { h1: 28, h2: 22, h3: 18, body: 15, small: 13, tiny: 11, label: 14 };

// ---------- Text ----------
// `auto`: user-generated text (messages, bios, reviews) follows its own language direction, not the UI's.
export function Txt({ variant = "body", weight, color, muted, center, style, children, numberOfLines, auto, ...rest }) {
  const { c } = useTheme();
  const { lang } = useI18n();
  const w = weight || (variant.startsWith("h") ? 800 : variant === "label" ? 700 : 400);
  const fontFamily = lang === "ar" ? AR_FONT[w >= 800 ? 800 : w >= 700 ? 700 : w >= 500 ? 500 : 400] : undefined;
  return (
    <Text numberOfLines={numberOfLines} {...(auto && Platform.OS === "web" ? { dir: "auto" } : null)} {...rest}
      style={[{ color: color || (muted ? c.muted : c.text), fontSize: SIZES[variant], fontWeight: lang === "ar" ? undefined : String(w),
        fontFamily, textAlign: center ? "center" : auto ? "auto" : undefined, writingDirection: auto ? "auto" : lang === "ar" ? "rtl" : "ltr",
        lineHeight: Math.round(SIZES[variant] * (lang === "ar" ? 1.55 : 1.35)) }, style]}>
      {children}
    </Text>
  );
}

// ---------- Layout ----------
export function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, edges = ["top"], footer, contentStyle, keyboard }) {
  const { c } = useTheme();
  const body = scroll ? (
    <ScrollView contentContainerStyle={[padded && { padding: 16, paddingBottom: 32 }, contentStyle]} keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={BRAND.electric} /> : undefined}>
      {children}
    </ScrollView>
  ) : <View style={[{ flex: 1 }, padded && { padding: 16 }, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient colors={[alpha(BRAND.electric, 0.10), "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" end={{ x: 0.6, y: 0.35 }} />
      {keyboard ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>{body}{footer}</KeyboardAvoidingView> : <>{body}{footer}</>}
    </SafeAreaView>
  );
}

export function TopBar({ title, back = true, right, onBack }) {
  const { c } = useTheme();
  const { rtl, t } = useI18n();
  const Arrow = rtl ? ArrowRight : ArrowLeft;
  return (
    <View style={[styles.row, { minHeight: 56, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
      {back ? (
        <IconBtn onPress={onBack || (() => (router.canGoBack() ? router.back() : router.replace("/")))} label={t("common.back")}><Arrow size={22} color={c.text} /></IconBtn>
      ) : <View style={{ width: 8 }} />}
      <Txt variant="h3" numberOfLines={1} style={{ flex: 1, marginHorizontal: 4 }}>{title}</Txt>
      {right}
    </View>
  );
}

export function Row({ children, gap = 8, style, wrap }) {
  return <View style={[styles.row, { gap, flexWrap: wrap ? "wrap" : "nowrap" }, style]}>{children}</View>;
}

export function Card({ children, style, onPress, testID, glow }) {
  const { c } = useTheme();
  const base = [{ backgroundColor: c.card, borderRadius: RADIUS, borderWidth: 1, borderColor: glow ? alpha(BRAND.pink, 0.55) : c.border, padding: 14 }, style];
  if (!onPress) return <View style={base} testID={testID}>{children}</View>;
  return <Pressable onPress={onPress} testID={testID} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]} accessibilityRole="button">{children}</Pressable>;
}

export function Section({ title, right, children, style }) {
  return (
    <View style={[{ marginTop: 20 }, style]}>
      {(title || right) && <Row style={{ justifyContent: "space-between", marginBottom: 10 }}><Txt variant="h3">{title}</Txt>{right}</Row>}
      {children}
    </View>
  );
}

// ---------- Buttons ----------
export function Btn({ title, onPress, variant = "primary", icon: Icon, loading, disabled, style, small, testID }) {
  const { c } = useTheme();
  const h = small ? 44 : TAP;
  const fg = variant === "gradient" ? BRAND.night : variant === "primary" ? c.onPrimary : variant === "danger" ? c.onDanger : c.text;
  const content = (
    <View style={[styles.row, { justifyContent: "center", gap: 8, minHeight: h, paddingHorizontal: small ? 14 : 20 }]}>
      {loading ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} /> : null}
      {title ? <Txt variant={small ? "small" : "body"} weight={700} color={fg} numberOfLines={1}>{title}</Txt> : null}
    </View>
  );
  const shell = { borderRadius: 999, overflow: "hidden", opacity: disabled ? 0.5 : 1 };
  const bg = variant === "primary" ? { backgroundColor: c.primary } : variant === "danger" ? { backgroundColor: c.danger }
    : variant === "outline" ? { borderWidth: 1, borderColor: c.border } : {};
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} testID={testID} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [shell, bg, pressed && { transform: [{ scale: 0.98 }] }, style]}>
      {variant === "gradient" ? <LinearGradient colors={BRAND.gradient} locations={BRAND.gradientStops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>{content}</LinearGradient> : content}
    </Pressable>
  );
}

export function IconBtn({ children, onPress, label, badge, style, testID }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID} hitSlop={6}
      style={({ pressed }) => [{ width: TAP, height: TAP, borderRadius: 999, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.6 }, style]}>
      {children}
      {badge ? <View style={styles.badge}><Txt variant="tiny" weight={800} color={BRAND.night}>{badge > 9 ? "9+" : badge}</Txt></View> : null}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, color = BRAND.electric, icon: Icon, testID }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: Boolean(selected) }} testID={testID}
      style={[styles.row, { gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1,
        borderColor: selected ? color : c.border, backgroundColor: selected ? alpha(color, 0.15) : "transparent" }]}>
      {Icon && <Icon size={14} color={selected ? color : c.muted} />}
      <Txt variant="small" weight={700} color={selected ? c.text : c.muted}>{label}</Txt>
    </Pressable>
  );
}

export function Pill({ label, color = BRAND.electric }) {
  return (
    <View style={{ borderWidth: 1, borderColor: alpha(color, 0.55), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Txt variant="tiny" weight={700} color={color}>{label}</Txt>
    </View>
  );
}

// ---------- Inputs ----------
export function Field({ label, hint, error, children, style }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Txt variant="label" style={{ marginBottom: 6 }}>{label}</Txt> : null}
      {children}
      {error ? <Txt variant="small" color="#F87171" style={{ marginTop: 4 }}>{error}</Txt> : hint ? <Txt variant="tiny" muted style={{ marginTop: 4 }}>{hint}</Txt> : null}
    </View>
  );
}

export function Input({ multiline, style, ltr, ...rest }) {
  const { c } = useTheme();
  const { rtl } = useI18n();
  return (
    <TextInput placeholderTextColor={c.muted} multiline={multiline}
      style={[{ minHeight: multiline ? 110 : TAP, borderWidth: 1, borderColor: c.input, borderRadius: 12, paddingHorizontal: 14,
        paddingVertical: multiline ? 12 : 0, color: c.text, fontSize: 16, backgroundColor: alpha(c.bg, 0.6), textAlignVertical: multiline ? "top" : "center",
        textAlign: ltr ? "left" : rtl ? "right" : "left", writingDirection: ltr ? "ltr" : rtl ? "rtl" : "ltr" }, style]} {...rest} />
  );
}

/** Searchable list picker in a bottom sheet (wilayas, categories, subjects…). */
export function SelectField({ label, value, options, onChange, placeholder, testID, allowClear = true }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => String(o.value) === String(value));
  return (
    <>
      <Pressable onPress={() => setOpen(true)} testID={testID} accessibilityRole="button" accessibilityLabel={label}
        style={[styles.row, { minHeight: TAP, borderWidth: 1, borderColor: c.input, borderRadius: 12, paddingHorizontal: 14, gap: 8 }]}>
        <Txt numberOfLines={1} muted={!current} style={{ flex: 1 }}>{current?.label || placeholder || t("mobile.select")}</Txt>
        <ChevronDown size={18} color={c.muted} />
      </Pressable>
      <PickerSheet visible={open} title={label} options={allowClear ? [{ value: "", label: placeholder || "—" }, ...options] : options}
        value={value} onClose={() => setOpen(false)} onSelect={(v) => { onChange(v); setOpen(false); }} />
    </>
  );
}

export function PickerSheet({ visible, title, options, value, onSelect, onClose }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
  }, [q, options]);
  return (
    <Sheet visible={visible} onClose={onClose} title={title} full>
      {options.length > 8 && (
        <View style={[styles.row, { borderWidth: 1, borderColor: c.input, borderRadius: 999, paddingHorizontal: 12, marginBottom: 8 }]}>
          <Search size={16} color={c.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder={t("mobile.searchIn")} placeholderTextColor={c.muted} style={{ flex: 1, minHeight: 44, color: c.text, marginHorizontal: 8 }} />
        </View>
      )}
      <FlatList data={list} keyExtractor={(o) => String(o.value)} keyboardShouldPersistTaps="handled" initialNumToRender={20}
        renderItem={({ item }) => (
          <Pressable onPress={() => onSelect(item.value)} style={[styles.row, { minHeight: TAP, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
            <Txt style={{ flex: 1 }}>{item.label}</Txt>
            {String(item.value) === String(value) && <Check size={18} color={BRAND.electric} />}
          </Pressable>
        )} />
    </Sheet>
  );
}

// ---------- Overlays ----------
export function Sheet({ visible, onClose, title, children, full }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} accessibilityLabel={t("common.close")} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ backgroundColor: c.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: full ? "88%" : "92%", paddingBottom: insets.bottom + 12 }}>
        <View style={[styles.row, { padding: 12, paddingStart: 18 }]}>
          <Txt variant="h3" style={{ flex: 1 }} numberOfLines={1}>{title}</Txt>
          <IconBtn onPress={onClose} label={t("common.close")}><X size={22} color={c.text} /></IconBtn>
        </View>
        <View style={{ paddingHorizontal: 18, flexShrink: 1 }}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Native confirm (Alert) with a web fallback. */
export function confirm(title, message, okLabel = "OK", cancelLabel = "Annuler") {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message || ""}`) ?? false);
  return new Promise((resolve) => Alert.alert(title, message, [{ text: cancelLabel, style: "cancel", onPress: () => resolve(false) }, { text: okLabel, onPress: () => resolve(true) }]));
}

// ---------- Toast ----------
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((text, kind = "ok") => {
    setMsg({ text, kind });
    clearTimeout(timer.current);
    Animated.timing(op, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== "web" }).start();
    timer.current = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== "web" }).start(() => setMsg(null)), 2800);
  }, [op]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <Animated.View pointerEvents="none" accessibilityLiveRegion="polite"
          style={{ position: "absolute", top: insets.top + 10, left: 16, right: 16, opacity: op, alignItems: "center" }}>
          <View style={{ backgroundColor: msg.kind === "error" ? "#7F1D1D" : "#0F1525", borderColor: msg.kind === "error" ? "#F87171" : BRAND.electric,
            borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, maxWidth: 480 }}>
            <Text style={{ color: "#F8FAFC", fontSize: 14, textAlign: "center" }}>{msg.text}</Text>
          </View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- Media ----------
export function Avatar({ photoKey, thumbKey, name, size = 56, color = BRAND.electric, blurred, large, ring }) {
  const { c } = useTheme();
  const initials = (name || "?").split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const src = fileUrl(large ? photoKey || thumbKey : thumbKey || photoKey);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, overflow: "hidden", alignItems: "center", justifyContent: "center",
      borderWidth: ring ? 3 : 1, borderColor: ring ? c.card : alpha(color, 0.5), backgroundColor: alpha(color, 0.14) }}>
      {src && !blurred ? <Image source={{ uri: src }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
        : blurred ? <Lock size={size * 0.36} color={color} /> : <Txt weight={800} color={color} style={{ fontSize: size * 0.34 }}>{initials}</Txt>}
    </View>
  );
}

export function Cover({ coverKey, thumbKey, blurred, color = BRAND.electric, height = 84, large }) {
  const { c } = useTheme();
  const src = !blurred && fileUrl(large ? coverKey || thumbKey : thumbKey || coverKey);
  return (
    <View style={{ height, overflow: "hidden" }}>
      <LinearGradient colors={[alpha(color, 0.55), alpha(BRAND.violet, 0.35), c.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      <LinearGradient colors={["transparent", alpha(c.card, 0.8)]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

// ---------- States ----------
export function Loading({ style }) {
  return <View style={[{ padding: 32, alignItems: "center" }, style]}><ActivityIndicator color={BRAND.electric} size="large" /></View>;
}

export function Empty({ icon: Icon, text, action }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: 32, gap: 12 }}>
      {Icon && <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.cardAlt, alignItems: "center", justifyContent: "center" }}><Icon size={30} color={c.muted} /></View>}
      <Txt muted center>{text}</Txt>
      {action}
    </View>
  );
}

export function GradientText({ children, style }) {
  return <Txt variant="h1" color={BRAND.electric} style={style}>{children}</Txt>;
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  badge: { position: "absolute", top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: BRAND.pink, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
});
