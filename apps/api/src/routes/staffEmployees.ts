import type { Request, Response } from "express";
import { z } from "zod";
import { Employee } from "../models/Employee.js";
import { Attendance } from "../models/Attendance.js";
import { Payroll } from "../models/Payroll.js";
import { Shift } from "../models/Shift.js";
import type { Router } from "express";
import { Router as createRouter } from "express";
import { requireStaff, requireAdmin } from "../middleware/staffAuth.js";

const employeeBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  phone: z.string().min(1),
  baseSalary: z.number().min(0),
  status: z.enum(["active", "inactive"]).optional(),
});

const attendanceBody = z.object({
  employeeId: z.string(),
  date: z.string(), // YYYY-MM-DD
  status: z.enum(["present", "absent", "leave"]),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
});

const payrollBody = z.object({
  employeeId: z.string(),
  month: z.string(), // YYYY-MM
  baseSalaryPaid: z.number(),
  bonus: z.number().optional(),
  deductions: z.number().optional(),
  status: z.enum(["pending", "paid"]).optional(),
});

const shiftBody = z.object({
  employeeId: z.string(),
  date: z.string(), // YYYY-MM-DD
  shiftType: z.enum(["morning", "evening", "night"]),
  startTime: z.string(),
  endTime: z.string(),
  notes: z.string().optional(),
});

export function staffEmployeesRouter(): Router {
  const r = createRouter();
  r.use(requireStaff);
  r.use(requireAdmin);

  // --- Employees CRUD ---
  r.get("/", async (_req: Request, res: Response) => {
    const list = await Employee.find().sort({ name: 1 }).lean();
    res.json(list.map(e => ({
      id: String(e._id),
      name: e.name,
      email: e.email,
      role: e.role,
      phone: e.phone,
      status: e.status,
      dateOfJoining: e.dateOfJoining,
      baseSalary: e.baseSalary,
    })));
  });

  r.post("/", async (req: Request, res: Response) => {
    const parsed = employeeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const e = await Employee.create(parsed.data);
      res.status(201).json({ id: String(e._id) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create employee" });
    }
  });

  r.patch("/:id", async (req: Request, res: Response) => {
    const patch = employeeBody.partial().safeParse(req.body);
    if (!patch.success) {
      res.status(400).json({ error: patch.error.flatten() });
      return;
    }
    const e = await Employee.findByIdAndUpdate(req.params.id, patch.data, { new: true });
    if (!e) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.json({ ok: true });
  });

  r.delete("/:id", async (req: Request, res: Response) => {
    const e = await Employee.findByIdAndDelete(req.params.id);
    if (!e) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    // Clean up related records
    await Attendance.deleteMany({ employeeId: req.params.id });
    await Payroll.deleteMany({ employeeId: req.params.id });
    await Shift.deleteMany({ employeeId: req.params.id });
    res.json({ ok: true });
  });

  // --- Attendance ---
  r.get("/attendance", async (req: Request, res: Response) => {
    const date = req.query.date as string;
    const query = date ? { date } : {};
    const records = await Attendance.find(query).sort({ date: -1 }).lean();
    res.json(records.map(rec => ({
      id: String(rec._id),
      employeeId: String(rec.employeeId),
      date: rec.date,
      status: rec.status,
      checkInTime: rec.checkInTime,
      checkOutTime: rec.checkOutTime,
    })));
  });

  r.post("/attendance", async (req: Request, res: Response) => {
    const parsed = attendanceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const { employeeId, date } = parsed.data;
      const rec = await Attendance.findOneAndUpdate(
        { employeeId, date },
        { $set: parsed.data },
        { upsert: true, new: true }
      );
      res.json({ id: String(rec._id) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to log attendance" });
    }
  });

  // --- Payroll ---
  r.get("/payroll", async (_req: Request, res: Response) => {
    const records = await Payroll.find().sort({ month: -1 }).lean();
    res.json(records.map(rec => ({
      id: String(rec._id),
      employeeId: String(rec.employeeId),
      month: rec.month,
      baseSalaryPaid: rec.baseSalaryPaid,
      bonus: rec.bonus,
      deductions: rec.deductions,
      netPaid: rec.netPaid,
      status: rec.status,
      paymentDate: rec.paymentDate,
    })));
  });

  r.post("/payroll", async (req: Request, res: Response) => {
    const parsed = payrollBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const { employeeId, month, baseSalaryPaid, bonus = 0, deductions = 0, status = "pending" } = parsed.data;
      const netPaid = baseSalaryPaid + bonus - deductions;
      const rec = await Payroll.findOneAndUpdate(
        { employeeId, month },
        { 
          $set: { 
            baseSalaryPaid, 
            bonus, 
            deductions, 
            netPaid, 
            status, 
            paymentDate: status === "paid" ? new Date() : undefined 
          } 
        },
        { upsert: true, new: true }
      );
      res.json({ id: String(rec._id) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to log payroll" });
    }
  });

  // --- Shifts ---
  r.get("/shifts", async (_req: Request, res: Response) => {
    const list = await Shift.find().sort({ date: -1 }).lean();
    res.json(list.map(s => ({
      id: String(s._id),
      employeeId: String(s.employeeId),
      date: s.date,
      shiftType: s.shiftType,
      startTime: s.startTime,
      endTime: s.endTime,
      notes: s.notes,
    })));
  });

  r.post("/shifts", async (req: Request, res: Response) => {
    const parsed = shiftBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const s = await Shift.create(parsed.data);
      res.status(201).json({ id: String(s._id) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to assign shift" });
    }
  });

  r.delete("/shifts/:id", async (req: Request, res: Response) => {
    const s = await Shift.findByIdAndDelete(req.params.id);
    if (!s) {
      res.status(404).json({ error: "Shift not found" });
      return;
    }
    res.json({ ok: true });
  });

  return r;
}
