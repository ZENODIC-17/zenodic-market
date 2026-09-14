const OpenAI = require("openai");

/**
 * Zenodic AI - OpenAI provider.
 *
 * API key haisomeki kutoka client/browser.
 * Inapaswa kuwekwa kwenye environment variable:
 * OPENAI_API_KEY
 */

let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY haijawekwa kwenye environment.");
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  return client;
}

async function generateText({ messages }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("AI messages are required.");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY haijawekwa kwenye environment.");
  }

  const response = await getClient().responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: messages
  });

  return {
    text: response.output_text || "",
    provider: "openai",
    model: process.env.OPENAI_MODEL || "gpt-5-mini"
  };
}

module.exports = {
  generateText
};
