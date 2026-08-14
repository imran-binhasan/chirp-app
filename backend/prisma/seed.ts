import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * Development seed (`npm run prisma:seed`). Every account shares SEED_PASSWORD
 * and `demo` always exists, so you can log in immediately.
 */

const prisma = new PrismaClient();

const USER_COUNT = 60;
const POST_COUNT = 120;
const MAX_LIKES_PER_POST = 10;
/** Enough to page through several times without making the seed take minutes. */
const MAX_COMMENTS_PER_POST = 40;
const SEED_PASSWORD = 'Password123!';

const firstNames = ['alex', 'jordan', 'taylor', 'morgan', 'casey', 'riley', 'jamie', 'charlie', 'avery', 'parker'];
const lastNames = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez'];
const postTemplates = [
  'Just had the best coffee of my life ☕',
  'Who else is working late tonight? 🌙',
  'Can’t believe how fast this year is flying by!',
  'Looking for good book recommendations 📚',
  'Just deployed my first app to production! 🚀',
  'What a beautiful day to write some code 💻',
  'Does anyone else get completely distracted by shiny new frameworks?',
  'Thinking about picking up a new hobby... maybe gardening?',
  'Just watched the best movie ever. If you haven’t seen it, you must!',
  'My dog is currently snoring louder than a freight train 🐶',
  'Pro tip: always keep a backup of your backup.',
  'Finally finished that massive project. Time to celebrate! 🎉',
  'Is it just me, or is the weather today absolutely perfect?',
  'Just learned something new today and my mind is blown 🤯',
  'Taking a much needed break from screens this weekend.',
  'Coffee count for today: 4. I might be vibrating.',
  'Who is going to the tech meetup next week?',
  'Nothing beats a good home-cooked meal.',
  'Why do bugs always appear on a Friday afternoon?',
  'Hello world! Just testing out this new social app. Looks amazing!',
];
const commentTemplates = [
  'Great post! Just adding my two cents.',
  'Completely agree with this.',
  'Ha, this made my morning.',
  'Could you say more about this?',
  'Saving this one for later.',
  'Same here, honestly.',
];

/** Non-empty array access that satisfies `noUncheckedIndexedAccess`. */
function pick<T>(items: readonly T[]): T {
  const value = items[Math.floor(Math.random() * items.length)];
  if (value === undefined) throw new Error('pick() called with an empty array');
  return value;
}

/** Spread over the last week so the feed has a realistic time gradient. */
function recentDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * 7));
  date.setHours(date.getHours() - Math.floor(Math.random() * 24));
  return date;
}

async function main(): Promise<void> {
  console.log('Seeding database…');

  const passwordHash = await argon2.hash(SEED_PASSWORD);

  // De-duplicated up front, so a random collision costs nothing.
  const usernames = new Set<string>(['demo']);
  while (usernames.size < USER_COUNT) {
    usernames.add(`${pick(firstNames)}${pick(lastNames)}${Math.floor(Math.random() * 1000)}`);
  }

  await prisma.user.createMany({
    data: [...usernames].map((username) => ({
      username,
      email: `${username}@example.com`,
      passwordHash,
    })),
    skipDuplicates: true,
  });

  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  if (users.length === 0) throw new Error('No users were created — cannot seed posts');
  console.log(`  ${users.length} users`);

  const posts = Array.from({ length: POST_COUNT }, () => {
    const createdAt = recentDate();
    let content = pick(postTemplates);
    if (Math.random() > 0.7) content += ` totally agree with @${pick(users).username}`;
    if (Math.random() > 0.8) content += ' Check it out: https://example.com/techz';
    return { id: randomUUID(), authorId: pick(users).id, content, createdAt, updatedAt: createdAt };
  });
  await prisma.post.createMany({ data: posts });
  console.log(`  ${posts.length} posts`);

  // Bulk-inserted, with the denormalized counters written from the same
  // tallies: one UPDATE per post rather than one per interaction.
  const likes: Prisma.LikeCreateManyInput[] = [];
  const comments: Prisma.CommentCreateManyInput[] = [];
  const tally = new Map<string, { likes: number; comments: number }>();

  for (const post of posts) {
    const likers = new Set<string>();
    for (let i = 0; i < Math.floor(Math.random() * MAX_LIKES_PER_POST); i++) {
      likers.add(pick(users).id);
    }
    for (const userId of likers) likes.push({ userId, postId: post.id });

    const commentCount = Math.floor(Math.random() * MAX_COMMENTS_PER_POST);
    for (let i = 0; i < commentCount; i++) {
      comments.push({
        postId: post.id,
        authorId: pick(users).id,
        content: pick(commentTemplates),
        createdAt: recentDate(),
      });
    }

    tally.set(post.id, { likes: likers.size, comments: commentCount });
  }

  await prisma.like.createMany({ data: likes, skipDuplicates: true });
  await prisma.comment.createMany({ data: comments });
  await prisma.$transaction(
    [...tally].map(([postId, counts]) =>
      prisma.post.update({
        where: { id: postId },
        data: { likeCount: counts.likes, commentCount: counts.comments },
      }),
    ),
  );
  console.log(`  ${likes.length} likes, ${comments.length} comments`);

  console.log(`Done. Log in as any user with the password "${SEED_PASSWORD}" (try "demo").`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
