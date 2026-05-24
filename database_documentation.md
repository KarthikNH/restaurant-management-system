# 🗄️ Database Documentation — Iris Café Restaurant Management System

> **Project Type:** Full-Stack Web Application with NoSQL Database  
> **Database:** MongoDB (via Docker container, port `27017`)  
> **ODM (Object-Document Mapper):** Mongoose v8  
> **Backend:** Node.js + Express + TypeScript

---

## 1. Overview

This project uses **MongoDB**, a document-oriented NoSQL database, to store and manage all restaurant data. MongoDB stores data as **BSON (Binary JSON) documents** grouped into **collections** — which are roughly equivalent to tables in SQL.

The application connects to MongoDB through **Mongoose**, which provides schema validation, type safety, and a rich query API on top of MongoDB's native driver.

```
┌─────────────────────────┐
│    React Frontend (Web) │
└────────────┬────────────┘
             │ HTTP (REST API)
┌────────────▼────────────┐
│  Express + TypeScript   │  ← apps/api/
│  (REST API Server)      │
└────────────┬────────────┘
             │ Mongoose ODM
┌────────────▼────────────┐
│       MongoDB           │  ← docker/docker-compose.yml
│   (port 27017, Docker)  │
└─────────────────────────┘
```

---

## 2. Database Connection

**File:** `apps/api/src/db/connection.ts`

```typescript
import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDb() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
}
```

- Connection URI is read from the `.env` file as `MONGODB_URI`
- Default value: `mongodb://localhost:27017/iris_cafe`
- `strictQuery: true` ensures only schema-defined fields are used in queries

