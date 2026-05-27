const { execSync } = require("child_process");

console.log("Starting cleanup of pending_embed documents...");
let iteration = 1;

while (true) {
  try {
    console.log(`\n--- Iteration ${iteration} ---`);
    // Run the convex command
    const output = execSync('npx convex run crawl/mutations:reembedPendingBatch "{\\"limit\\": 300}"', {
      encoding: "utf8"
    });
    
    console.log("Output:", output.trim());
    const res = JSON.parse(output.trim());
    
    if (res.remaining === "done") {
      console.log("All pending_embed documents successfully processed!");
      break;
    }
    
    iteration++;
  } catch (error) {
    console.error("Error executing mutation:", error.message);
    if (error.stdout) console.error("Stdout:", error.stdout);
    if (error.stderr) console.error("Stderr:", error.stderr);
    break;
  }
}
