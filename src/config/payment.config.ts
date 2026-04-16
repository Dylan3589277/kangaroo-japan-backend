import { registerAs } from "@nestjs/config";

export const paymentConfig = registerAs("payment", () => ({
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    publicKey: process.env.STRIPE_PUBLIC_KEY || "",
  },
  pingxx: {
    apiKey: process.env.PINGXX_API_KEY || "",
    appId: process.env.PINGXX_APP_ID || "",
    webhookKey: process.env.PINGXX_WEBHOOK_KEY || "",
  },
}));
