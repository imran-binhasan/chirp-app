import { createHash } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * Demo seed (`npm run prisma:seed`).
 *
 * Two properties matter here beyond "put rows in the database":
 *
 * 1. It is deterministic. Every id, timestamp and body is derived from a fixed
 *    PRNG seed, so the demo feed looks identical on every machine and every run.
 * 2. It is idempotent. Ids are hashes of (kind, index) rather than random UUIDs,
 *    and every insert uses `skipDuplicates`, so re-running against a database
 *    that is already seeded is a no-op instead of a second copy of the feed.
 *    That matters when seeding a live deployment, where a half-finished run has
 *    to be safe to repeat.
 *
 * It is additive with respect to real data: existing accounts and posts are
 * never read, updated or deleted.
 */

const prisma = new PrismaClient();

/** Change to reshuffle the whole demo feed; keep fixed to keep it reproducible. */
const RANDOM_SEED = 20260815;

const SEED_PASSWORD = 'demo2026';

/** Documented in the README so a reviewer can test push between two devices. */
const DEMO_ACCOUNTS = ['demo', 'demo2'] as const;

/** Posts authored by each demo account, so both are easy to find in the feed. */
const POSTS_PER_DEMO_ACCOUNT = 5;

/** Must exceed the largest like bucket below — a post cannot outlive its likers. */
const USER_COUNT = 36;

/** Newest-first feed spread across this window, weighted towards "just now". */
const FEED_WINDOW_HOURS = 14 * 24;

// ─── Deterministic randomness ────────────────────────────────────────────────

/** mulberry32 — small, fast, and stable across Node versions, unlike Math.random. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(RANDOM_SEED);

/** Non-empty array access that satisfies `noUncheckedIndexedAccess`. */
function pick<T>(items: readonly T[]): T {
  const value = items[Math.floor(random() * items.length)];
  if (value === undefined) throw new Error('pick() called with an empty array');
  return value;
}

/** Fisher-Yates. Returns a copy so callers keep their source order. */
function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) throw new Error('shuffle() index out of range');
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/**
 * Picks a range by weight, then a value inside it. Real engagement is not
 * uniform: most posts get little, a few get a lot. `Math.random() * 40` gives
 * every post roughly the same number of comments, which reads as obviously
 * generated the moment you scroll.
 */
