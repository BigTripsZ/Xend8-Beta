import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { emailLogs, smtpConfigs } from "@db/schema";
import { desc } from "drizzle-orm";
import { sendEmail } from "../services/email";

export const emailRouter = createRouter({
  sendTest: publicQuery
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        text: z.string().min(1),
        senderName: z.string().optional(),
        priority: z.enum(["normal", "high", "low"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const configs = await db.select().from(smtpConfigs).orderBy(desc(smtpConfigs.isDefault));

      if (configs.length === 0) {
        return { success: false, error: "No SMTP configuration found" };
      }

      const config = configs[0];
      const result = await sendEmail(
        {
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          secure: config.secure,
        },
        input.to,
        input.subject,
        `<pre style="font-family: sans-serif; white-space: pre-wrap;">${input.text}</pre>`,
        input.senderName
      );

      // Log the email
      await db.insert(emailLogs).values({
        recipient: input.to,
        subject: input.subject,
        senderName: input.senderName || "✗ᴇɴᴅ8",
        status: result.success ? "sent" : "failed",
        messageId: result.messageId,
        errorMessage: result.error,
      });

      return result;
    }),

  logs: publicQuery.query(async () => {
    const db = getDb();
    const logs = await db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(50);
    return logs;
  }),

  clearLogs: publicQuery.mutation(async () => {
    const db = getDb();
    await db.delete(emailLogs);
    return { success: true };
  }),
});
