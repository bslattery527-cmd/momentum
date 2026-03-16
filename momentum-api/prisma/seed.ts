import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../generated/prisma/index.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const DEFAULT_CATEGORIES = [
  { name: 'Reading',  icon: '📚', isDefault: true },
  { name: 'Coding',   icon: '💻', isDefault: true },
  { name: 'Writing',  icon: '✍️',  isDefault: true },
  { name: 'Study',    icon: '🎓', isDefault: true },
  { name: 'Creative', icon: '🎨', isDefault: true },
  { name: 'Other',    icon: '⚡', isDefault: true },
];

async function main() {
  console.log('Seeding categories...');

  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { name: cat.name },
    });

    if (!existing) {
      await prisma.category.create({ data: cat });
      console.log(`  Created category: ${cat.name}`);
    } else {
      console.log(`  Category already exists: ${cat.name}`);
    }
  }

  const count = await prisma.category.count();
  console.log(`Done. Total categories: ${count}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
