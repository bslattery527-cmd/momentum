import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
