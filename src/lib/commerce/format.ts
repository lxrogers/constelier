export function formatUSD(cents: number) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0,
  });
}
