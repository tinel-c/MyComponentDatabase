/** Shared spreadsheet cell styles for transaction registers. */
export const sheetCell =
  "border-r border-b border-rim-subtle bg-canvas p-0 align-middle last:border-r-0";

export const sheetCellInput =
  "box-border h-8 w-full min-w-0 max-w-full appearance-none border-0 bg-transparent px-0.5 text-[10px] leading-tight text-fg outline-none " +
  "placeholder:text-fg-subtle focus:bg-accent-muted/50 focus:ring-1 focus:ring-inset focus:ring-accent/40 " +
  "disabled:text-fg-muted sm:h-9 sm:px-1 sm:text-xs " +
  "[&::-webkit-calendar-picker-indicator]:scale-75 [&::-webkit-date-and-time-value]:text-left";

export const sheetHeaderCell =
  "border-r border-b border-rim bg-overlay px-1 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wide text-fg-muted last:border-r-0 sm:px-1.5 sm:text-[10px]";

export const sheetTableClass =
  "w-full table-fixed border-collapse";
