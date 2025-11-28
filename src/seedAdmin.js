import dotenv from "dotenv";

// Load parent .env (server/.env)
dotenv.config({ path: "../.env" });

import connectDB from "./config/db.js";
import User from "./models/User.js";

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = process.env.ADMIN_EMAIL || "admin@assets.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      console.log("Admin already exists:", adminEmail);
      process.exit(0);
    }

    await User.create({
      name: "Super Admin",
      email: adminEmail,
      password: adminPassword,
      role: "admin",
    });

    console.log("Admin created successfully!");
    console.log("Email:", adminEmail);
    console.log("Password:", adminPassword);

    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err.message);
    process.exit(1);
  }
};

seedAdmin();
