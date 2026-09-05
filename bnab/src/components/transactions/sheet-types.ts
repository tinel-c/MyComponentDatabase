export type SheetCategoryGroup = {
  id: string;
  name: string;
  isIncome: boolean;
  categories: { id: string; name: string }[];
};

export type SheetChildRow = {
  id: string;
  categoryName: string;
  amountDisplay: string;
  isInflow: boolean;
};
