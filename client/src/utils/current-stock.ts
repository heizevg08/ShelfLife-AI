const currentStockFormatter = new Intl.NumberFormat('en-PH', {
  maximumFractionDigits: 2,
});

export const formatCurrentStock = (quantity: number): string =>
  currentStockFormatter.format(quantity);
