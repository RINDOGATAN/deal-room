export const features = {
  stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
  selfServiceUpgrade: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
} as const;