function weightedCount(buckets: readonly (readonly [weight: number, min: number, max: number])[]): number {
  const total = buckets.reduce((sum, [weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [weight, min, max] of buckets) {
    roll -= weight;
    if (roll <= 0) return min + Math.floor(random() * (max - min + 1));
  }
  const last = buckets.at(-1);
  if (!last) throw new Error('weightedCount() called with no buckets');
  return last[1];
}

/** Most posts go unremarked; a handful carry a real thread. */
const COMMENT_BUCKETS = [
  [45, 0, 0],
  [30, 1, 4],
  [17, 5, 12],
  [8, 18, 30],
] as const;

/** Likes are cheaper than comments, so fewer posts have none at all. */
const LIKE_BUCKETS = [
  [20, 0, 1],
  [45, 2, 9],
  [25, 10, 20],
  [10, 21, 30],
] as const;

/**
 * Stable, collision-free ids. Re-running the seed reproduces exactly these, so
 * `skipDuplicates` can recognise rows that already exist.
 */
function stableId(kind: string, index: number): string {
  const hash = createHash('sha256').update(`chirp-seed:${RANDOM_SEED}:${kind}:${index}`).digest('hex');
  const variant = ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${variant}${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

/**
 * Weighted towards the present: squaring a uniform roll clusters posts into the
 * last day or two, so the top of the feed shows minutes and hours rather than
 * an unbroken column of "13d".
 */
function recentDate(): Date {
  const hoursAgo = random() ** 2 * FEED_WINDOW_HOURS;
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
}

/** A reply cannot predate the post it replies to. */
function dateBetween(start: Date, end: Date): Date {
  const span = Math.max(0, end.getTime() - start.getTime());
  return new Date(start.getTime() + random() * span);
}

// ─── Content ─────────────────────────────────────────────────────────────────

const handles = [
  'nadia', 'tanvir', 'priya', 'arif', 'sabrina', 'rifat', 'mehedi', 'anika',
  'shuvo', 'farhana', 'imtiaz', 'roksana', 'zayan', 'lubna', 'shovon', 'tasnim',
  'kamrul', 'nusrat', 'raihan', 'sadia', 'omar', 'jhumur', 'nabil', 'ishrat',
  'tuhin', 'maliha', 'sohel', 'rumana', 'asif', 'proma', 'fahim', 'labiba',
  'ridwan', 'shanta',
] as const;

/**
 * Every post body is distinct and used exactly once — no template is repeated,
 * which is the difference between a feed that reads as real and one that
 * obviously came out of a loop. A few carry @mentions and links so the feed
 * exercises ParsedText's entity highlighting.
 */
const postBodies = [
  'Spent all morning chasing a bug that turned out to be a missing await. Four hours. One keyword.',
  'The office coffee machine has developed a personality and I do not care for it ☕',
  'Genuinely convinced the best debugging tool is walking away for ten minutes.',
  'Anyone else find that the hardest part of a side project is naming it?',
  'Finally got the dark mode toggle working properly. Small win, big serotonin.',
  'It is 11pm and I am reading changelogs for fun. Send help.',
  'Rain all day. Perfect excuse to stay in and finally sort out my bookmarks.',
  'Hot take: a good README is worth more than three extra features.',
  'My cat has claimed the warm spot next to my laptop fan as her territory 🐈',
  'Six months ago I could not read this codebase. Today I refactored a chunk of it. Progress is quiet.',
  'Does anyone have a decent recipe for khichuri that does not take two hours?',
  'That moment when the test you wrote to prove the bug exists just... passes.',
  'Traffic on the way in was unreal today. Left at 8, arrived at 10.',
  'Reading about database indexes for the third time and only now does the B-tree part click.',
  'New keyboard day. My typing is somehow worse and I have never been happier ⌨️',
  'Watched the sunset from the rooftop. Some days the commute is worth it.',
  'Unpopular opinion: most meetings would be better as a three-line message.',
  'I keep a text file of things I broke and how I fixed them. Best habit I ever picked up.',
  'Trying to explain what I do for work to my grandmother. We settled on "he fixes computers".',
  'The satisfaction of deleting 400 lines of dead code is unmatched.',
  'Made it to the gym three times this week. Announcing it here so I actually keep going.',
  'Fun fact I learned today: the first computer bug was an actual moth.',
  'Anyone going to the meetup at Dhanmondi this weekend? Thinking of heading over.',
  'Three tabs open. Forty-one tabs open. There is no in-between.',
  'Rewrote my whole notes system this weekend. Will abandon it by Thursday, as tradition demands.',
  'The mango season is genuinely the only good thing about this heat 🥭',
  'Spent an hour picking a font. The app still does not work. Priorities.',
  'Learning to say "I do not know, let me find out" has made me much better at this job.',
  'My code review checklist is basically just "would future me understand this at 2am".',
  'Someone put the milk back in the fridge empty. I know who. I am watching.',
  'The library I was about to build already exists and is better. Saved myself a week.',
  'Late night walk. The city is a completely different place after midnight.',
  'Finally understand why everyone kept telling me to write the test first.',
  'Booked tickets for the coast next month. First proper break in over a year 🌊',
  'Every config file is a small autobiography of things that went wrong once.',
  'Do people actually use tabs over spaces or is that just a bit at this point?',
  'Made biryani from scratch for the first time. It was edible. That is a win.',
  'Just realised I have been mispronouncing a library name for two years in meetings.',
  'The best code I wrote this month was the code I convinced someone we did not need.',
  'Power cut for three hours and I discovered I own actual books. Who knew.',
  'Migrated the whole project to the new version. Nothing broke. Deeply suspicious.',
  'A colleague showed me a keyboard shortcut today that saves maybe six seconds. Life changed.',
  'The gap between "it works on my machine" and "it works" is where the career is.',
  'Trying to get back into sketching. Everything I draw looks like a potato right now.',
  'Two hours of planning saved me two days of building. Still feels like cheating.',
  'Whoever decided timezones should have half-hour offsets, we need to talk.',
  'My phone suggested I have been spending eight hours a day on screens. Rude but accurate.',
  'Small thing that made my week: someone said my documentation actually helped them.',
  'Started running again. Made it 2km. Lungs filed a formal complaint 🏃',
  'The older I get the more I appreciate boring, predictable technology.',
  'Just spent twenty minutes looking for my glasses. They were on my head.',
  'Every project has that one file nobody wants to touch. Ours is 1,400 lines long.',
  'Tea over coffee. I will not be taking questions at this time.',
  'Cleaned my desk and my productivity doubled. Correlation, causation, who cares.',
  'Realised the "temporary fix" I added is now two years old and load-bearing.',
  'The best advice I got this year: ship it, then make it good.',
  'Rooftop cricket with the neighbours turned competitive very fast 🏏',
  'Reading old commit messages from myself is like finding a diary I forgot writing.',
  'If your error message does not say what to do next, it is only half an error message.',
  'Weekend plan: absolutely nothing, aggressively defended.',
  'Discovered my laptop has a second fan speed and it is terrifying.',
  'Explaining recursion to a friend by making them look up recursion. Cruel but effective.',
  'The pastry place near the office raised prices again. I will still go. They know this.',
  'Nothing humbles you like reading code you wrote a year ago.',
  'Took the long way home just to listen to the rest of the album 🎧',
  'Turns out the performance problem was one missing index. It is always one missing index.',
  'Started a new notebook. First page already has a coffee ring on it. Tradition upheld.',
  'The feature took two days. Naming the button took two hours.',
  'Watching someone use software you built is the most educational and painful thing possible.',
  'Autumn light through the window at 4pm is doing a lot for my mood today.',
  'Reminder to self: the deploy button is not a personality trait.',
  'Finally cancelled three subscriptions I forgot I had. Free money, essentially.',
  'A junior asked me a question today I could not answer and I loved it.',
  'My browser has become a graveyard of articles I fully intend to read.',
  'Fixed the flaky test. It was a timezone assumption, because of course it was.',
  'Ordered the same thing from the same place for the fourth time this week. No notes.',
  'The moment a diagram makes the whole architecture obvious is genuinely the best part.',
  'Trying to build a habit of closing the laptop at 7. Day one of what will be many day ones.',
  'Something quietly great about a codebase where you can guess the filename correctly.',
  'Twenty minutes into the call before someone said "you are on mute". Classic.',
  'Sorted my photo library by year and lost the entire evening to 2019.',
  'The best part of a long weekend is Sunday, knowing there is still Monday.',
  'Just shipped something I am actually proud of. Rare feeling, worth marking down.',
] as const;

/**
 * Replies are short and reactive by nature, so a smaller pool is realistic —
 * but no post ever shows the same reply twice.
 */
const commentBodies = [
  'This is far too relatable.',
  'Ha! Same energy over here.',
  'Genuinely needed to read this today.',
  'Okay but how did you actually fix it?',
  'Saving this one.',
  'Completely agree.',
  'Strong disagree, respectfully 😄',
  'You have described my entire week.',
  'Which one did you end up going with?',
  'Please tell me you wrote it down somewhere.',
  'This took me way too long to learn as well.',
  'Adding this to my list immediately.',
  'The last line got me.',
  'How long did that take you?',
  'I was literally about to post the same thing.',
  'Underrated point honestly.',
  'Been there. Twice. Last month.',
  'Wait, is that actually true?',
  'Sending this to my whole team.',
  'Any chance you could share the setup?',
  'This aged well in about four hours.',
  'Tell me you have a screenshot.',
  'The correct answer, obviously.',
  'Ha, my version of this involved a lot more shouting.',
  'Big if true.',
  'Reading this at 1am and feeling seen.',
  'Have you tried the newer approach for this?',
  'Solid advice, actually.',
  'This is the kind of post I am here for.',
  'You are braver than me.',
  'Every single time.',
  'Curious what changed your mind on it.',
  'Bookmarked, thank you.',
  'Not the moth fact 😂',
  'Honestly this should be pinned somewhere.',
  'How is it holding up a week later?',
  'Made the same mistake yesterday.',
  'Worth every minute by the sound of it.',
  'Would love to hear more about this.',
  'Painfully accurate.',
  'Right? Nobody warns you about that part.',
  'Congrats, that is a real milestone.',
  'What made you finally do it?',
  'Filing this under things I wish I knew earlier.',
  'The second half especially.',
  'This unlocked something for me, thanks.',
  'Bold of you to admit it publicly.',
  'Good on you for sticking with it.',
  'Counterpoint: it depends 😄',
  'I have been putting this off for months.',
] as const;

// ─── Seeding ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Seeding database…');

  const passwordHash = await argon2.hash(SEED_PASSWORD);

  const usernames = [...DEMO_ACCOUNTS, ...handles].slice(0, USER_COUNT);
  if (usernames.length < USER_COUNT) {
    throw new Error(`Need ${USER_COUNT} handles, have ${usernames.length}`);
  }

  await prisma.user.createMany({
    data: usernames.map((username, index) => ({
      id: stableId('user', index),
      username,
      email: `${username}@example.com`,
      passwordHash,
    })),
    skipDuplicates: true,
  });

  // Read back rather than trusting the write: on a re-run the rows already
  // exist with their original ids, and those are the ids everything else needs.
  const users = await prisma.user.findMany({
    where: { username: { in: [...usernames] } },
    select: { id: true, username: true },
  });
  const byUsername = new Map(users.map((user) => [user.username, user]));
  const demoUsers = DEMO_ACCOUNTS.map((name) => {
    const user = byUsername.get(name);
    if (!user) throw new Error(`Demo account "${name}" is missing after seeding`);
    return user;
  });
  console.log(`  ${users.length} users (password: ${SEED_PASSWORD})`);

  // Guarantee both demo accounts own posts, then fill the rest at random, so a
  // reviewer logging into either one lands on a profile that is not empty.
  const demoNames = new Set<string>(DEMO_ACCOUNTS);
  const others = users.filter((user) => !demoNames.has(user.username));
  const authorSlots = shuffle([
    ...demoUsers.flatMap((user) => Array.from({ length: POSTS_PER_DEMO_ACCOUNT }, () => user)),
    ...Array.from({ length: postBodies.length - demoUsers.length * POSTS_PER_DEMO_ACCOUNT }, () =>
      pick(others),
    ),
  ]);

  const posts = postBodies.map((content, index) => {
    const createdAt = recentDate();
    const author = authorSlots[index];
    if (!author) throw new Error('Ran out of author slots');
    return {
      id: stableId('post', index),
      authorId: author.id,
      content,
      createdAt,
      updatedAt: createdAt,
    };
  });
  await prisma.post.createMany({ data: posts, skipDuplicates: true });
  console.log(`  ${posts.length} posts`);

  const likes: Prisma.LikeCreateManyInput[] = [];
  const comments: Prisma.CommentCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  const tally = new Map<string, { likes: number; comments: number }>();

  let commentIndex = 0;
  let notificationIndex = 0;
  const now = new Date();

  for (const post of posts) {
    // Sampling without replacement: a user can only like a post once, and the
    // unique constraint would silently drop the duplicates anyway.
    const likers = shuffle(users)
      .filter((user) => user.id !== post.authorId)
      .slice(0, weightedCount(LIKE_BUCKETS));

    for (const liker of likers) {
      const createdAt = dateBetween(post.createdAt, now);
      likes.push({ userId: liker.id, postId: post.id, createdAt });
      // Mirrors the API: you are never notified about your own action, and a
      // like produces at most one inbox row per (actor, post).
      notifications.push({
        id: stableId('notification', notificationIndex++),
        userId: post.authorId,
        actorId: liker.id,
        type: 'POST_LIKED',
        postId: post.id,
        read: random() > 0.2,
        createdAt,
      });
    }

    const replyBodies = shuffle(commentBodies).slice(0, weightedCount(COMMENT_BUCKETS));
    for (const content of replyBodies) {
      const commenter = pick(users);
      const createdAt = dateBetween(post.createdAt, now);
      comments.push({
        id: stableId('comment', commentIndex++),
        postId: post.id,
        authorId: commenter.id,
        content,
        createdAt,
      });
      if (commenter.id !== post.authorId) {
        notifications.push({
          id: stableId('notification', notificationIndex++),
          userId: post.authorId,
          actorId: commenter.id,
          type: 'POST_COMMENTED',
          postId: post.id,
          read: random() > 0.2,
          createdAt,
        });
      }
    }

    tally.set(post.id, { likes: likers.length, comments: replyBodies.length });
  }

  await prisma.like.createMany({ data: likes, skipDuplicates: true });
  await prisma.comment.createMany({ data: comments, skipDuplicates: true });
  // Without these the demo accounts would show liked, commented-on posts beside
  // a completely empty inbox — the one place the seed could look broken.
  await prisma.notification.createMany({ data: notifications, skipDuplicates: true });

  // The counters are denormalized, so the seed has to maintain them itself.
  // One absolute UPDATE per post — which also makes a re-run self-correcting.
  await prisma.$transaction(
    [...tally].map(([postId, counts]) =>
      prisma.post.update({
        where: { id: postId },
        data: { likeCount: counts.likes, commentCount: counts.comments },
      }),
    ),
  );
  console.log(`  ${likes.length} likes, ${comments.length} comments, ${notifications.length} notifications`);

  const unread = notifications.filter((notification) => !notification.read).length;
  console.log(`\nDone. ${unread} notifications left unread so the inbox badge is visible.`);
  console.log(`Demo accounts: ${DEMO_ACCOUNTS.join(', ')} — password "${SEED_PASSWORD}".`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
