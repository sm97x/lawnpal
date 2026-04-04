import {
  generateProductRecommendations,
  generateProductRecommendationsForCase,
  productCatalog
} from "@lawnpal/core";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Body, Button, Card, Heading, Screen, Subheading } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { palette } from "@/theme";

export default function ProductsScreen() {
  const params = useLocalSearchParams<{ caseId?: string }>();
  const [items, setItems] = useState<
    {
      productId: string;
      title: string;
      why: string;
      affiliateUrl: string;
      ctaLabel: string;
    }[]
  >([]);
  const [title, setTitle] = useState("No product suggestions yet");
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});

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
          setTitle("No product suggestions yet");
          return;
        }

        let nextItems =
          caseState && caseState.productSuggestionCategories.length
            ? generateProductRecommendationsForCase({
                caseState,
                profile: lawn.profile
              })
            : [];

        if (!nextItems.length && summary) {
          nextItems = generateProductRecommendations({
            recommendationSet: summary,
            profile: lawn.profile
          });
        }

        setItems(nextItems);
        setTitle(
          caseState?.productSuggestionCategories.length
            ? "Suggestions based on the active diagnosis case"
            : nextItems.length
              ? "Suggestions based on your latest scan"
              : "No product suggestions yet"
        );
        setDescriptions(
          Object.fromEntries(productCatalog.map((product) => [product.id, product.description] as const))
        );
      };

      void load();
      return () => {
        active = false;
      };
    }, [params.caseId])
  );

  const subtitle = useMemo(
    () =>
      items.length
        ? "Categories are only surfaced once Lawn Pal has enough confidence in the diagnosis."
        : "Run a scan or build confidence in a diagnosis case before Lawn Pal suggests products.",
    [items.length]
  );

  const openProduct = async (productId: string, url: string) => {
    await localRepository.saveProductTap(productId);
    await Linking.openURL(url);
  };

  return (
    <Screen>
      <Card>
        <Heading>Product recommendations</Heading>
        <Body muted>{subtitle}</Body>
      </Card>

      <Card>
        <Subheading>{title}</Subheading>
        {items.length ? (
          items.map((item) => (
            <Card key={item.productId}>
              <Subheading>{item.title}</Subheading>
              <Text style={styles.description}>{descriptions[item.productId]}</Text>
              <Body>{item.why}</Body>
              <Button
                label={item.ctaLabel}
                tone="secondary"
                onPress={() => void openProduct(item.productId, item.affiliateUrl)}
              />
            </Card>
          ))
        ) : (
          <Body muted>
            Lawn Pal is holding product suggestions until the current diagnosis is more settled.
          </Body>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  description: {
    color: palette.inkSoft
  }
});
