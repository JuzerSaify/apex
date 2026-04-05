#!/usr/bin/env ts-node
/**
 * KeepCode Twitter/X Marketing Poster
 *
 * Usage:
 *   1. Copy .env.example → .env and fill in your Twitter API keys
 *   2. Run: npm run post
 *   3. Select a thread, preview it, confirm → posts live
 *
 * Place screenshot PNGs under marketing/assets/ for media tweets.
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { TwitterApi } from "twitter-api-v2";
import chalk from "chalk";
import ora from "ora";
import * as dotenv from "dotenv";
import { threads, type Tweet, type Thread } from "./threads";

// ─── Load .env ────────────────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, "../.env");
if (!fs.existsSync(envPath)) {
  console.error(chalk.red(`\n✖  .env file not found at ${envPath}`));
  console.error(
    chalk.yellow(`   Copy .env.example → .env and fill in your API keys.\n`)
  );
  process.exit(1);
}
dotenv.config({ path: envPath });

// ─── Validate credentials ─────────────────────────────────────────────────────

const {
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_TOKEN_SECRET,
} = process.env;

if (
  !TWITTER_API_KEY ||
  !TWITTER_API_SECRET ||
  !TWITTER_ACCESS_TOKEN ||
  !TWITTER_ACCESS_TOKEN_SECRET
) {
  console.error(
    chalk.red("\n✖  Missing Twitter API credentials in .env file.\n")
  );
  console.error(
    chalk.dim(
      "   Required: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET\n"
    )
  );
  process.exit(1);
}

const client = new TwitterApi({
  appKey: TWITTER_API_KEY,
  appSecret: TWITTER_API_SECRET,
  accessToken: TWITTER_ACCESS_TOKEN,
  accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
});

const rwClient = client.readWrite;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ASSETS_DIR = path.resolve(__dirname, "../assets");

function rl(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function ask(question: string): Promise<string> {
  const iface = rl();
  return new Promise((resolve) => {
    iface.question(question, (answer) => {
      iface.close();
      resolve(answer.trim());
    });
  });
}

function charCount(text: string): number {
  // Twitter counts URLs as 23 chars each regardless of actual length.
  return text.replace(/https?:\/\/\S+/g, "x".repeat(23)).length;
}

function printTweetPreview(tweet: Tweet, index: number, total: number): void {
  const chars = charCount(tweet.content);
  const overLimit = chars > 280;
  const charLabel = overLimit
    ? chalk.red(`${chars}/280 ⚠ OVER LIMIT`)
    : chalk.green(`${chars}/280`);

  console.log(
    chalk.bold(`\n  Tweet ${index + 1}/${total}  `) + chalk.dim(`[${charLabel}]`)
  );
  if (tweet.mediaPath) {
    const fullPath = path.resolve(ASSETS_DIR, tweet.mediaPath.replace("assets/", ""));
    const exists = fs.existsSync(fullPath);
    console.log(
      chalk.dim(`  📎 Media: `) +
        (exists ? chalk.green(tweet.mediaPath) : chalk.yellow(`${tweet.mediaPath} (file not found — will skip media)`))
    );
  }
  console.log(
    chalk.dim("  ┌─────────────────────────────────────────────────────────")
  );
  tweet.content.split("\n").forEach((line) => {
    console.log(chalk.dim("  │ ") + line);
  });
  console.log(
    chalk.dim("  └─────────────────────────────────────────────────────────")
  );
}

async function uploadMedia(mediaPath: string): Promise<string | undefined> {
  const fullPath = path.resolve(
    ASSETS_DIR,
    mediaPath.replace("assets/", "")
  );
  if (!fs.existsSync(fullPath)) return undefined;
  const mediaBuffer = fs.readFileSync(fullPath);
  const mediaId = await rwClient.v1.uploadMedia(mediaBuffer, {
    mimeType: "image/png",
  });
  return mediaId;
}

async function postThread(thread: Thread, dryRun: boolean): Promise<void> {
  let replyToId: string | undefined;

  for (let i = 0; i < thread.tweets.length; i++) {
    const tweet = thread.tweets[i];
    const spinner = ora(
      `Posting tweet ${i + 1}/${thread.tweets.length}...`
    ).start();

    if (dryRun) {
      await new Promise((r) => setTimeout(r, 600));
      spinner.succeed(
        chalk.dim(`[DRY RUN] Tweet ${i + 1} would be posted`)
      );
      continue;
    }

    try {
      let mediaIds: [string] | undefined;
      if (tweet.mediaPath) {
        const mediaId = await uploadMedia(tweet.mediaPath);
        if (mediaId) {
          mediaIds = [mediaId];
          spinner.text = `Posting tweet ${i + 1}/${thread.tweets.length} (with image)...`;
        }
      }

      const payload: {
        text: string;
        reply?: { in_reply_to_tweet_id: string };
        media?: { media_ids: [string] };
      } = { text: tweet.content };

      if (replyToId) {
        payload.reply = { in_reply_to_tweet_id: replyToId };
      }
      if (mediaIds) {
        payload.media = { media_ids: mediaIds };
      }

      const posted = await rwClient.v2.tweet(payload);
      replyToId = posted.data.id;
      spinner.succeed(
        chalk.green(`Tweet ${i + 1} posted`) +
          chalk.dim(` — https://x.com/i/web/status/${posted.data.id}`)
      );

      // Delay between tweets to avoid rate limits
      if (i < thread.tweets.length - 1) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      spinner.fail(chalk.red(`Failed to post tweet ${i + 1}: ${msg}`));
      throw err;
    }
  }
}

// ─── Main interactive flow ────────────────────────────────────────────────────

async function selectThread(): Promise<Thread | null> {
  console.log(chalk.bold("\n  KeepCode — Twitter/X Marketing Poster\n"));
  console.log(chalk.dim("  Available threads:\n"));

  threads.forEach((t, i) => {
    console.log(
      `  ${chalk.cyan(`[${i + 1}]`)} ${t.title}`
    );
    console.log(
      chalk.dim(`       ${t.tweets.length} tweets · ${t.description}`)
    );
    console.log();
  });

  const answer = await ask(
    chalk.bold(`  Select thread (1–${threads.length}), or 0 to cancel: `)
  );
  const idx = parseInt(answer, 10) - 1;

  if (answer === "0" || isNaN(idx) || idx < 0 || idx >= threads.length) {
    return null;
  }

  return threads[idx];
}

async function selectSingleTweet(thread: Thread): Promise<Thread> {
  const fullThread = "Full thread";
  console.log(chalk.dim("\n  Post options:\n"));
  console.log(`  ${chalk.cyan("[0]")} ${fullThread} (${thread.tweets.length} tweets)`);
  thread.tweets.forEach((t, i) => {
    const preview = t.content.split("\n")[0].slice(0, 60);
    console.log(`  ${chalk.cyan(`[${i + 1}]`)} ${chalk.dim("Just tweet:")} ${preview}…`);
  });

  const answer = await ask(chalk.bold("\n  Selection (0 = full thread): "));
  const idx = parseInt(answer, 10);

  if (isNaN(idx) || idx < 0 || idx > thread.tweets.length) return thread;
  if (idx === 0) return thread;

  return {
    ...thread,
    tweets: [thread.tweets[idx - 1]],
  };
}

async function main(): Promise<void> {
  const thread = await selectThread();
  if (!thread) {
    console.log(chalk.dim("\n  Cancelled.\n"));
    return;
  }

  const selection = await selectSingleTweet(thread);

  // ── Preview ──
  console.log(
    chalk.bold(`\n  Preview: "${selection.title}"\n`)
  );
  selection.tweets.forEach((t, i) =>
    printTweetPreview(t, i, selection.tweets.length)
  );

  // ── Over-limit check ──
  const overLimit = selection.tweets.filter((t) => charCount(t.content) > 280);
  if (overLimit.length > 0) {
    console.log(
      chalk.yellow(
        `\n  ⚠  ${overLimit.length} tweet(s) exceed 280 characters. Edit threads.ts before posting.\n`
      )
    );
  }

  // ── Dry run or live? ──
  const mode = await ask(
    chalk.bold(
      "\n  Post mode? (d = dry run preview only, l = post live, q = quit): "
    )
  );

  if (mode === "q" || mode === "Q") {
    console.log(chalk.dim("\n  Cancelled.\n"));
    return;
  }

  const dryRun = mode !== "l" && mode !== "L";

  if (!dryRun) {
    const confirm = await ask(
      chalk.red(
        `\n  ⚠  This will post ${selection.tweets.length} tweet(s) LIVE to your account. Type YES to confirm: `
      )
    );
    if (confirm !== "YES") {
      console.log(chalk.dim("\n  Aborted.\n"));
      return;
    }
  }

  console.log();

  try {
    await postThread(selection, dryRun);
    if (dryRun) {
      console.log(
        chalk.dim("\n  Dry run complete — no tweets were posted.\n")
      );
    } else {
      console.log(chalk.green("\n  ✔ Thread posted successfully!\n"));
    }
  } catch {
    console.log(chalk.red("\n  ✖ Thread posting failed. See error above.\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(chalk.red("\n✖ Unexpected error:"), err);
  process.exit(1);
});
