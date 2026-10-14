// demo-shop · captura de pagos.
// BUG (E01): si el gateway responde con timeout, se reintenta sin idempotency key → doble cobro.
import { gateway } from "./gateway";
import { db } from "../db";

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: "MXN" | "USD";
  customerId: string;
}

export async function capture(intent: PaymentIntent) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const charge = await gateway.charges.create({
        amount: intent.amount,
        currency: intent.currency,
        customer: intent.customerId,
      });
      await db.charges.insert({ intentId: intent.id, chargeId: charge.id, amount: intent.amount });
      return charge;
    } catch (err) {
      if (attempt === 3) throw err;
      // reintento "ingenuo": el cobro anterior pudo haberse creado aunque haya expirado el timeout
    }
  }
}
