import fs from 'fs';
import path from 'path';

try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  
  function getEnvVal(keyName) {
    const match = envFile.match(new RegExp(`${keyName}=([^\\s#]+)`));
    return match ? match[1].replace(/['"]/g, "") : null;
  }

  const key = getEnvVal("GEMINI_API_KEY_1") || getEnvVal("GOOGLE_GENERATIVE_AI_API_KEY") || getEnvVal("GEMINI_API_KEY");

  if (!key) {
    console.error("No API key found!");
    process.exit(1);
  }

  console.log("Using API key:", key.substring(0, 8) + "...");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await response.json();
  if (data.models) {
    console.log(data.models.map(m => `${m.name} -> ${m.supportedGenerationMethods.join(", ")}`));
  } else {
    console.error("Response error:", data);
  }
} catch (err) {
  console.error("Error:", err);
}
