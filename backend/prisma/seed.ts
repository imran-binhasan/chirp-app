import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Charlie', 'Avery', 'Parker'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
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
  'Hello world! Just testing out this new social app. Looks amazing!'
];

async function main() {
  console.log('Starting database seed...');
  
  const passwordHash = await argon2.hash('Password123!');
  const users = [];

  // Create 60 Users
  for (let i = 0; i < 60; i++) {
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];
    const username = `${first}${last}${Math.floor(Math.random() * 1000)}`.toLowerCase();
    
    try {
      const user = await prisma.user.upsert({
        where: { username },
        update: {},
        create: {
          username,
          email: `${username}@example.com`,
          passwordHash,
        },
      });
      users.push(user);
    } catch {
      // Ignore unique constraint errors from random collisions
    }
  }
  console.log(`Created ${users.length} users.`);

  // Create 120 Posts
  const posts = [];
  for (let i = 0; i < 120; i++) {
    const author = users[Math.floor(Math.random() * users.length)];
    const template = postTemplates[Math.floor(Math.random() * postTemplates.length)];
    
    // Add random mentions and links to some posts
    let content = template;
    if (Math.random() > 0.7) {
      const mention = users[Math.floor(Math.random() * users.length)];
      content += ` totally agree with @${mention.username}`;
    }
    if (Math.random() > 0.8) {
      content += ` Check it out: https://example.com/techz`;
    }

    // Spread creation dates out over the last 7 days
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 7));
    createdAt.setHours(createdAt.getHours() - Math.floor(Math.random() * 24));

    const post = await prisma.post.create({
      data: {
        content,
        authorId: author.id,
        createdAt,
        updatedAt: createdAt,
      }
    });
    posts.push(post);
  }
  console.log(`Created ${posts.length} posts.`);

  // Create some random likes and comments
  for (const post of posts) {
    // 0 to 10 likes per post
    const numLikes = Math.floor(Math.random() * 10);
    for (let i = 0; i < numLikes; i++) {
      const liker = users[Math.floor(Math.random() * users.length)];
      try {
        await prisma.like.create({
          data: {
            postId: post.id,
            userId: liker.id,
          }
        });
        await prisma.post.update({
          where: { id: post.id },
          data: { likeCount: { increment: 1 } }
        });
      } catch {
        // Ignore duplicate likes
      }
    }

    // 300 to 400 comments per post (to test pagination/UI limits)
    const numComments = 300 + Math.floor(Math.random() * 100);
    for (let i = 0; i < numComments; i++) {
      const commenter = users[Math.floor(Math.random() * users.length)];
      const commentText = `Great post! Just adding my two cents.`;
      try {
        await prisma.comment.create({
          data: {
            postId: post.id,
            authorId: commenter.id,
            content: commentText,
          }
        });
        await prisma.post.update({
          where: { id: post.id },
          data: { commentCount: { increment: 1 } }
        });
      } catch {
        // Ignore duplicate comment collisions
      }
    }
  }
  
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
