import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MenuCategory, type MenuCategoryDoc } from "../models/MenuCategory.js";
import { MenuItem } from "../models/MenuItem.js";
import { Table as RtTable, type TableDoc } from "../models/Table.js";
import { User } from "../models/User.js";
import { InventoryItem } from "../models/InventoryItem.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

async function run() {
  await mongoose.connect(uri!);

  const email = "admin@demo.local";
  const password = "admin123";
  const hash = await bcrypt.hash(password, 10);
  await User.findOneAndUpdate(
    { email },
    { email, passwordHash: hash, role: "admin" },
    { upsert: true },
  );

  const tableCount = 10;
  const seatsEach = 4;
  for (let i = 1; i <= tableCount; i++) {
    const label = `Table ${i}`;
    const tableSlug = `TABLE${String(i).padStart(2, "0")}`;
    await RtTable.findOneAndUpdate(
      { tableSlug },
      {
        $set: {
          label,
          seatCapacity: seatsEach,
          sortOrder: i,
          active: true,
        },
      },
      { upsert: true },
    );
  }
  await RtTable.updateMany(
    { tableSlug: { $regex: /^TABLE\d{2}$/ }, sortOrder: { $gt: tableCount } },
    { $set: { active: false } },
  );

  const cats = [
    { name: "Breakfast Specials", sortOrder: 1 },
    { name: "Signature Coffee", sortOrder: 2 },
    { name: "Refreshers & Shakes", sortOrder: 3 },
    { name: "Sandwiches & Burgers", sortOrder: 4 },
    { name: "Café Favorites", sortOrder: 5 },
    { name: "Desserts", sortOrder: 6 },
  ];
  const byName = new Map<string, { _id: mongoose.Types.ObjectId }>();
  for (const c of cats) {
    const doc = (await MenuCategory.findOneAndUpdate(
      { name: c.name },
      { $set: { name: c.name, sortOrder: c.sortOrder } },
      { upsert: true, new: true },
    ).lean()) as MenuCategoryDoc | null;
    if (doc?._id) byName.set(c.name, { _id: doc._id });
  }

  const breakfast = byName.get("Breakfast Specials")!;
  const coffee = byName.get("Signature Coffee")!;
  const refreshers = byName.get("Refreshers & Shakes")!;
  const sandwiches = byName.get("Sandwiches & Burgers")!;
  const cafeFavs = byName.get("Café Favorites")!;
  const desserts = byName.get("Desserts")!;

  await MenuItem.deleteMany({});
  await MenuItem.insertMany([
    // Breakfast Specials
    { categoryId: breakfast._id, name: "Classic Pancake Stack", description: "Fluffy pancakes with maple syrup & butter", priceCents: 18900, available: true },
    { categoryId: breakfast._id, name: "Veggie Omelette Toast", description: "Cheese omelette with toasted sourdough", priceCents: 21900, available: true },
    { categoryId: breakfast._id, name: "Avocado Toast", description: "Avocado spread with cherry tomatoes & herbs", priceCents: 24900, available: true },
    { categoryId: breakfast._id, name: "English Breakfast", description: "Eggs, sausages, beans & toast", priceCents: 32900, available: true },
    // Signature Coffee
    { categoryId: coffee._id, name: "Espresso", description: "Single / Double", priceCents: 9900, available: true },
    { categoryId: coffee._id, name: "Cappuccino", description: "Regular / Large", priceCents: 14900, available: true },
    { categoryId: coffee._id, name: "Café Latte", description: "Regular / Large", priceCents: 15900, available: true },
    { categoryId: coffee._id, name: "Caramel Macchiato", description: "Regular / Large", priceCents: 18900, available: true },
    { categoryId: coffee._id, name: "Mocha Delight", description: "Regular / Large", priceCents: 19900, available: true },
    { categoryId: coffee._id, name: "Cold Brew", description: "Glass", priceCents: 21900, available: true },
    // Refreshers & Shakes
    { categoryId: refreshers._id, name: "Iced Americano", description: "", priceCents: 14900, available: true },
    { categoryId: refreshers._id, name: "Strawberry Milkshake", description: "", priceCents: 19900, available: true },
    { categoryId: refreshers._id, name: "Chocolate Oreo Shake", description: "", priceCents: 22900, available: true },
    { categoryId: refreshers._id, name: "Mango Smoothie", description: "", priceCents: 20900, available: true },
    { categoryId: refreshers._id, name: "Lemon Mint Cooler", description: "", priceCents: 13900, available: true },
    { categoryId: refreshers._id, name: "Water", description: "Bottled Water", priceCents: 3000, available: true },
    // Sandwiches & Burgers
    { categoryId: sandwiches._id, name: "Grilled Veg Sandwich", description: "Cheese, veggies & pesto", priceCents: 19900, available: true },
    { categoryId: sandwiches._id, name: "Chicken Club Sandwich", description: "Chicken, lettuce & mayo", priceCents: 27900, available: true },
    { categoryId: sandwiches._id, name: "Crispy Paneer Burger", description: "Paneer patty with spicy sauce", priceCents: 24900, available: true },
    { categoryId: sandwiches._id, name: "Classic Chicken Burger", description: "Crispy chicken with fries", priceCents: 31900, available: true },
    // Café Favorites
    { categoryId: cafeFavs._id, name: "White Sauce Pasta", description: "", priceCents: 28900, available: true },
    { categoryId: cafeFavs._id, name: "Spicy Arrabbiata Pasta", description: "", priceCents: 27900, available: true },
    { categoryId: cafeFavs._id, name: "Margherita Pizza", description: "", priceCents: 34900, available: true },
    { categoryId: cafeFavs._id, name: "Farmhouse Pizza", description: "", priceCents: 42900, available: true },
    { categoryId: cafeFavs._id, name: "Loaded French Fries", description: "", priceCents: 18900, available: true },
    // Desserts
    { categoryId: desserts._id, name: "Chocolate Brownie", description: "", priceCents: 14900, available: true },
    { categoryId: desserts._id, name: "New York Cheesecake", description: "", priceCents: 22900, available: true },
    { categoryId: desserts._id, name: "Red Velvet Pastry", description: "", priceCents: 17900, available: true },
    { categoryId: desserts._id, name: "Tiramisu Cup", description: "", priceCents: 24900, available: true },
  ]);

  await InventoryItem.deleteMany({});
  await InventoryItem.insertMany([
    // Coffee Ingredients
    { name: "Coffee Beans", category: "Coffee", unit: "Kg", quantity: 25, minimumThreshold: 5 },
    { name: "Milk", category: "Coffee", unit: "Liters", quantity: 50, minimumThreshold: 10 },
    { name: "Fresh Cream", category: "Coffee", unit: "Liters", quantity: 15, minimumThreshold: 3 },
    { name: "Chocolate Syrup", category: "Coffee", unit: "Bottles", quantity: 10, minimumThreshold: 2 },
    { name: "Caramel Syrup", category: "Coffee", unit: "Bottles", quantity: 8, minimumThreshold: 2 },
    { name: "Sugar", category: "Coffee", unit: "Kg", quantity: 30, minimumThreshold: 5 },
    { name: "Ice Cubes", category: "Coffee", unit: "Bags", quantity: 20, minimumThreshold: 4 },
    { name: "Cocoa Powder", category: "Coffee", unit: "Kg", quantity: 5, minimumThreshold: 1 },
    { name: "Vanilla Syrup", category: "Coffee", unit: "Bottles", quantity: 6, minimumThreshold: 2 },

    // Breakfast Ingredients
    { name: "Eggs", category: "Breakfast", unit: "Dozens", quantity: 15, minimumThreshold: 3 },
    { name: "Bread", category: "Breakfast", unit: "Packets", quantity: 25, minimumThreshold: 5 },
    { name: "Butter", category: "Breakfast", unit: "Kg", quantity: 10, minimumThreshold: 2 },
    { name: "Maple Syrup", category: "Breakfast", unit: "Bottles", quantity: 12, minimumThreshold: 3 },
    { name: "Pancake Mix / Flour", category: "Breakfast", unit: "Kg", quantity: 15, minimumThreshold: 3 },
    { name: "Cheese", category: "Breakfast", unit: "Kg", quantity: 12, minimumThreshold: 2 },
    { name: "Sausages", category: "Breakfast", unit: "Packets", quantity: 20, minimumThreshold: 4 },
    { name: "Baked Beans", category: "Breakfast", unit: "Cans", quantity: 30, minimumThreshold: 5 },
    { name: "Avocado", category: "Breakfast", unit: "Kg", quantity: 8, minimumThreshold: 2 },
    { name: "Cherry Tomatoes", category: "Breakfast", unit: "Kg", quantity: 6, minimumThreshold: 1.5 },
    { name: "Herbs", category: "Breakfast", unit: "Packets", quantity: 15, minimumThreshold: 3 },
    { name: "Black Pepper", category: "Breakfast", unit: "Kg", quantity: 3, minimumThreshold: 0.5 },

    // Sandwich & Burger Ingredients
    { name: "Burger Buns", category: "Sandwich & Burger", unit: "Packets", quantity: 30, minimumThreshold: 6 },
    { name: "Paneer", category: "Sandwich & Burger", unit: "Kg", quantity: 10, minimumThreshold: 2 },
    { name: "Chicken Breast", category: "Sandwich & Burger", unit: "Kg", quantity: 18, minimumThreshold: 4 },
    { name: "Lettuce", category: "Sandwich & Burger", unit: "Kg", quantity: 8, minimumThreshold: 2 },
    { name: "Tomato", category: "Sandwich & Burger", unit: "Kg", quantity: 15, minimumThreshold: 3 },
    { name: "Onion", category: "Sandwich & Burger", unit: "Kg", quantity: 20, minimumThreshold: 4 },
    { name: "Mayonnaise", category: "Sandwich & Burger", unit: "Bottles", quantity: 10, minimumThreshold: 2 },
    { name: "Pesto Sauce", category: "Sandwich & Burger", unit: "Jars", quantity: 8, minimumThreshold: 2 },
    { name: "Cheese Slices", category: "Sandwich & Burger", unit: "Packets", quantity: 15, minimumThreshold: 3 },
    { name: "Burger Patty", category: "Sandwich & Burger", unit: "Packets", quantity: 20, minimumThreshold: 4 },
    { name: "Oil", category: "Sandwich & Burger", unit: "Liters", quantity: 25, minimumThreshold: 5 },
    { name: "French Fries", category: "Sandwich & Burger", unit: "Kg", quantity: 30, minimumThreshold: 6 },

    // Pasta & Pizza Ingredients
    { name: "Pasta", category: "Pasta & Pizza", unit: "Kg", quantity: 20, minimumThreshold: 4 },
    { name: "Pizza Base", category: "Pasta & Pizza", unit: "Packets", quantity: 25, minimumThreshold: 5 },
    { name: "Mozzarella Cheese", category: "Pasta & Pizza", unit: "Kg", quantity: 15, minimumThreshold: 3 },
    { name: "Tomato Sauce", category: "Pasta & Pizza", unit: "Liters", quantity: 15, minimumThreshold: 3 },
    { name: "White Sauce", category: "Pasta & Pizza", unit: "Liters", quantity: 10, minimumThreshold: 2 },
    { name: "Garlic", category: "Pasta & Pizza", unit: "Kg", quantity: 5, minimumThreshold: 1 },
    { name: "Olive Oil", category: "Pasta & Pizza", unit: "Liters", quantity: 12, minimumThreshold: 2.5 },
    { name: "Oregano", category: "Pasta & Pizza", unit: "Packets", quantity: 15, minimumThreshold: 3 },
    { name: "Chili Flakes", category: "Pasta & Pizza", unit: "Packets", quantity: 15, minimumThreshold: 3 },
    { name: "Capsicum", category: "Pasta & Pizza", unit: "Kg", quantity: 10, minimumThreshold: 2 },
    { name: "Mushrooms", category: "Pasta & Pizza", unit: "Kg", quantity: 8, minimumThreshold: 2 },
    { name: "Sweet Corn", category: "Pasta & Pizza", unit: "Kg", quantity: 10, minimumThreshold: 2 },

    // Shakes & Refreshers Ingredients
    { name: "Strawberries", category: "Shakes & Refreshers", unit: "Kg", quantity: 8, minimumThreshold: 2 },
    { name: "Mangoes", category: "Shakes & Refreshers", unit: "Kg", quantity: 12, minimumThreshold: 3 },
    { name: "Oreo Biscuits", category: "Shakes & Refreshers", unit: "Packets", quantity: 15, minimumThreshold: 3 },
    { name: "Ice Cream", category: "Shakes & Refreshers", unit: "Liters", quantity: 20, minimumThreshold: 4 },
    { name: "Mint Leaves", category: "Shakes & Refreshers", unit: "Packets", quantity: 10, minimumThreshold: 2 },
    { name: "Lemon", category: "Shakes & Refreshers", unit: "Units", quantity: 50, minimumThreshold: 10 },
    { name: "Soda", category: "Shakes & Refreshers", unit: "Liters", quantity: 30, minimumThreshold: 6 },
    { name: "Chocolate Ice Cream", category: "Shakes & Refreshers", unit: "Liters", quantity: 15, minimumThreshold: 3 },

    // Dessert Ingredients
    { name: "Brownie Mix", category: "Dessert", unit: "Kg", quantity: 10, minimumThreshold: 2 },
    { name: "Cream Cheese", category: "Dessert", unit: "Kg", quantity: 8, minimumThreshold: 2 },
    { name: "Whipping Cream", category: "Dessert", unit: "Liters", quantity: 12, minimumThreshold: 3 },
    { name: "Red Velvet Cake Base", category: "Dessert", unit: "Units", quantity: 10, minimumThreshold: 2 },
    { name: "Mascarpone Cheese", category: "Dessert", unit: "Kg", quantity: 6, minimumThreshold: 1.5 },
    { name: "Coffee Powder", category: "Dessert", unit: "Kg", quantity: 4, minimumThreshold: 1 },
  ]);

  const t1 = (await RtTable.findOne({ tableSlug: "TABLE01" }).lean()) as TableDoc | null;

  console.log("Seed complete.");
  console.log(`Staff: ${email} / ${password}`);
  console.log(`Tables: ${tableCount} × ${seatsEach} seats (slugs TABLE01–TABLE10)`);
  console.log(`Example guest URL slug: ${t1?.tableSlug ?? "TABLE01"}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