**Docker Setup:** `docker/docker-compose.yml`

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
```

Data is persisted using a Docker named volume (`mongo_data`), so it survives container restarts.

---

## 3. Collections (Schemas)

The database has **12 collections**, each corresponding to a Mongoose model:

| Collection       | Mongoose Model   | Purpose                                      |
|-----------------|-----------------|----------------------------------------------|
| `users`          | `User`           | Staff login accounts (admin / staff roles)   |
| `employees`      | `Employee`       | HR records for all café employees            |
| `tables`         | `Table`          | Physical dining tables in the restaurant     |
| `diningsessions` | `DiningSession`  | Active guest seatings per table              |
| `orders`         | `Order`          | Food/drink orders placed during a session    |
| `menucategories` | `MenuCategory`   | Menu section groups (e.g., Coffee, Desserts) |
| `menuitems`      | `MenuItem`       | Individual menu items with prices            |
| `inventoryitems` | `InventoryItem`  | Kitchen stock / ingredient quantities        |
| `attendances`    | `Attendance`     | Daily employee check-in / check-out logs     |
| `payrolls`       | `Payroll`        | Monthly salary, bonus, and deduction records |
| `shifts`         | `Shift`          | Employee shift schedules                     |
| `reviews`        | `Review`         | Guest feedback and menu item ratings         |

---

## 4. Schema Definitions

### 4.1 User

> Stores login credentials for staff members.

```typescript
{
  email:        String,   // unique, indexed — used for login
  passwordHash: String,   // bcrypt hashed password
  role:         String,   // enum: "admin" | "staff"
  createdAt:    Date,     // auto-managed by Mongoose timestamps
  updatedAt:    Date
}
```

**Seed credentials:**
- Admin: `admin@demo.local` / `admin123`
- Staff: `waiter@demo.local` / `waiter123`

---

### 4.2 Employee

> HR record for each café employee (separate from login accounts).

```typescript
{
  name:          String,  // employee full name
  email:         String,  // unique contact email
  role:          String,  // e.g., "Manager", "Chef", "Server", "Cleaner"
  phone:         String,
  status:        String,  // enum: "active" | "inactive"
  dateOfJoining: Date,    // defaults to current date
  baseSalary:    Number,  // monthly salary in INR (paise)
  createdAt:     Date,
  updatedAt:     Date
}
```

---

### 4.3 Table

> Represents a physical dining table in the restaurant.

```typescript
{
  label:        String,   // display name, e.g., "Table 1"
  tableSlug:    String,   // unique URL-safe identifier, e.g., "TABLE01" — indexed
  active:       Boolean,  // false = hidden from floor view
  seatCapacity: Number,   // max guests (1–99), default: 4
  sortOrder:    Number,   // controls display order on the floor grid
  deletedAt:    Date,     // null = alive; a Date = soft-deleted
  createdAt:    Date,
  updatedAt:    Date
}
```

**Indexes:**
- `tableSlug` — unique index for fast QR-code lookup
- Compound index on `{ sortOrder: 1, label: 1 }` for sorted listing

> ⚠️ Tables use **soft-delete**: setting `deletedAt` to a date instead of removing the document. This preserves the slug so layout generation never accidentally recreates a deleted table.

---

### 4.4 DiningSession

> Represents one group of guests seated at a table for a meal.

```typescript
{
  tableId:   ObjectId,  // → references Table._id
  status:    String,    // enum: "open" | "closed"
  partySize: Number,    // number of guests (0–200)
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ tableId: 1, status: 1 }` — compound index for looking up a table's active session
- **Partial unique index:** `{ tableId: 1 }` where `status = "open"` — enforces that **only one open session exists per table** at any time

---

### 4.5 Order

> A food/drink order placed during a dining session. Contains embedded order lines.

```typescript
{
  diningSessionId: ObjectId,  // → references DiningSession._id (indexed)
  status:          String,    // enum: "draft" | "placed" | "confirmed" | "closed"
  lines: [                    // embedded sub-documents (OrderLine)
    {
      menuItemId:    ObjectId,  // → references MenuItem._id
      name:          String,    // snapshot of item name at order time
      unitPriceCents: Number,   // snapshot of price in paise
      quantity:      Number,    // min: 1
      note:          String     // special instructions
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

> 📝 **Design Decision:** Item `name` and `unitPriceCents` are **denormalized** (copied) into each order line. This is intentional — it preserves the exact price and name at the time of ordering, even if the menu item is later edited.

**Order Status Lifecycle:**
```
draft → placed → confirmed → closed
```
- `draft`: Guest is still building the cart
- `placed`: Guest submitted the order (kitchen can see it)
- `confirmed`: Kitchen acknowledged the order
- `closed`: Bill settled, session ended

---

### 4.6 MenuCategory

> Groups menu items into sections.

```typescript
{
  name:      String,  // e.g., "Signature Coffee", "Desserts"
  sortOrder: Number,  // controls display order in the menu
  createdAt: Date,
  updatedAt: Date
}
```

---

### 4.7 MenuItem

> An individual item available to order from the menu.

```typescript
{
  name:        String,    // e.g., "Caramel Macchiato"
  description: String,    // optional item description
  priceCents:  Number,    // price in paise (₹100 = 10000 paise), min: 0
  available:   Boolean,   // false = hidden from guest menu
  dietType:    String,    // enum: "veg" | "egg" | "non-veg"
  categoryId:  ObjectId,  // → references MenuCategory._id
  createdAt:   Date,
  updatedAt:   Date
}
```

---

### 4.8 InventoryItem

> Tracks kitchen stock levels and alerts for low inventory.

```typescript
{
  name:             String,  // e.g., "Coffee Beans"
  category:         String,  // e.g., "Coffee", "Breakfast"
  unit:             String,  // e.g., "Kg", "Liters", "Packets"
  quantity:         Number,  // current stock level
  minimumThreshold: Number,  // low-stock alert threshold
  status:           String,  // enum: "healthy" | "spoiled"
  createdAt:        Date,
  updatedAt:        Date
}
```

---

### 4.9 Attendance

> Daily attendance log for each employee.

```typescript
{
  employeeId:   ObjectId,  // → references Employee._id
  date:         String,    // format: "YYYY-MM-DD"
  status:       String,    // enum: "present" | "absent" | "leave"
  checkInTime:  String,    // e.g., "09:00 AM"
  checkOutTime: String,    // e.g., "06:00 PM"
  createdAt:    Date,
  updatedAt:    Date
}
```

---

### 4.10 Payroll

> Monthly salary disbursement record for each employee.

```typescript
{
  employeeId:    ObjectId,  // → references Employee._id
  month:         String,    // format: "YYYY-MM" (e.g., "2026-05")
  baseSalaryPaid: Number,   // base salary for the month
  bonus:         Number,    // additional bonus
  deductions:    Number,    // penalty / absence deductions
  netPaid:       Number,    // baseSalaryPaid + bonus - deductions
  status:        String,    // enum: "pending" | "paid"
  paymentDate:   Date,      // date when payment was processed
  createdAt:     Date,
  updatedAt:     Date
}
```

---

### 4.11 Shift

> Stores the scheduled shift for an employee on a given date.

```typescript
{
  employeeId: ObjectId,  // → references Employee._id
  date:       String,    // format: "YYYY-MM-DD"
  shiftType:  String,    // enum: "morning" | "evening" | "night"
  startTime:  String,    // e.g., "08:00 AM"
  endTime:    String,    // e.g., "04:00 PM"
  notes:      String,    // optional notes for the shift
  createdAt:  Date,
  updatedAt:  Date
}
```

---

### 4.12 Review

> Guest reviews and ratings for their dining experience and menu items.

```typescript
{
  reviewerName:  String,  // defaults to "Anonymous"
  overallRating: Number,  // 1–5 stars
  comment:       String,
  feedbackType:  String,  // enum: "comment" | "suggestion" | "complaint"
  menuItemReviews: [      // embedded sub-documents
    {
      menuItemId: ObjectId,  // → references MenuItem._id
      rating:     Number     // 1–5 stars for a specific dish
    }
  ],
  status:    String,  // enum: "pending" | "approved" | "rejected"
  createdAt: Date,
  updatedAt: Date
}
```

> Reviews require staff moderation — they start as `"pending"` and must be `"approved"` before guests can see them.

---

## 5. Entity Relationship Diagram (ERD)

```
┌──────────────┐         ┌───────────────────┐        ┌─────────────┐
│    Table     │ 1 ───── │   DiningSession   │ 1 ──── │    Order    │
│              │         │  tableId (FK)     │  ────∞ │diningSession│
│  tableSlug   │         │  status: open/    │        │ Id (FK)     │
│  label       │         │  closed           │        │ status      │
│  seatCapacity│         │  partySize        │        │ lines[]     │
└──────────────┘         └───────────────────┘        └──────┬──────┘
                                                             │
                                                    menuItemId (FK)
                                                             │
┌──────────────┐         ┌───────────────┐         ┌────────▼──────┐
│ MenuCategory │ 1 ─── ∞ │   MenuItem    │         │  OrderLine    │
│              │         │ categoryId(FK)│         │  (embedded)   │
│  name        │         │  name         │         │  name (copy)  │
│  sortOrder   │         │  priceCents   │         │  priceCents   │
└──────────────┘         │  dietType     │         │  (copy)       │
                         │  available    │         └───────────────┘
                         └──────────────┘

┌──────────────┐
│   Employee   │ ─── 1:∞ ──► Attendance  (employeeId FK)
│              │ ─── 1:∞ ──► Payroll     (employeeId FK)
│  name        │ ─── 1:∞ ──► Shift       (employeeId FK)
│  role        │
│  baseSalary  │
└──────────────┘

┌──────────────┐
│    Review    │ ─── ∞:∞ ──► MenuItem (via menuItemReviews[].menuItemId FK)
│              │
│ overallRating│
│ feedbackType │
│ status       │
└──────────────┘

┌──────────────┐
│InventoryItem │  (standalone — no FK relationships)
└──────────────┘

┌──────────────┐
│     User     │  (standalone — staff login accounts)
└──────────────┘
```

**Key Relationships:**
| Relationship | Type | Description |
|---|---|---|
| Table → DiningSession | One-to-One (enforced) | One open session per table at a time |
| DiningSession → Order | One-to-Many | Multiple orders per dining session |
| MenuCategory → MenuItem | One-to-Many | Items belong to one category |
| MenuItem → OrderLine | Referenced | OrderLine snapshots item data |
| Employee → Attendance | One-to-Many | Many attendance records per employee |
| Employee → Payroll | One-to-Many | Monthly payroll per employee |
| Employee → Shift | One-to-Many | Many shifts per employee |
| MenuItem → Review | Many-to-Many (embedded) | Reviews can rate multiple items |

---

## 6. Key Queries Used in the Application

### 6.1 Find an Active Table by Slug (Guest QR Code Scan)

```javascript
// Find table by its URL slug and ensure it's active
db.tables.findOne({
  tableSlug: "TABLE01",
  active: true
});
```

---

### 6.2 Find or Create an Open Dining Session

```javascript
// Check if a table already has an open session
db.diningsessions.findOne({
  tableId: ObjectId("..."),
  status: "open"
});

// Create a new session if none exists
db.diningsessions.insertOne({
  tableId: ObjectId("..."),
  status: "open",
  partySize: 4
});
```

---

### 6.3 Get Active Draft Order for a Session

```javascript
// Used by both guests and staff to get the cart
db.orders.findOne({
  diningSessionId: ObjectId("..."),
  status: "draft"
});
```

---

### 6.4 Fetch All Menu Items (Grouped by Category)

```javascript
// Get all available categories sorted by display order
db.menucategories.find({}).sort({ sortOrder: 1, name: 1 });

// Get all available menu items
db.menuitems.find({ available: true });
```

---

### 6.5 Add an Item to an Order (Push to Embedded Array)

```javascript
// Mongoose $push equivalent — add an order line to the lines array
db.orders.updateOne(
  { _id: ObjectId("..."), status: "draft" },
  {
    $push: {
      lines: {
        _id: new ObjectId(),
        menuItemId: ObjectId("..."),
        name: "Caramel Macchiato",
        unitPriceCents: 18900,
        quantity: 2,
        note: "Less sugar"
      }
    }
  }
);
```

---

### 6.6 Place an Order (Update Status)

```javascript
// Guest confirms cart — move from "draft" to "placed"
db.orders.updateOne(
  { _id: ObjectId("...") },
  { $set: { status: "placed" } }
);

// Create a fresh draft for future orders in the same session
db.orders.insertOne({
  diningSessionId: ObjectId("..."),
  status: "draft",
  lines: []
});
```

---

### 6.7 Staff: Get All Active (Non-Draft) Orders

```javascript
// Staff kitchen view — see all submitted orders
db.orders.find({
  status: { $ne: "draft" }
}).sort({ updatedAt: -1 }).limit(100);
```

---

### 6.8 Staff: Get All Tables with Session Info (Dashboard)

```javascript
// Step 1: Fetch all active tables
const tables = db.tables.find({
  active: true,
  deletedAt: null
}).sort({ sortOrder: 1, label: 1 });

// Step 2: Fetch open sessions for those tables
const tableIds = tables.map(t => t._id);
db.diningsessions.find({
  tableId: { $in: tableIds },
  status: "open"
});
// Then merge in application code to show occupied/vacant status
```

---

### 6.9 Close a Session (Bill Settled)

```javascript
// Close the dining session
db.diningsessions.findOneAndUpdate(
  { _id: ObjectId("...") },
  { $set: { status: "closed", partySize: 0 } }
);

// Close all pending orders for the session
db.orders.updateMany(
  {
    diningSessionId: ObjectId("..."),
    status: { $ne: "closed" }
  },
  { $set: { status: "closed" } }
);
```

---

### 6.10 Soft-Delete a Table

```javascript
// Soft-delete: mark as inactive and stamp deletedAt
db.tables.findOneAndUpdate(
  { _id: ObjectId("...") },
  { $set: { active: false, deletedAt: new Date() } }
);
// The slug is KEPT so layout auto-generation never recreates this table
```

---

### 6.11 Upsert Attendance Record

```javascript
// Upsert: insert if not exists, update if already logged
db.attendances.findOneAndUpdate(
  { employeeId: ObjectId("..."), date: "2026-05-24" },
  {
    $set: {
      status: "present",
      checkInTime: "09:00 AM",
      checkOutTime: "06:00 PM"
    }
  },
  { upsert: true, new: true }
);
```

---

### 6.12 Upsert Monthly Payroll

```javascript
// Calculate net pay and upsert payroll record for a month
db.payrolls.findOneAndUpdate(
  { employeeId: ObjectId("..."), month: "2026-05" },
  {
    $set: {
      baseSalaryPaid: 30000,
      bonus: 2000,
      deductions: 500,
      netPaid: 31500,       // baseSalaryPaid + bonus - deductions
      status: "paid",
      paymentDate: new Date()
    }
  },
  { upsert: true, new: true }
);
```

---

### 6.13 Get Approved Reviews with Populated Item Names

```javascript
// Fetch approved reviews and populate menu item names
db.reviews.aggregate([
  { $match: { status: "approved" } },
  { $sort: { createdAt: -1 } },
  {
    $lookup: {
      from: "menuitems",
      localField: "menuItemReviews.menuItemId",
      foreignField: "_id",
      as: "itemDetails"
    }
  }
]);

// Mongoose equivalent (used in the code):
Review.find({ status: "approved" })
  .sort({ createdAt: -1 })
  .populate("menuItemReviews.menuItemId", "name");
```

---

### 6.14 Delete Employee and All Related Records (Cascade)

```javascript
// MongoDB has no built-in cascading deletes — done manually in application
db.employees.findOneAndDelete({ _id: ObjectId("...") });
db.attendances.deleteMany({ employeeId: ObjectId("...") });
db.payrolls.deleteMany({ employeeId: ObjectId("...") });
db.shifts.deleteMany({ employeeId: ObjectId("...") });
```

---

### 6.15 Merge Multiple Orders into One

```javascript
// Find all target orders
const orders = db.orders.find({ _id: { $in: [id1, id2, id3] } });

// Merge lines in application logic (deduplication by menuItemId + price)
// Then update primary order:
db.orders.updateOne(
  { _id: primaryOrderId },
  { $set: { lines: mergedLines } }
);

// Delete the secondary orders
db.orders.deleteMany({ _id: { $in: [id2, id3] } });
```

---

### 6.16 Seed Initial Layout (Upsert Tables)

```javascript
// Idempotent table seeding — safe to run multiple times
for (let i = 1; i <= 10; i++) {
  db.tables.findOneAndUpdate(
    { tableSlug: `TABLE${String(i).padStart(2, "0")}` },
    {
      $set: {
        label: `Table ${i}`,
        seatCapacity: 4,
        sortOrder: i,
        active: true
      }
    },
    { upsert: true }
  );
}
```

---

## 7. Database Design Principles

### 7.1 Document Embedding vs. Referencing

| Approach | Used For | Reason |
|---|---|---|
| **Embedding** | `Order.lines` (OrderLine sub-docs) | Lines are always accessed with the order; embedding avoids extra queries |
| **Embedding** | `Review.menuItemReviews` | Item reviews are always read with their parent review |
| **Referencing** | `DiningSession.tableId → Table` | Tables are long-lived, reused across many sessions |
| **Referencing** | `Order.diningSessionId → DiningSession` | Sessions are tracked separately with their own lifecycle |
| **Referencing** | `MenuItem.categoryId → MenuCategory` | Categories are updated independently |
| **Referencing** | `Attendance/Payroll/Shift.employeeId → Employee` | Employee is the central HR entity |

### 7.2 Denormalization for Historical Accuracy

`OrderLine` stores a **snapshot** of `name` and `unitPriceCents` at the time of ordering. This means:
- Changing a menu item's price won't alter past orders
- Deleting a menu item won't break order history

### 7.3 Soft Deletes (Tables)

Tables are never hard-deleted. Instead, `deletedAt` is set to the deletion timestamp and `active` is set to `false`. This ensures:
- The `tableSlug` remains reserved
- Bulk layout generation (`POST /staff/tables/layout`) won't accidentally recreate deleted tables

### 7.4 Partial Unique Index (DiningSession)

```javascript
diningSessionSchema.index(
  { tableId: 1 },
  { unique: true, partialFilterExpression: { status: "open" } }
);
```
This enforces a **database-level constraint**: only one `open` session per table. Closed sessions are excluded from the uniqueness check, so historical records are preserved.

### 7.5 Idempotent Seeding with `upsert`

All seed and layout operations use `findOneAndUpdate` with `upsert: true`. This means running the seed script multiple times is safe — it won't create duplicate data.

---

## 8. Indexes Summary

| Collection | Index | Type | Purpose |
|---|---|---|---|
| `users` | `email` | Unique | Fast login lookup |
| `tables` | `tableSlug` | Unique | Fast QR-code table lookup |
| `tables` | `{ sortOrder, label }` | Compound | Sorted floor grid display |
| `diningsessions` | `{ tableId, status }` | Compound | Active session lookup |
| `diningsessions` | `{ tableId }` where status=open | Partial Unique | One open session per table |
| `orders` | `diningSessionId` | Standard | Orders per session lookup |

---

## 9. Technology Stack Summary

| Layer | Technology | Role |
|---|---|---|
| Database | MongoDB 7 (Docker) | Document storage |
| ODM | Mongoose 8 | Schema, validation, queries |
| Backend Runtime | Node.js + TypeScript | API server logic |
| API Framework | Express.js | REST endpoint routing |
| Auth | JWT (jsonwebtoken) + bcryptjs | Session tokens + password hashing |
| Validation | Zod | Request body schema validation |
| Frontend | React + TypeScript (Vite) | Staff dashboard & guest ordering UI |
| Containerization | Docker + Docker Compose | MongoDB hosting |

---

*This document covers all 12 collections, their schemas, inter-collection relationships, key indexes, and the major database queries powering the Iris Café Restaurant Management System.*
