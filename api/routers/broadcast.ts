import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { broadcastMessages } from "@db/schema";
import { desc } from "drizzle-orm";
import { sendMessage, getMainMenuKeyboard } from "../services/telegram";
import { env } from "../lib/env";

export const broadcastRouter = createRouter({
  send: publicQuery
    .input(
      z.object({
        message: z.string().min(1),
        buttonText: z.string().optional(),
        buttonLink: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Save to database
      await db.insert(broadcastMessages).values({
        message: input.message,
        buttonText: input.buttonText,
        buttonLink: input.buttonLink,
      });

      // Send via Telegram bot to allowed users
      const allowedUsers = env.allowedUserIds;
      const results = [];

      for (const userId of allowedUsers) {
        try {
          const uid = parseInt(userId);
          const keyboard = input.buttonText && input.buttonLink
            ? {
                inline_keyboard: [
                  [{ text: input.buttonText, url: input.buttonLink }],
                ],
              }
            : getMainMenuKeyboard(true);

          const result = await sendMessage(uid, input.message, keyboard);
          results.push({ userId, success: result.ok === true });
        } catch (error: any) {
          results.push({ userId, success: false, error: error.message });
        }
      }

      return { success: true, results };
    }),

  list: publicQuery.query(async () => {
    const db = getDb();
    const messages = await db.select().from(broadcastMessages).orderBy(desc(broadcastMessages.createdAt)).limit(50);
    return messages;
  }),
});
