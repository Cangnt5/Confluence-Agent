require('dotenv').config();

module.exports = {
  confluenceBaseUrl: process.env.CONFLUENCE_BASE_URL,
  confluenceApiToken: process.env.CONFLUENCE_API_TOKEN,
  confluenceUsername: process.env.CONFLUENCE_USERNAME,
  port: process.env.PORT || 3000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN
};
