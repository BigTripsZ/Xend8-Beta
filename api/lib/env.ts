import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  allowedUserIds: (process.env.ALLOWED_USER_IDS || "8630420663,8550696261,6780655879").split(",").map(id => id.trim()),
  botLink: process.env.BOT_LINK || "https://t.me/Xend8_bot",
  socialX: process.env.SOCIAL_X || "https://x.com/Xend8",
  socialGh: process.env.SOCIAL_GH || "https://github.com/Xend8",
  socialTg: process.env.SOCIAL_TG || "https://t.me/Xend8_bot",
  logoUrl: process.env.LOGO_URL || "/logo.png",
  appUrl: process.env.APP_URL || "",
};
