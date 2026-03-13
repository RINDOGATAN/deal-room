/**
 * Creates Stripe products and prices for Dealroom.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_... npx tsx scripts/stripe-setup.ts
 *
 * Outputs the price IDs to add to your environment variables.
 */
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("Set STRIPE_SECRET_KEY before running this script.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, { typescript: true });

const products = [
  {
    envVar: "STRIPE_PRICE_ID",
    name: "Contract Skill",
    description: "Premium contract template (e.g. Founders Agreement, SAFE, Pacto de Socios)",
  },
  {
    envVar: "STRIPE_PRICE_VETTED",
    name: "Vetted Contracts",
    description: "Share attorney-vetted contract recommendations with up to 100 clients/month",
  },
];

async function main() {
  console.log("Creating Stripe products and prices...\n");

  for (const p of products) {
    const product = await stripe.products.create({
      name: `TODO.LAW — ${p.name}`,
      description: p.description,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 900,
      currency: "eur",
      recurring: { interval: "month" },
    });

    console.log(`${p.envVar}=${price.id}`);
    console.log(`  Product: ${product.id} (${p.name})`);
    console.log(`  Price:   ${price.id} (€9/month)\n`);
  }

  console.log("Add the above values to your Vercel environment variables.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
