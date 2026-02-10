import Stripe from "stripe";
import { Resend } from "resend";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Stripe API key is not configured" });
  }

  const sessionId = req.query.session_id as string;
  if (!sessionId) {
    return res.status(400).json({ error: "Missing session_id" });
  }

  const stripe = new Stripe(apiKey);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(200).json({ verified: false });
    }

    // ── Send order notification email (once) ──
    await sendOrderEmail(stripe, session);

    return res.status(200).json({
      verified: true,
      customerEmail: session.customer_details?.email || null,
    });
  } catch (err) {
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : "Failed to verify session";
    return res.status(400).json({ error: message });
  }
}

async function sendOrderEmail(stripe: Stripe, session: Stripe.Checkout.Session) {
  const resendKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.ORDER_NOTIFY_EMAIL;
  if (!resendKey || !notifyEmail) return;

  // ── Dedup: check if we already sent for this session ──
  const piId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (piId) {
    const pi = await stripe.paymentIntents.retrieve(piId);
    if (pi.metadata?.email_sent === "true") return;
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

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "City to Print <orders@notifications.drakey.co.uk>",
      to: notifyEmail,
      subject: `New order: ${locationName} (${amountPaid})`,
      html,
    });

    // Mark as sent so page refreshes don't re-send
    if (piId) {
      await stripe.paymentIntents.update(piId, {
        metadata: { email_sent: "true" },
      });
    }
  } catch (err) {
    console.error("Failed to send order email:", err);
  }
}
