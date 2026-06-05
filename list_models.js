const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");

const envContent = fs.readFileSync(".env.local", "utf-8");
const keysMatch = envContent.match(/GEMINI_API_KEYS="?([^"\n]+)"?/);
const key = keysMatch ? keysMatch[1].split(",")[0].trim() : "";

async function listModels() {
  const client = new GoogleGenAI({ apiKey: key });
  try {
    const response = await client.models.listModels();
    for (const model of response.models) {
      if (model.name.includes("gemma")) {
        console.log(model.name);
      }
    }
    console.log("Finished listing gemma models.");
  } catch (e) {
    console.error(e.message);
  }
}

listModels();
