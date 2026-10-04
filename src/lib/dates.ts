const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats "2023-11" as "Nov 2023" and "2026" as "2026". */
export function formatYearMonth(value: string): string {
  const [year, month] = value.split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year!;
}

export function formatPeriod(start: string, end: string): string {
  return `${formatYearMonth(start)} – ${formatYearMonth(end)}`;
}
