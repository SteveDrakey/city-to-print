import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRODUCT_PRICE = 4000; // £40.00 in pence
const SHIPPING_UK = 500; // £5.00
const SHIPPING_INTL = 1500; // £15.00

const UK_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
  ["GB"];

const INTL_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
  [
    "US",
    "CA",
    "AU",
    "NZ",
    "DE",
    "FR",
    "ES",
    "IT",
    "NL",
    "BE",
    "AT",
    "CH",
    "SE",
    "NO",
    "DK",
    "FI",
    "IE",
    "PT",
    "JP",
    "SG",
    "HK",
  ];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { bounds, locationName, shippingRegion } = req.body as {
      bounds: [number, number, number, number] | null;
      locationName: string;
      shippingRegion: "uk" | "international";
    };

    if (!bounds || !shippingRegion) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const isUk = shippingRegion === "uk";
    const shippingAmount = isUk ? SHIPPING_UK : SHIPPING_INTL;
    const shippingLabel = isUk ? "UK Delivery" : "International Delivery";
    const allowedCountries = isUk ? UK_COUNTRIES : INTL_COUNTRIES;

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `3D City Model — ${locationName || "Custom Location"}`,
              description: "3D printed PLA · 20 cm × 20 cm",
            },
            unit_amount: PRODUCT_PRICE,
          },
          quantity: 1,
        },
      ],
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: shippingAmount, currency: "gbp" },
            display_name: shippingLabel,
          },
        },
      ],
      shipping_address_collection: {
        allowed_countries: allowedCountries,
      },
      metadata: {
        bounds: JSON.stringify(bounds),
        locationName: locationName || "",
        shippingRegion,
      },
      success_url: `${origin}?success=1`,
      cancel_url: origin,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : "Internal server error";
    const status =
      err instanceof Stripe.errors.StripeError ? err.statusCode || 500 : 500;
    return res.status(status).json({ error: message });
  }
}
