import { createRouter, publicQuery } from "./middleware";
import { smtpRouter } from "./routers/smtp";
import { broadcastRouter } from "./routers/broadcast";
import { emailRouter } from "./routers/email";
import { checkerRouter } from "./routers/checker";
import { botRouter } from "./routers/bot";
import { webhookRouter } from "./routers/webhook";
import { env } from "./lib/env";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  smtp: smtpRouter,
  broadcast: broadcastRouter,
  email: emailRouter,
  checker: checkerRouter,
  bot: botRouter,
  webhook: webhookRouter,

  // Config endpoint for frontend
  config: publicQuery.query(() => ({
    botLink: env.botLink,
    socialX: env.socialX,
    socialGh: env.socialGh,
    socialTg: env.socialTg,
    logoUrl: env.logoUrl,
    appUrl: env.appUrl,
  })),
});

export type AppRouter = typeof appRouter;
