import { productCatalog } from "../catalog/products";
import type {
  DiagnosticCaseState,
  LawnProfile,
  ProductCategory,
  ProductRecommendation,
  RecommendationSet
} from "../types";

export const generateProductRecommendations = (input: {
  recommendationSet: RecommendationSet;
  profile: LawnProfile;
}): ProductRecommendation[] => {
  const matched = new Map<string, ProductRecommendation>();

  for (const recommendation of input.recommendationSet.recommendations) {
    for (const product of productCatalog) {
      const actionMatch = product.actionTypes.includes(recommendation.actionType);
      const grassMatch =
        product.suitedGrassStyles.includes(input.profile.grassStyle) ||
        product.suitedGrassStyles.includes("unknown");

      if (!actionMatch || !grassMatch) {
        continue;
      }

      if (!matched.has(product.id)) {
        matched.set(product.id, {
          productId: product.id,
          title: product.name,
          why: recommendation.explanation || product.reasonHint,
          affiliateUrl: product.affiliateUrl,
          ctaLabel: product.ctaLabel
        });
      }
    }
  }

  return Array.from(matched.values()).slice(0, 4);
};

export const generateProductRecommendationsForCategories = (input: {
  categories: ProductCategory[];
  profile: LawnProfile;
  why: string;
}): ProductRecommendation[] => {
  const allowed = new Set(input.categories);

  return productCatalog
    .filter((product) => allowed.has(product.category))
    .filter(
      (product) =>
        product.suitedGrassStyles.includes(input.profile.grassStyle) ||
        product.suitedGrassStyles.includes("unknown")
    )
    .slice(0, 4)
    .map((product) => ({
      productId: product.id,
      title: product.name,
      why: input.why || product.reasonHint,
      affiliateUrl: product.affiliateUrl,
      ctaLabel: product.ctaLabel
    }));
};

export const generateProductRecommendationsForCase = (input: {
  caseState: DiagnosticCaseState;
  profile: LawnProfile;
}): ProductRecommendation[] => {
  const top = input.caseState.topHypotheses[0];
  const why =
    top?.evidenceFor[0] ??
    input.caseState.currentActionPlan.doNow[0] ??
    "Matched to the current diagnostic case.";

  return generateProductRecommendationsForCategories({
    categories: input.caseState.productSuggestionCategories,
    profile: input.profile,
    why
  });
};
