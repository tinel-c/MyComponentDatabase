import path from "path";
import { PrismaClient, Role } from "../src/generated/prisma-client";
import { seedComponentsFromFolder } from "./seed-components";

const prisma = new PrismaClient();

/** Sample line items typical of TME.eu (Transfer Multisort Elektronik) — MPNs are manufacturer numbers, not TME order codes. */
const TME_SAMPLE_PARTS: Array<{
  id: string;
  name: string;
  internalSku: string;
  mpn: string;
  manufacturer: string;
  description: string;
  quantityOnHand: number;
  reorderMin: number;
  categoryId: string;
  defaultLocationId: string;
  imageUrl?: string | null;
}> = [
  {
    id: "seed-part-10k",
    name: "Rezistor 10kΩ 0603 1%",
    internalSku: "TME-R-10K-0603",
    mpn: "RC0603FR-0710KL",
    manufacturer: "YAGEO",
    description:
      "Rezistor film metalic SMD 0603. În catalog TME: căutați RC0603FR-0710KL (YAGEO).",
    quantityOnHand: 100,
    reorderMin: 20,
    categoryId: "seed-res-smd",
    defaultLocationId: "seed-bin-3",
  },
  {
    id: "seed-tme-cap-0805",
    name: "Condensator ceramic 10µF 10V X5R 0805",
    internalSku: "TME-C-10U-0805",
    mpn: "CL21A106KAYNNNE",
    manufacturer: "SAMSUNG",
    description:
      "Condensator MLCC 0805. În catalog TME: căutați CL21A106KAYNNNE (Samsung Electro-Mechanics).",
    quantityOnHand: 50,
    reorderMin: 10,
    categoryId: "seed-capacitors",
    defaultLocationId: "seed-bin-3",
  },
  {
    id: "seed-tme-diode-smd",
    name: "Diodă comutare SOD-323 1N4148",
    internalSku: "TME-D-1N4148WS",
    mpn: "1N4148WS-7-F",
    manufacturer: "DIODES INC.",
    description:
      "Diodă de semnal rapidă SOD-323. În catalog TME: căutați 1N4148WS-7-F.",
    quantityOnHand: 200,
    reorderMin: 40,
    categoryId: "seed-semiconductors",
    defaultLocationId: "seed-bin-3",
  },
  {
    id: "seed-tme-bc817",
    name: "Tranzistor NPN BC817 SOT-23",
    internalSku: "TME-T-BC817-25",
    mpn: "BC817-25,215",
    manufacturer: "NEXPERIA",
    description:
      "Tranzistor NPN de uz general. În catalog TME: căutați BC817-25 (Nexperia).",
    quantityOnHand: 150,
    reorderMin: 30,
    categoryId: "seed-semiconductors",
    defaultLocationId: "seed-bin-3",
  },
  {
    id: "seed-tme-lm358",
    name: "Amplificator operațional dublu LM358 SO8",
    internalSku: "TME-IC-LM358",
    mpn: "LM358DT",
    manufacturer: "STMICROELECTRONICS",
    description:
      "Dual op-amp rail-to-rail ieșire. În catalog TME: căutați LM358DT.",
    quantityOnHand: 40,
    reorderMin: 8,
    categoryId: "seed-ics",
    defaultLocationId: "seed-shelf-a",
  },
  {
    id: "seed-tme-595",
    name: "Registru de deplasare 74HC595 SO16",
    internalSku: "TME-IC-74HC595",
    mpn: "SN74HC595DR",
    manufacturer: "TEXAS INSTRUMENTS",
    description:
      "8-bit serial-in parallel-out. În catalog TME: căutați SN74HC595DR.",
    quantityOnHand: 35,
    reorderMin: 6,
    categoryId: "seed-ics",
    defaultLocationId: "seed-shelf-a",
  },
  {
    id: "seed-tme-l7805",
    name: "Stabilizator liniar 5V 1A TO-220 L7805",
    internalSku: "TME-REG-L7805",
    mpn: "L7805CV",
    manufacturer: "STMICROELECTRONICS",
    description:
      "Regulator pozitiv fix 5V. În catalog TME: căutați L7805CV.",
    quantityOnHand: 25,
    reorderMin: 5,
    categoryId: "seed-power",
    defaultLocationId: "seed-shelf-a",
  },
  {
    id: "seed-tme-header",
    name: "Header pin 2,54mm 1×40 pini drept",
    internalSku: "TME-CON-HDR-1X40",
    mpn: "PR0010111NB",
    manufacturer: "HARWIN",
    description:
      "Șir pinuri tăiat la lungime. În catalog TME: căutați header 2,54mm Harwin sau echivalent.",
    quantityOnHand: 30,
    reorderMin: 5,
    categoryId: "seed-connectors",
    defaultLocationId: "seed-drawer-tme",
  },
  {
    id: "seed-tme-xtal",
    name: "Cuarț 32,768kHz cilindric 2 pini",
    internalSku: "TME-XTAL-32K",
    mpn: "ABS25-32.768KHZ-T",
    manufacturer: "ABRACON",
    description:
      "Oscilator ceas RTC. În catalog TME: căutați ABS25-32.768KHZ-T.",
    quantityOnHand: 60,
    reorderMin: 10,
    categoryId: "seed-passive-th",
    defaultLocationId: "seed-drawer-tme",
  },
  {
    id: "seed-tme-fuse",
    name: "Siguranță rapidă 5×20mm 1A 250V",
    internalSku: "TME-FUS-1A-5X20",
    mpn: "0217.001MXP",
    manufacturer: "LITTELFUSE",
    description:
      "Siguranță sticlă 5×20. În catalog TME: căutați seria 0217 Littelfuse 1A.",
    quantityOnHand: 20,
    reorderMin: 5,
    categoryId: "seed-passive-th",
    defaultLocationId: "seed-drawer-tme",
  },
];

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "tinel.c@gmail.com").trim().toLowerCase();

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "Warehouse Admin",
      role: Role.ADMIN,
    },
    update: {
      role: Role.ADMIN,
    },
  });

  const resistors = await prisma.category.upsert({
    where: { id: "seed-resistors" },
    create: {
      id: "seed-resistors",
      name: "Rezistoare",
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

  await prisma.category.upsert({
    where: { id: "seed-capacitors" },
    create: { id: "seed-capacitors", name: "Condensatoare" },
    update: {},
  });

  await prisma.category.upsert({
    where: { id: "seed-semiconductors" },
    create: { id: "seed-semiconductors", name: "Semiconductoare" },
    update: {},
  });

  await prisma.category.upsert({
    where: { id: "seed-ics" },
    create: { id: "seed-ics", name: "Circuite integrate" },
    update: {},
  });

  await prisma.category.upsert({
    where: { id: "seed-power" },
    create: { id: "seed-power", name: "Alimentare / regulatoare" },
    update: {},
  });

  await prisma.category.upsert({
    where: { id: "seed-connectors" },
    create: { id: "seed-connectors", name: "Conectori" },
    update: {},
  });

  await prisma.category.upsert({
    where: { id: "seed-passive-th" },
    create: { id: "seed-passive-th", name: "Componente pasive THT" },
    update: {},
  });

  const shelf = await prisma.storageLocation.upsert({
    where: { id: "seed-shelf-a" },
    create: {
      id: "seed-shelf-a",
      name: "Raft A",
    },
    update: {},
  });

  const bin = await prisma.storageLocation.upsert({
    where: { id: "seed-bin-3" },
    create: {
      id: "seed-bin-3",
      name: "Cutie 3",
      parentId: shelf.id,
    },
    update: {},
  });

  await prisma.storageLocation.upsert({
    where: { id: "seed-drawer-tme" },
    create: {
      id: "seed-drawer-tme",
      name: "Sertar TME (mostre)",
      parentId: shelf.id,
    },
    update: {},
  });

  await prisma.category.upsert({
    where: { id: "seed-components-library" },
    create: {
      id: "seed-components-library",
      name: "Bibliotecă Components (import folder)",
    },
    update: {},
  });

  await prisma.storageLocation.upsert({
    where: { id: "seed-components-bin" },
    create: {
      id: "seed-components-bin",
      name: "Components (foldere)",
      parentId: shelf.id,
    },
    update: {},
  });

  let nextPartNumber =
    (await prisma.part.aggregate({ _max: { partNumber: true } }))._max.partNumber ?? 0;

  for (const def of TME_SAMPLE_PARTS) {
    const { id, ...fields } = def;
    const existing = await prisma.part.findUnique({ where: { id } });
    const partNumber = existing?.partNumber ?? ++nextPartNumber;

    await prisma.part.upsert({
      where: { id },
      create: {
        id,
        partNumber,
        name: fields.name,
        internalSku: fields.internalSku,
        mpn: fields.mpn,
        manufacturer: fields.manufacturer,
        description: fields.description,
        quantityOnHand: fields.quantityOnHand,
        reorderMin: fields.reorderMin,
        unit: "pcs",
        categoryId: fields.categoryId,
        defaultLocationId: fields.defaultLocationId,
        imageUrl: fields.imageUrl ?? null,
      },
      update: {
        name: fields.name,
        internalSku: fields.internalSku,
        mpn: fields.mpn,
        manufacturer: fields.manufacturer,
        description: fields.description,
        quantityOnHand: fields.quantityOnHand,
        reorderMin: fields.reorderMin,
        categoryId: fields.categoryId,
        defaultLocationId: fields.defaultLocationId,
        imageUrl: fields.imageUrl ?? null,
      },
    });
  }

  const componentsRoot = path.resolve(process.cwd(), "..", "Components");
  const folderPartsCount = await seedComponentsFromFolder(prisma, componentsRoot);

  console.log(
    `Seed complete: admin (${adminEmail}), categories, locations, ${TME_SAMPLE_PARTS.length} sample parts (TME.eu-style MPNs), ${folderPartsCount} parts from Components/ folder tree.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
