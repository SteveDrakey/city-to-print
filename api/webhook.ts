import Stripe from "stripe";
import { Resend } from "resend";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Vercel: disable automatic body parsing so we can verify the Stripe signature
export const config = { api: { bodyParser: false } };

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.ORDER_NOTIFY_EMAIL;

  if (!stripeKey || !webhookSecret) {
    return res.status(500).json({ error: "Stripe keys not configured" });
  }
  if (!resendKey || !notifyEmail) {
    return res.status(500).json({ error: "Email config missing" });
  }

  const stripe = new Stripe(stripeKey);
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", msg);
    return res.status(400).json({ error: `Webhook Error: ${msg}` });
  }

  if (event.type !== "checkout.session.completed") {
    // Acknowledge events we don't handle
    return res.status(200).json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== "paid") {
    return res.status(200).json({ received: true });
  }

  // ── Extract order details from metadata ──
  const meta = session.metadata || {};
  const locationName = meta.locationName || "Unknown location";
  const shippingRegion = meta.shippingRegion || "—";
  const mapUrl = meta.mapUrl || null;
  const bearing = meta.bearing || null;
  const coords = {
    north: meta.top_left_lat,
    west: meta.top_left_lng,
    south: meta.bottom_right_lat,
    east: meta.bottom_right_lng,
  };

  // ── Customer & shipping ──
  const customer = session.customer_details;
  const shipping = session.shipping_details;
  const addr = shipping?.address;
  const addressLines = [
    shipping?.name,
    addr?.line1,
    addr?.line2,
    [addr?.city, addr?.state, addr?.postal_code].filter(Boolean).join(", "),
    addr?.country,
  ]
    .filter(Boolean)
    .join("\n");

  const amountPaid = session.amount_total
    ? `£${(session.amount_total / 100).toFixed(2)}`
    : "—";

  // ── Build email ──
  const mapLink = mapUrl
    ? `<a href="${mapUrl}" style="color:#3b82f6">View model on City to Print</a>`
    : "No map URL captured";

  const coordsText =
    coords.north && coords.south
      ? `${coords.north}, ${coords.west} → ${coords.south}, ${coords.east}`
      : "—";

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
  <div style="background:#1a1a2e;color:white;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:20px;font-weight:700">New Order: ${locationName}</h1>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr>
        <td style="padding:8px 0;color:#6b7280;width:120px;vertical-align:top">Amount</td>
        <td style="padding:8px 0;font-weight:600">${amountPaid}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top">Location</td>
        <td style="padding:8px 0;font-weight:600">${locationName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top">Model link</td>
        <td style="padding:8px 0">${mapLink}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top">Coordinates</td>
        <td style="padding:8px 0;font-family:monospace;font-size:13px">${coordsText}</td>
      </tr>
      ${bearing ? `
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top">Bearing</td>
        <td style="padding:8px 0">${bearing}°</td>
      </tr>` : ""}
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top">Shipping</td>
        <td style="padding:8px 0">${shippingRegion === "uk" ? "UK" : "USA"}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top">Customer</td>
        <td style="padding:8px 0">${customer?.name || "—"}<br/><span style="color:#6b7280">${customer?.email || "—"}</span></td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top">Ship to</td>
        <td style="padding:8px 0;white-space:pre-line">${addressLines || "—"}</td>
      </tr>
    </table>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
    <p style="font-size:12px;color:#9ca3af;margin:0">
      Stripe session: ${session.id}
    </p>
  </div>
</div>`;

  // ── Send email via Resend ──
  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "City to Print <orders@notifications.drakey.co.uk>",
      to: notifyEmail,
      subject: `New order: ${locationName} (${amountPaid})`,
      html,
    });
  } catch (err) {
    // Log but don't fail the webhook — Stripe would retry
    console.error("Failed to send order email:", err);
  }

  return res.status(200).json({ received: true });
}
