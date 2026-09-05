/** Shared spreadsheet cell styles — readable density, theme tokens only. */
export const sheetCell =
  "border-r border-b border-rim-subtle p-0 align-middle last:border-r-0";

export const sheetCellInput =
  "box-border h-10 w-full min-w-0 max-w-full appearance-none border-0 bg-transparent px-1.5 text-xs leading-tight text-fg outline-none " +
  "placeholder:text-fg-subtle focus:bg-accent-muted/55 focus:ring-1 focus:ring-inset focus:ring-accent/45 " +
  "disabled:text-fg-muted sm:h-11 sm:px-2 sm:text-sm " +
  "[&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:scale-90";

export const sheetHeaderCell =
  "sticky top-0 z-10 border-r border-b border-rim bg-overlay/95 px-1.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-fg-muted backdrop-blur-sm last:border-r-0 sm:px-2 sm:text-[11px]";

export const sheetTableClass =
  "w-full min-w-[36rem] border-collapse sm:min-w-0 sm:table-fixed";

export const sheetMoneyInput =
  `${sheetCellInput} text-right font-mono tabular-nums`;
