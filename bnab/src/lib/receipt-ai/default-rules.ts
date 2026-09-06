/**
 * Default receipt line → category rules (Lidl RO fixtures).
 * Applied case-insensitively; first match by sortOrder wins.
 */
export type DefaultReceiptRule =
  | { matchText: string; ignore: true }
  | { matchText: string; categoryName: string; ignore?: false };

export const DEFAULT_RECEIPT_RULES: DefaultReceiptRule[] = [
  // Ignore / non-products (highest priority)
  { matchText: "reducere lidl", ignore: true },
  { matchText: "lidl plus", ignore: true },
  { matchText: "pv_", ignore: true },
  { matchText: "discount", ignore: true },
  { matchText: "tva ", ignore: true },
  { matchText: "total tva", ignore: true },

  // Clothing
  { matchText: "trening", categoryName: "Clothing" },
  { matchText: "chiloti", categoryName: "Clothing" },
  { matchText: "pantalon", categoryName: "Clothing" },
  { matchText: "bluza", categoryName: "Clothing" },
  { matchText: "rochie", categoryName: "Clothing" },
  { matchText: "sosete", categoryName: "Clothing" },

  // Pets
  { matchText: "whiskas", categoryName: "Pets" },
  { matchText: "silicat", categoryName: "Pets" },
  { matchText: "pisici", categoryName: "Pets" },
  { matchText: "hrana usc", categoryName: "Pets" },
  { matchText: "manc. umeda", categoryName: "Pets" },

  // Education / stationery
  { matchText: "caiet", categoryName: "Education" },
  { matchText: "creioane", categoryName: "Education" },
  { matchText: "instrumente scrie", categoryName: "Education" },
  { matchText: "bloc desen", categoryName: "Education" },
  { matchText: "trusa creioane", categoryName: "Education" },

  // Household
  { matchText: "detergent", categoryName: "Household Goods" },
  { matchText: "zewa", categoryName: "Household Goods" },
  { matchText: "hartie igien", categoryName: "Household Goods" },
  { matchText: "fairy", categoryName: "Household Goods" },
  { matchText: "capsule masina", categoryName: "Household Goods" },
  { matchText: "odorizant", categoryName: "Household Goods" },
  { matchText: "saci menaj", categoryName: "Household Goods" },
  { matchText: "servetele", categoryName: "Household Goods" },
  { matchText: "sacosa", categoryName: "Household Goods" },

  // Tools
  { matchText: "manusi", categoryName: "Tools" },
  { matchText: "nitril", categoryName: "Tools" },

  // Personal
  { matchText: "periuta", categoryName: "Look&Feel" },

  // Presents
  { matchText: "buchet", categoryName: "Presents" },
  { matchText: "hortensie", categoryName: "Presents" },

  // Groceries catch-alls (lower priority — listed last among product rules)
  { matchText: "sunca", categoryName: "Groceries" },
  { matchText: "bacon", categoryName: "Groceries" },
  { matchText: "piept", categoryName: "Groceries" },
  { matchText: "carnati", categoryName: "Groceries" },
  { matchText: "salam", categoryName: "Groceries" },
  { matchText: "lapte", categoryName: "Groceries" },
  { matchText: "kefir", categoryName: "Groceries" },
  { matchText: "iaurt", categoryName: "Groceries" },
  { matchText: "sana", categoryName: "Groceries" },
  { matchText: "oua", categoryName: "Groceries" },
  { matchText: "banane", categoryName: "Groceries" },
  { matchText: "morcovi", categoryName: "Groceries" },
  { matchText: "fasole", categoryName: "Groceries" },
  { matchText: "croissant", categoryName: "Groceries" },
  { matchText: "chips", categoryName: "Groceries" },
  { matchText: "sos ", categoryName: "Groceries" },
  { matchText: "orez", categoryName: "Groceries" },
  { matchText: "lasagna", categoryName: "Groceries" },
  { matchText: "bagheta", categoryName: "Groceries" },
  { matchText: "cafea", categoryName: "Groceries" },
  { matchText: "ursus", categoryName: "Groceries" },
  { matchText: "grepfrut", categoryName: "Groceries" },
  { matchText: "lamai", categoryName: "Groceries" },
  { matchText: "peste", categoryName: "Groceries" },
  { matchText: "gofre", categoryName: "Groceries" },
  { matchText: "napo", categoryName: "Groceries" },
  { matchText: "cornichons", categoryName: "Groceries" },
  { matchText: "sorici", categoryName: "Groceries" },
  { matchText: "kit gatit", categoryName: "Groceries" },
];
