import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getBotInfo, getWebhookInfo, setWebhook, deleteWebhook } from "../services/telegram";

export const webhookRouter = createRouter({
  botStatus: publicQuery.query(async () => {
    const botInfo = await getBotInfo();
    return {
      connected: botInfo.ok,
      username: botInfo.username,
      botId: botInfo.id,
      error: botInfo.error,
    };
  }),

  info: publicQuery.query(async () => {
    const [botInfo, webhookInfo] = await Promise.all([
      getBotInfo(),
      getWebhookInfo(),
    ]);

    return {
      bot: {
        connected: botInfo.ok,
        username: botInfo.username,
      },
      webhook: {
        connected: webhookInfo.ok && !!webhookInfo.url,
        url: webhookInfo.url,
        pendingUpdates: webhookInfo.pending_updates ?? 0,
      },
    };
  }),

  set: publicQuery
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const result = await setWebhook(input.url);
      return { success: result.ok, error: result.error };
    }),

  delete: publicQuery.mutation(async () => {
    const result = await deleteWebhook();
    return { success: result.ok, error: result.error };
  }),
});
