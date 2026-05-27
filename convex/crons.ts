import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run the daily web crawl at midnight UTC
crons.daily(
  "daily-uet-webcrawl",
  { hourUTC: 0, minuteUTC: 0 },
  internal.crawl.workflow.kickoffDailyCrawl,
);

export default crons;
