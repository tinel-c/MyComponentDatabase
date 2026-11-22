/**
 * Curated CAEN (NACE) → YNAB-style category name hints for the household budget.
 * Resolved to categoryId at proposal time by matching Category.name (case-insensitive).
 * Keys are 2-digit CAEN divisions (or full 4-digit when more specific).
 */

const DIVISION_TO_CATEGORY: Record<string, string> = {
  // Agriculture / food production → groceries
  "01": "Groceries",
  "10": "Groceries",
  "11": "Groceries",
  // Retail
  "45": "Fuel", // motor vehicle trade / parts; often fuel-adjacent
  "46": "Household Goods",
  "47": "Groceries", // retail trade (overridden below for fuel/pharmacies)
  // Transport / fuel stations often 47.30
  "49": "Fuel",
  // Accommodation / food service
  "55": "Vacation",
  "56": "Office food",
  // Info / telecom
  "58": "Streaming",
  "59": "Streaming",
  "60": "Streaming",
  "61": "Phone",
  "62": "Domains",
  "63": "Internet",
  // Finance
  "64": "Impozite",
  "65": "Impozite",
  "66": "Impozite",
  // Real estate / association
  "68": "Asociatie",
  // Professional
  "69": "Impozite",
  "70": "Impozite",
  "71": "Home Maintanance",
  "72": "Medical",
  "73": "Household Goods",
  "74": "Atelier",
  "75": "Medical",
  // Admin / education / health
  "85": "Kindergarden&School",
  "86": "Medical",
  "87": "Medical",
  "88": "Medical",
  // Arts / recreation
  "90": "Games",
  "91": "Vacation",
  "92": "Games",
  "93": "Vacation",
  // Other services
  "95": "Home Maintanance",
  "96": "Household Goods",
  // Utilities
  "35": "EON",
  "36": "Asociatie",
  "37": "Asociatie",
  "38": "Asociatie",
};

/** More specific 4-digit overrides when ANAF returns full cod_CAEN. */
const CODE_TO_CATEGORY: Record<string, string> = {
  "4730": "Fuel",
  "4711": "Groceries",
  "4719": "Groceries",
  "4721": "Groceries",
  "4722": "Groceries",
  "4723": "Groceries",
  "4724": "Groceries",
  "4725": "Groceries",
  "4726": "Household Goods",
  "4729": "Groceries",
  "4741": "Household Goods",
  "4751": "Household Goods",
  "4752": "Home Maintanance",
  "4759": "Household Goods",
  "4761": "Household Goods",
  "4762": "Games",
  "4763": "Games",
  "4764": "Games",
  "4765": "Games",
  "4771": "Household Goods",
  "4772": "Household Goods",
  "4773": "Medical", // pharmacies
  "4774": "Medical",
  "4775": "Household Goods",
  "4778": "Household Goods",
  "4779": "Household Goods",
  "4781": "Groceries",
  "4791": "Household Goods",
  "5610": "Office food",
  "5621": "Office food",
  "5629": "Office food",
  "5630": "Office food",
  "6110": "Internet",
  "6120": "Phone",
  "6130": "Internet",
  "6190": "Phone",
  "8510": "Kindergarden&School",
  "8520": "Kindergarden&School",
  "8531": "Kindergarden&School",
  "8532": "Kindergarden&School",
  "8610": "Medical",
  "8621": "Medical",
  "8622": "Medical",
  "8623": "Medical",
  "8690": "Medical",
};

/**
 * Map ANAF `cod_CAEN` (string like "5610" or "56") to a budget category name hint.
 */
export function categoryNameForCaen(codCaen: string | null | undefined): string | null {
  if (!codCaen) return null;
  const digits = codCaen.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length >= 4) {
    const four = digits.slice(0, 4);
    if (CODE_TO_CATEGORY[four]) return CODE_TO_CATEGORY[four];
  }
  const div = digits.slice(0, 2);
  return DIVISION_TO_CATEGORY[div] ?? null;
}
