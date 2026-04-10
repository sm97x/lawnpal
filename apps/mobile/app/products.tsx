import {
  generateProductRecommendations,
  generateProductRecommendationsForCase,
  productCatalog
} from "@lawnpal/core";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/appChrome";
import { SectionEyebrow, SurfaceBlock } from "@/components/stitch";
import { Button } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { fonts, palette, spacing } from "@/theme";

export default function ProductsScreen() {
  const params = useLocalSearchParams<{ caseId?: string }>();
  const hasCaseContext = typeof params.caseId === "string" && params.caseId.length > 0;
  const [items, setItems] = useState<
    { productId: string; title: string; why: string; affiliateUrl: string; ctaLabel: string }[]
  >([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        const [lawn, summary] = await Promise.all([
          localRepository.getPrimaryLawn(),
          localRepository.getLatestRecommendationSet()
        ]);

        const targetCaseId =
          typeof params.caseId === "string"
            ? params.caseId
            : await localRepository.getSetting<string | null>("activeDiagnosticCaseId", null);

        const caseState = targetCaseId
          ? await localRepository.getLatestDiagnosticSnapshot(targetCaseId)
          : null;

        if (!active || !lawn) {
          setItems([]);
          return;
        }

        const caseSupportsProducts =
          Boolean(caseState) &&
          caseState!.confidence.resolved &&
          caseState!.confidence.label === "high" &&
          caseState!.productSuggestionCategories.length > 0;

        const nextItems =
          caseSupportsProducts && caseState
            ? generateProductRecommendationsForCase({ caseState, profile: lawn.profile })
            : hasCaseContext
              ? []
              : summary
                ? generateProductRecommendations({ recommendationSet: summary, profile: lawn.profile })
                : [];

        setItems(nextItems);
      };

      void load();
      return () => {
        active = false;
      };
    }, [hasCaseContext, params.caseId])
  );

  const descriptions = useMemo(
    () => Object.fromEntries(productCatalog.map((product) => [product.id, product.description] as const)),
    []
  );

  const openProduct = async (productId: string, url: string) => {
    await localRepository.saveProductTap(productId);
    await Linking.openURL(url);
  };

  return (
    <AppScreen navKey={hasCaseContext ? "ask" : "lawn"}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <Text style={styles.subtitle}>Recommendations only surface once LawnPal has enough confidence in the case.</Text>
      </View>

      {items.length ? (
        items.map((item) => (
          <SurfaceBlock key={item.productId} tone="raised">
            <SectionEyebrow>Category Fit</SectionEyebrow>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.description}>{descriptions[item.productId]}</Text>
            <Text style={styles.subtitle}>{item.why}</Text>
            <Button label={item.ctaLabel} onPress={() => void openProduct(item.productId, item.affiliateUrl)} />
          </SurfaceBlock>
        ))
      ) : (
        <SurfaceBlock tone="raised">
          <Text style={styles.cardTitle}>No product suggestions yet</Text>
          <Text style={styles.subtitle}>
            {hasCaseContext
              ? "This case is still being narrowed down, so LawnPal is holding product suggestions until the diagnosis is settled."
              : "LawnPal is holding product recommendations until the diagnosis or scan is more settled."}
          </Text>
        </SurfaceBlock>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs
  },
  title: {
    color: palette.primary,
    fontFamily: fonts.headlineHeavy,
    fontSize: 38,
    letterSpacing: -1
  },
  subtitle: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  cardTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 24
  },
  description: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyMedium,
    fontSize: 14
  }
});
