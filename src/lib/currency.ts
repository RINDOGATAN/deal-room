/**
 * Currency helper — reads the geo-IP currency cookie set by middleware.
 * US visitors get USD, everyone else gets EUR.
 */

export type Currency = "USD" | "EUR";

export function getCurrency(): Currency {
  if (typeof document === "undefined") return "EUR";
  const match = document.cookie.match(/(?:^|;\s*)currency=(\w+)/);
  return match?.[1] === "USD" ? "USD" : "EUR";
}

export function formatPrice(amount: number, currency: Currency = getCurrency()): string {
  return currency === "USD" ? `$${amount}` : `€${amount}`;
}
