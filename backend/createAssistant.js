import OpenAI from "openai";

require('dotenv').config(); // Load your .env
const OpenAI = require('openai');

// Create OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function createAssistant() {
  try {
    const assistant = await openai.beta.assistants.create({
      name: "Car Lease Advisor",
      instructions: `You are a car leasing consultant. Use the web search tool to find current lease offers from authorized dealership websites (not brokers) in the NYC area. Avoid VIP Auto, LeaseHackr, or eAutoLease. Only return lease offers with expiration dates and real MSRPs.`,
      model: "gpt-4o",
      tools: [{ type: "web_search" }]
    });

    console.log("✅ Assistant created successfully!");
    console.log("Assistant ID:", assistant.id);
  } catch (err) {
    console.error("❌ Error creating assistant:", err.message);
  }
}

createAssistant();