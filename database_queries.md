# 🔍 Database Queries — Iris Café Restaurant Management System

> All queries are written in MongoDB shell syntax (`db.<collection>.<method>`).  
> Mongoose equivalents are shown where applicable.  
> `ObjectId("...")` represents a placeholder for an actual document ID.

---

## 1. Tables

### 1.1 Find an Active Table by Slug (Guest QR Code Scan)

```javascript
// Find table by its URL slug and ensure it's active
db.tables.findOne({
  tableSlug: "TABLE01",
  active: true
});
```

---

### 1.2 Get All Active Tables (Staff Dashboard)

```javascript
// Fetch all active, non-deleted tables sorted by display order
db.tables.find({
  active: true,
  deletedAt: null
}).sort({ sortOrder: 1, label: 1 });
```

---

### 1.3 Soft-Delete a Table

```javascript
// Soft-delete: mark as inactive and stamp deletedAt
db.tables.findOneAndUpdate(
  { _id: ObjectId("...") },
  { $set: { active: false, deletedAt: new Date() } }
);
// The slug is KEPT so layout auto-generation never recreates this table
```

---

### 1.4 Seed Initial Layout (Upsert Tables)

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

## 2. Dining Sessions

### 2.1 Find or Create an Open Dining Session

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

### 2.2 Get All Tables with Session Info (Dashboard)

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

### 2.3 Close a Session (Bill Settled)

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

## 3. Orders

### 3.1 Get Active Draft Order for a Session

```javascript
// Used by both guests and staff to get the cart
db.orders.findOne({
  diningSessionId: ObjectId("..."),
  status: "draft"
});
```

---

### 3.2 Add an Item to an Order (Push to Embedded Array)

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

### 3.3 Place an Order (Update Status)

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

### 3.4 Staff: Get All Active (Non-Draft) Orders

```javascript
// Staff kitchen view — see all submitted orders
db.orders.find({
  status: { $ne: "draft" }
}).sort({ updatedAt: -1 }).limit(100);
```

---

### 3.5 Merge Multiple Orders into One

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

## 4. Menu

### 4.1 Fetch All Menu Items (Grouped by Category)

```javascript
// Get all available categories sorted by display order
db.menucategories.find({}).sort({ sortOrder: 1, name: 1 });

// Get all available menu items
db.menuitems.find({ available: true });
```

---

## 5. Employees

### 5.1 Delete Employee and All Related Records (Cascade)

```javascript
// MongoDB has no built-in cascading deletes — done manually in application
db.employees.findOneAndDelete({ _id: ObjectId("...") });
db.attendances.deleteMany({ employeeId: ObjectId("...") });
db.payrolls.deleteMany({ employeeId: ObjectId("...") });
db.shifts.deleteMany({ employeeId: ObjectId("...") });
```

---

## 6. Attendance

### 6.1 Upsert Attendance Record

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

## 7. Payroll

### 7.1 Upsert Monthly Payroll

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

## 8. Reviews

### 8.1 Get Approved Reviews with Populated Item Names

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

*This document contains all MongoDB queries used across the Iris Café Restaurant Management System, organized by collection/feature area.*
