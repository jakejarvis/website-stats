import path from "path";
import fs from "fs";
import fetch from "node-fetch";
import { format } from "date-fns";
import simpleGit from "simple-git";

// https://github.com/jakejarvis/jarv.is/blob/main/pages/api/hits.ts
const API_ENDPOINT = "https://jarv.is/api/hits/";

// formulate path to target .json file
const today = new Date();
const jsonPath = path.join(
  process.cwd(),
  "data",
  format(today, "yyyy"), // year
  format(today, "MM"), // month
  `${format(today, "yyyy-MM-dd")}.json` // year-month-day.json
);
const latestPath = path.join(process.cwd(), "data", "latest.json");

// pull the latest stats from API
console.info("📡 Fetching latest data from API...");
const data = await (await fetch(API_ENDPOINT)).json();

// write pretty JSON to timestamped file
console.info(`📂 Writing data to ${jsonPath} ...`);
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(data.pages || data, null, "\t") + "\n");

// update latest.json symlink to newest timestamped file
console.info(`🔗 Pointing latest.json to ${jsonPath} ...`);
fs.rmSync(latestPath, { force: true });
fs.symlinkSync(path.relative(path.dirname(latestPath), jsonPath), latestPath, "file");

// automatically push changes only if running from CI
if (process.env.GITHUB_ACTION) {
  console.info("🤖 Detected CI: committing new data to repo and pushing back...");

  // the repo is located one level up from this script
  const git = simpleGit({ baseDir: process.cwd() });

  // let a generic GitHub bot user author this commit instead of me:
  // https://github.community/t/github-actions-bot-email-address/17204/5
  git.addConfig("user.name", "github-actions[bot]");
  git.addConfig("user.email", "41898282+github-actions[bot]@users.noreply.github.com");

  // do the normal git stuff
  await git.add([jsonPath, latestPath]);
  await git.commit(`📈 Add new snapshot for ${format(today, "yyyy-MM-dd")}`);
  await git.push("origin", "main");
} else {
  console.warn("🤖 Didn't detect CI: skipping Git steps...");
}
