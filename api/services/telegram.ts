import { env } from "../lib/env";

const TELEGRAM_API = `https://api.telegram.org/bot${env.telegramBotToken}`;
const VALID_USER_IDS = env.allowedUserIds;

export const PROGRESS_FILLED = "▰";
export const PROGRESS_EMPTY = "▱";

export function getProgressBar(current: number, total: number): string {
  const percentage = Math.floor((current / total) * 100);
  const filled = Math.floor((current / total) * 8);
  const bar = PROGRESS_FILLED.repeat(filled) + PROGRESS_EMPTY.repeat(8 - filled);
  return `${bar} ${percentage}%\n✓ ${current} | ✗ ${total - current} / ${total}`;
}

export function getLoadingAnimation(percentage: number): string {
  const filled = Math.floor((percentage / 100) * 8);
  const bar = PROGRESS_FILLED.repeat(filled) + PROGRESS_EMPTY.repeat(8 - filled);
  return `${bar} ${percentage}%`;
}

export function isValidUser(userId: number | string): boolean {
  return VALID_USER_IDS.includes(userId.toString());
}

export async function deleteMessage(chatId: number, messageId: number) {
  try {
    await fetch(`${TELEGRAM_API}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  } catch {
    // Silently fail
  }
}

export async function editMessage(chatId: number, messageId: number, text: string, keyboard?: any) {
  try {
    await fetch(`${TELEGRAM_API}/editMessageText`, {
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
    // Silently fail
  }
}

export async function sendMessage(chatId: number, text: string, keyboard?: any): Promise<any> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }),
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
}

export async function sendDocument(chatId: number, document: Uint8Array, caption: string, filename: string): Promise<any> {
  try {
    const formData = new FormData();
    const arr = new Uint8Array(document);
    const blob = new Blob([arr]);
    formData.append("chat_id", chatId.toString());
    formData.append("document", blob, filename);
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");

    const response = await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: "POST",
      body: formData,
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
}

export function getMainMenuKeyboard(isValidUser: boolean) {
  if (!isValidUser) {
    return { inline_keyboard: [] };
  }
  return {
    inline_keyboard: [
      [{ text: "@ ᴍᴀɪʟᴇʀ", callback_data: "send_emails" }],
      [{ text: "♞ ᴄʜᴇᴄᴋᴇʀ", callback_data: "checker" }],
      [{ text: "⚙ ꜱᴇᴛᴛɪɴɢꜱ", callback_data: "settings" }],
    ],
  };
}

export function getSettingsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "⏣ SMTP Config", callback_data: "smtp_config" }],
      [{ text: "ⓘ SMTP Info", callback_data: "smtp_info" }],
      [{ text: "☚ Back", callback_data: "back_to_menu" }],
    ],
  };
}

export function getBackKeyboard(callback: string = "back_to_menu") {
  return {
    inline_keyboard: [[{ text: "☚ Back", callback_data: callback }]],
  };
}

export function getRecipientsChoiceKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Single email", callback_data: "recipients_single" }],
      [{ text: "Multiple emails (one per line)", callback_data: "recipients_multiple" }],
      [{ text: "Upload .txt file", callback_data: "recipients_file" }],
      [{ text: "☚ Back", callback_data: "back_to_menu" }],
    ],
  };
}

export function getBodyChoiceKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Plain text", callback_data: "body_text" }],
      [{ text: "Paste HTML code", callback_data: "body_html" }],
      [{ text: "Upload .html file", callback_data: "body_file" }],
      [{ text: "☚ Back", callback_data: "back_email_flow" }],
    ],
  };
}

export function getConfirmSendKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "⫸ Send", callback_data: "confirm_send" }],
      [{ text: "☚ Back", callback_data: "back_to_menu" }],
    ],
  };
}

export function getSkipAttachmentsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Skip", callback_data: "skip_attachments" }],
      [{ text: "☚ Back", callback_data: "back_email_flow" }],
    ],
  };
}

export function getCheckerStartKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "⎋ Start", callback_data: "checker_start" }],
      [{ text: "☚ Back", callback_data: "back_to_menu" }],
    ],
  };
}

export function getCheckerStopKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "⊘ Stop", callback_data: "checker_stop" }],
    ],
  };
}

export async function answerCallbackQuery(callbackQueryId: string) {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch {
    // Silently fail
  }
}

export async function getBotInfo(): Promise<{ ok: boolean; username?: string; id?: number; error?: string }> {
  try {
    const response = await fetch(`${TELEGRAM_API}/getMe`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = (await response.json()) as any;
    if (data.ok) {
      return { ok: true, username: data.result?.username, id: data.result?.id };
    }
    return { ok: false, error: data.description || "Unknown error" };
  } catch (error: any) {
    return { ok: false, error: error.message || "Network error" };
  }
}

export async function getWebhookInfo(): Promise<{ ok: boolean; url?: string; pending_updates?: number; error?: string }> {
  try {
    const response = await fetch(`${TELEGRAM_API}/getWebhookInfo`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = (await response.json()) as any;
    if (data.ok) {
      return {
        ok: true,
        url: data.result?.url,
        pending_updates: data.result?.pending_update_count,
      };
    }
    return { ok: false, error: data.description || "Unknown error" };
  } catch (error: any) {
    return { ok: false, error: error.message || "Network error" };
  }
}

export async function setWebhook(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, allowed_updates: ["message", "callback_query"] }),
    });
    const data = (await response.json()) as any;
    if (data.ok) {
      return { ok: true };
    }
    return { ok: false, error: data.description || "Unknown error" };
  } catch (error: any) {
    return { ok: false, error: error.message || "Network error" };
  }
}

export async function deleteWebhook(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${TELEGRAM_API}/deleteWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = (await response.json()) as any;
    if (data.ok) {
      return { ok: true };
    }
    return { ok: false, error: data.description || "Unknown error" };
  } catch (error: any) {
    return { ok: false, error: error.message || "Network error" };
  }
}
