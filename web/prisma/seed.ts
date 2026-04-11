import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const resistors = await prisma.category.upsert({
    where: { id: "seed-resistors" },
    create: {
      id: "seed-resistors",
      name: "Resistors",
    },
    update: {},
  });

  await prisma.category.upsert({
    where: { id: "seed-res-smd" },
    create: {
      id: "seed-res-smd",
      name: "SMD",
      parentId: resistors.id,
    },
    update: {},
  });

  const shelf = await prisma.storageLocation.upsert({
    where: { id: "seed-shelf-a" },
    create: {
      id: "seed-shelf-a",
      name: "Shelf A",
    },
    update: {},
  });

  const bin = await prisma.storageLocation.upsert({
    where: { id: "seed-bin-3" },
    create: {
      id: "seed-bin-3",
      name: "Bin 3",
      parentId: shelf.id,
    },
    update: {},
  });

  const smd = await prisma.category.findFirst({
    where: { parentId: resistors.id, name: "SMD" },
  });

  await prisma.part.upsert({
    where: { id: "seed-part-10k" },
    create: {
      id: "seed-part-10k",
      name: "10k 0603 1%",
      internalSku: "R-10K-0603",
      mpn: "RC0603FR-0710KL",
      manufacturer: "Yageo",
      quantityOnHand: 100,
      reorderMin: 20,
      unit: "pcs",
      categoryId: smd?.id ?? resistors.id,
      defaultLocationId: bin.id,
      description: "Generic 0603 10k resistor for prototyping.",
    },
    update: {},
  });

  console.log("Seed complete: categories, locations, sample part.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
