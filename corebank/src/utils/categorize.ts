const RULES: { keywords: string[]; category: string }[] = [
  { keywords: ["UBER", "LYFT", "TRANSIT"], category: "Transport" },
  { keywords: ["WALMART", "TARGET", "KROGER", "GROCERY"], category: "Groceries" },
  { keywords: ["NETFLIX", "SPOTIFY", "HULU"], category: "Subscriptions" },
];

export function categorize(description: string): string {
  const upper = description.toUpperCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => upper.includes(kw))) {
      return rule.category;
    }
  }
  return "Other";
}
