import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname } from "expo-router";
import type { Href } from "expo-router";
import type { PropsWithChildren } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { defaultProfile } from "@/lib/stitchContent";
import { fonts, layout, palette, radius, shadows, spacing } from "@/theme";

export type NavKey = "lawn" | "history" | "scan" | "ask" | "settings";

const navItems: {
  key: NavKey;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  href: Href;
}[] = [
  { key: "lawn", label: "Lawn", icon: "home", href: "/" },
  { key: "history", label: "Schedule", icon: "calendar-month", href: "/history" },
  { key: "scan", label: "Scan", icon: "document-scanner", href: "/scan" },
  { key: "ask", label: "Ask", icon: "psychology-alt", href: "/ask" },
  { key: "settings", label: "Settings", icon: "settings", href: "/settings" }
];

const deriveNavKey = (pathname: string): NavKey => {
  if (pathname.startsWith("/history") || pathname.startsWith("/schedule") || pathname.startsWith("/trends")) {
    return "history";
  }

  if (
    pathname.startsWith("/scan") ||
    pathname.startsWith("/result") ||
    pathname.startsWith("/log-action")
  ) {
    return "scan";
  }

  if (pathname.startsWith("/ask") || pathname.startsWith("/products")) {
    return "ask";
  }

  if (pathname.startsWith("/settings")) {
    return "settings";
  }

  return "lawn";
};

export const AppTopBar = () => (
  <View style={styles.topBarWrap}>
    <View style={styles.topBarInner}>
      <View style={styles.brandWrap}>
        <MaterialIcons color={palette.primary} name="location-on" size={20} />
        <Text style={styles.brandText}>LawnPal</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{defaultProfile.initials}</Text>
      </View>
    </View>
  </View>
);

export const BottomNav = ({ activeKey }: { activeKey: NavKey }) => (
  <View pointerEvents="box-none" style={styles.navOuter}>
    <View style={styles.navShell}>
      {navItems.map((item) => {
        const active = item.key === activeKey;
        const centerItem = item.key === "scan";
        const content = (
          <>
            {centerItem ? (
              <View style={styles.centerIconWrap}>
                <MaterialIcons
                  color={active ? palette.white : palette.inkSoft}
                  name={item.icon}
                  size={20}
                />
              </View>
            ) : (
              <MaterialIcons
                color={active ? palette.white : palette.inkSoft}
                name={item.icon}
                size={20}
              />
            )}
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
          </>
        );

        return (
          <Pressable
            key={item.key}
            onPress={() => router.replace(item.href)}
            style={({ pressed }) => [
              styles.navItem,
              centerItem && styles.navItemCenter,
              pressed && styles.navItemPressed
            ]}
          >
            {active ? (
              <LinearGradient
                colors={[palette.primary, palette.primaryContainer]}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={[styles.navItemActive, centerItem && styles.navItemCenterActive]}
              >
                {content}
              </LinearGradient>
            ) : (
              <View style={[styles.navItemIdle, centerItem && styles.navItemCenterIdle]}>
                {content}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  </View>
);

export const AppScreen = ({
  children,
  scroll = true,
  showNav = true,
  showTopBar = true,
  navKey,
  contentContainerStyle
}: PropsWithChildren<{
  scroll?: boolean;
  showNav?: boolean;
  showTopBar?: boolean;
  navKey?: NavKey;
  contentContainerStyle?: object;
}>) => {
  const pathname = usePathname();
  const activeKey = navKey ?? deriveNavKey(pathname);
  const bottomInset = showNav ? layout.bottomNavHeight + spacing.xl : spacing.xxl;

  return (
    <SafeAreaView style={styles.safeArea}>
      {showTopBar ? <AppTopBar /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomInset },
            contentContainerStyle
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fillContent, { paddingBottom: bottomInset }, contentContainerStyle]}>
          {children}
        </View>
      )}
      {showNav ? <BottomNav activeKey={activeKey} /> : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  topBarWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm
  },
  topBarInner: {
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  brandText: {
    color: palette.primary,
    fontFamily: fonts.headlineHeavy,
    fontSize: 18,
    letterSpacing: -0.5
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceHighest,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.6
  },
  scrollContent: {
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.gutter,
    gap: spacing.lg
  },
  fillContent: {
    flex: 1,
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.gutter,
    gap: spacing.lg
  },
  navOuter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingBottom: spacing.md
  },
  navShell: {
    width: "92%",
    maxWidth: 420,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    ...shadows.botanical
  },
  navItem: {
    flex: 1,
    alignItems: "center"
  },
  navItemCenter: {
    transform: [{ translateY: -6 }]
  },
  navItemPressed: {
    opacity: 0.82
  },
  navItemActive: {
    minWidth: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8
  },
  navItemCenterActive: {
    paddingTop: 12,
    paddingBottom: 10
  },
  navItemIdle: {
    minWidth: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8
  },
  navItemCenterIdle: {
    paddingTop: 12,
    paddingBottom: 10
  },
  centerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: "rgba(228, 226, 221, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  navLabel: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  navLabelActive: {
    color: palette.white
  }
});
