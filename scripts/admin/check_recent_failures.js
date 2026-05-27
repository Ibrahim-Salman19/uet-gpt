const { execSync } = require("child_process");

console.log("Checking recent failures in Dead Letter Queue...");
try {
  // Let's run a query to get all DLQ items order by creation time desc
  // Wait, we can write a simple convex query or run a javascript code using convex
  // Let's write a temporary query in convex/crawl/queries.ts to get recent DLQ items order by creation time
  console.log("Reading raw DLQ status...");
  const output = execSync('npx convex run crawl/queries:getDLQSample', {
    encoding: "utf8"
  });
  const data = JSON.parse(output.trim());
  
  // Sort by _creationTime desc
  data.sort((a, b) => b._creationTime - a._creationTime);
  
  console.log("Total sample items:", data.length);
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const item = data[i];
    console.log(`\n--- DLQ Item ${i+1} ---`);
    console.log(`ID: ${item._id}`);
    console.log(`URL: ${item.url}`);
    console.log(`Status: ${item.status}`);
    console.log(`Failure Reason: ${item.failureReason}`);
    console.log(`Created At: ${new Date(item._creationTime).toISOString()}`);
    console.log(`Last Attempt: ${new Date(item.lastAttemptAt).toISOString()}`);
  }
} catch (error) {
  console.error("Error checking recent failures:", error.message);
}
