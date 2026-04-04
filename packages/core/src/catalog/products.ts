import type { ProductCatalogItem } from "../types";

export const productCatalog: ProductCatalogItem[] = [
  {
    id: "feed-spring",
    name: "Balanced Spring & Summer Feed",
    category: "feed",
    actionTypes: ["feed"],
    suitedGrassStyles: ["hard-wearing", "ornamental", "shaded", "unknown"],
    description: "A gentle seasonal feed for active growth without over-pushing stressed turf.",
    reasonHint: "Good fit when growth is active and nutrient levels are moderate.",
    affiliateUrl: "https://example.com/affiliate/spring-feed",
    ctaLabel: "View feed"
  },
  {
    id: "moss-control-granules",
    name: "Moss Control Granules",
    category: "moss-control",
    actionTypes: ["moss"],
    suitedGrassStyles: ["hard-wearing", "ornamental", "shaded", "unknown"],
    description: "Targeted moss control for cool, damp and shaded lawns.",
    reasonHint: "Useful when moss pressure is rising in wet, shaded areas.",
    affiliateUrl: "https://example.com/affiliate/moss-control",
    ctaLabel: "View moss control"
  },
  {
    id: "shaded-seed",
    name: "Shaded Lawn Seed Mix",
    category: "seed",
    actionTypes: ["seed"],
    suitedGrassStyles: ["shaded", "unknown"],
    description: "A seed mix designed for lawns that spend much of the day out of direct sun.",
    reasonHint: "Better suited to low-light zones than a general seed blend.",
    affiliateUrl: "https://example.com/affiliate/shaded-seed",
    ctaLabel: "View seed"
  },
  {
    id: "hardwearing-seed",
    name: "Hard-wearing Seed Mix",
    category: "seed",
    actionTypes: ["seed"],
    suitedGrassStyles: ["hard-wearing", "unknown"],
    description: "A durable seed mix for family lawns and higher footfall areas.",
    reasonHint: "Best suited when durability matters more than fine finish.",
    affiliateUrl: "https://example.com/affiliate/hardwearing-seed",
    ctaLabel: "View seed"
  },
  {
    id: "aeration-fork",
    name: "Lawn Aeration Fork",
    category: "aeration",
    actionTypes: ["drainage"],
    suitedGrassStyles: ["hard-wearing", "ornamental", "shaded", "unknown"],
    description: "A practical manual aeration tool to ease compaction and improve drainage.",
    reasonHint: "Helpful when one zone repeatedly holds more water than the rest.",
    affiliateUrl: "https://example.com/affiliate/aeration-fork",
    ctaLabel: "View tool"
  },
  {
    id: "soil-lime",
    name: "Garden Lime",
    category: "soil-amendment",
    actionTypes: ["soil"],
    suitedGrassStyles: ["hard-wearing", "ornamental", "shaded", "unknown"],
    description: "A straightforward amendment for lawns trending too acidic.",
    reasonHint: "Useful when pH stays below the healthy grass range.",
    affiliateUrl: "https://example.com/affiliate/lime",
    ctaLabel: "View amendment"
  },
  {
    id: "patch-repair-kit",
    name: "Patch Repair Kit",
    category: "patch-repair",
    actionTypes: ["seed"],
    suitedGrassStyles: ["hard-wearing", "ornamental", "shaded", "unknown"],
    description: "A straightforward patch repair kit for small localised damage and thin spots.",
    reasonHint: "Useful once the underlying cause is settled and the patch is ready for repair.",
    affiliateUrl: "https://example.com/affiliate/patch-repair",
    ctaLabel: "View repair kit"
  },
  {
    id: "wetting-agent",
    name: "Wetting Agent",
    category: "wetting-agent",
    actionTypes: ["water"],
    suitedGrassStyles: ["hard-wearing", "ornamental", "shaded", "unknown"],
    description: "Helps dry, hydrophobic patches take in water more evenly.",
    reasonHint: "Useful when one patch keeps staying dry despite watering.",
    affiliateUrl: "https://example.com/affiliate/wetting-agent",
    ctaLabel: "View wetting agent"
  },
  {
    id: "top-dressing-blend",
    name: "Lawn Top Dressing Blend",
    category: "top-dressing",
    actionTypes: ["soil", "drainage", "seed"],
    suitedGrassStyles: ["hard-wearing", "ornamental", "shaded", "unknown"],
    description: "A light top dressing blend for smoothing, patch repair, and gradual soil improvement.",
    reasonHint: "Useful after compaction relief, patch repair, or when improving surface structure.",
    affiliateUrl: "https://example.com/affiliate/top-dressing",
    ctaLabel: "View top dressing"
  }
];
