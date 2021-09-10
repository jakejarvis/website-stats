const path = require("path");
const fs = require("fs-extra");
const pkgDir = require("pkg-dir");
const got = require("got");
const simpleGit = require("simple-git");
const { DateTime } = require("luxon");
const prettier = require("prettier");

// https://github.com/jakejarvis/jarv.is/blob/main/api/hits.ts#L101
const API_ENDPOINT = "https://jarv.is/api/hits/";

(async () => {
  // find our bearings
  const rootDir = await pkgDir(__dirname);
  const fullDate = DateTime.now().toISODate();
  const jsonPath = path.join(
    rootDir,
    "data",
    DateTime.now().toFormat('yyyy'), // year
    DateTime.now().toFormat('LL'), // month
    `${fullDate}.json` // year-month-day.json
  );

  // pull the latest stats from API
  console.info("📡 Fetching latest data from API...");
  const { body } = await got(API_ENDPOINT, { responseType: "json" });

  // write pretty JSON to timestamped file
  console.info(`✏️ Writing data to ${jsonPath} ...`);
  await fs.outputFile(
    jsonPath,
    prettier.format(JSON.stringify(body.pages), { parser: "json" })
  );

  // automatically push changes only if running from CI
  if (process.env.GITHUB_ACTION) {
    console.info("🤖 Detected CI: committing new data to repo and pushing back...");

    // the repo is located one level up from this script
    const git = simpleGit({ baseDir: rootDir });

    // let a generic GitHub bot user author this commit instead of me:
    // https://github.community/t/github-actions-bot-email-address/17204/5
    git.addConfig("user.name", "github-actions[bot]");
    git.addConfig("user.email", "41898282+github-actions[bot]@users.noreply.github.com");

    // do the normal git stuff
    await git.add([ jsonPath ]);
    await git.commit(`📈 Add new snapshot for ${fullDate}`);
    await git.push("origin", "main");
  } else {
    console.info("🤖 Didn't detect CI: skipping Git steps...");
  }
})();
