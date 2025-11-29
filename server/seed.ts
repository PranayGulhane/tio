import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...");

  // Check if company owner already exists
  const [existingOwner] = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@stylemirror.com"));

  if (existingOwner) {
    console.log("✅ Company owner already exists, skipping seed");
    return;
  }

  // Create company owner
  const hashedPassword = await bcrypt.hash("admin123", 10);

  await db.insert(users).values({
    email: "admin@stylemirror.com",
    password: hashedPassword,
    role: "company_owner",
    mustResetPassword: false,
    isActive: true,
  });

  console.log("✅ Created company owner account:");
  console.log("   Email: admin@stylemirror.com");
  console.log("   Password: admin123");
  console.log("");
  console.log("🎉 Seed complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
