const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");

const envContent = fs.readFileSync(".env.local", "utf-8");
const keysMatch = envContent.match(/GEMINI_API_KEYS="?([^"\n]+)"?/);
const keysEnv = keysMatch ? keysMatch[1] : "";
const API_KEYS = keysEnv.split(",").map(k => k.trim()).filter(k => k.length > 0);

async function testStream(key, index) {
  console.log(`\n[Key ${index}] Initiating concurrent stream with Gemma 4...`);
  
  try {
    const client = new GoogleGenAI({ apiKey: key });
    
    // Using gemma-4-31b-it
    const response = await client.models.generateContentStream({
      model: "gemma-4-31b-it",
      contents: "Write a 3 sentence story about a race.",
    });

    for await (const chunk of response) {
      // Color code the outputs so we can see them interleave in the console!
      const color = index === 1 ? "\x1b[32m" : "\x1b[35m"; // Green for Key 1, Magenta for Key 2
      const text = chunk.text ?? "";
      process.stdout.write(`${color}[Stream ${index}]\x1b[0m ${text}`);
    }
    
    console.log(`\n✅ [Key ${index}] Finished successfully!`);
  } catch (err) {
    console.log(`\n❌ [Key ${index}] STREAM FAILED: ${err.message}`);
  }
}

async function runConcurrentTests() {
  console.log(`Testing ${API_KEYS.length} keys Concurrently...\n`);
  
  // Fire them off at the exact same millisecond
  const tasks = API_KEYS.map((key, i) => testStream(key, i + 1));
  await Promise.all(tasks);
  
  console.log("\n\nAll tests completed.");
}

runConcurrentTests();
