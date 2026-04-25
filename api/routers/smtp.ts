import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { smtpConfigs } from "@db/schema";
import { desc } from "drizzle-orm";
import { testSMTPConnection } from "../services/email";

export const smtpRouter = createRouter({
  getConfig: publicQuery.query(async () => {
    const db = getDb();
    const configs = await db.select().from(smtpConfigs).orderBy(desc(smtpConfigs.isDefault), desc(smtpConfigs.createdAt));
    if (configs.length === 0) return null;
    return configs[0];
  }),

  saveConfig: publicQuery
    .input(
      z.object({
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        username: z.string().min(1),
        password: z.string().min(1),
        secure: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Clear existing default
      await db.update(smtpConfigs).set({ isDefault: false });

      await db.insert(smtpConfigs).values({
        host: input.host,
        port: input.port,
        username: input.username,
        password: input.password,
        secure: input.secure,
        isDefault: true,
      });

      return { success: true };
    }),

  testConnection: publicQuery.query(async () => {
    const db = getDb();
    const configs = await db.select().from(smtpConfigs).orderBy(desc(smtpConfigs.isDefault));
    if (configs.length === 0) return { connected: false };

    const config = configs[0];
    const connected = await testSMTPConnection({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      secure: config.secure,
    });

    return { connected };
  }),

  deleteConfig: publicQuery.mutation(async () => {
    const db = getDb();
    await db.delete(smtpConfigs);
    return { success: true };
  }),
});
