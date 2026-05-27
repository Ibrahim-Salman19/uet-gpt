const { execSync } = require("child_process");

console.log("Reprocessing Dead Letter Queue...");

// 1. Reset abandoned items back to pending_retry
try {
  console.log("Resetting abandoned Dead Letter Queue items...");
  const resetOutput = execSync('npx convex run crawl/mutations:resetAbandonedDLQ "{\\"limit\\": 200}"', {
    encoding: "utf8"
  });
  console.log("Reset Output:", resetOutput.trim());
} catch (error) {
  console.error("Error resetting abandoned items:", error.message);
}

// 2. Loop calling retryDeadLetterQueue
let iteration = 1;
while (true) {
  try {
    console.log(`\n--- DLQ Reprocessing Iteration ${iteration} ---`);
    const output = execSync('npx convex run crawl/mutations:retryDeadLetterQueue "{\\"limit\\": 50}"', {
      encoding: "utf8"
    });
    
    console.log("Output:", output.trim());
    const res = JSON.parse(output.trim());
    
    if (res.remaining === "done") {
      console.log("Dead Letter Queue reprocessing successfully completed!");
      break;
    }
    
    iteration++;
  } catch (error) {
    console.error("Error retrying DLQ items:", error.message);
    break;
  }
}
