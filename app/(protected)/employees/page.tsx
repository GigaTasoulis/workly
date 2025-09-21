"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Mail, Phone, Building2, Calendar, FileText, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { translations as t } from "@/lib/translations";

// ---------------- Types (UI) ----------------
type UIWorkplace = { id: string; name: string; address?: string };

type UIEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  hireDate?: string;    // YYYY-MM-DD
  workplaceId?: string; // workplaces.id
  notes?: string;
  owed?: number;
};

type UIWorklog = {
  id: string;
  employeeId: string;
  workplaceId: string;
  date: string;           // YYYY-MM-DD
  hoursWorked: number;
  notes?: string;
  totalAmount: number;
  amountPaid: number;
};

// ---------------- Types (API) ----------------
type ApiEmployee = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  hire_date?: string;
  workplace_id?: string;
  notes?: string;
  created_at: string;
};

type ApiWorklog = {
  id: string;
  employee_id: string;
  workplace_id: string;
  date: string;
  hours_worked: number;
  notes?: string;
  total_amount: number;
  amount_paid: number;
  created_at: string;
};

// ---- NEW: Finance helpers for expenses + live transactions ----
type UpsertPayrollTxnPayload = {
  kind: "payroll";
  worklog_id: string;       // unique key to tie txn to this worklog
  employee_id: string;
  title: string;            // e.g. "First Last – 2025-09-19"
  date: string;             // worklog date
  total: number;
  paid: number;
  remaining: number;
  status: "active" | "closed";
};

// ---- NEW helpers that match your backend ----
async function upsertPayrollTxnFromWorklog(w: UIWorklog, employee?: UIEmployee) {
  const body = {
    upsert: true,
    employee_id: w.employeeId,
    worklog_id: w.id,
    amount: Number(w.totalAmount || 0),
    amount_paid: Number(w.amountPaid || 0),
    date: w.date,
    status: (Number(w.amountPaid || 0) >= Number(w.totalAmount || 0)) ? "paid" : "pending",
    notes: employee ? `${employee.firstName} ${employee.lastName} – ${w.date}` : null,
  };
  const r = await fetch(`/api/payroll-transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!r.ok) console.warn("upsertPayrollTxnFromWorklog failed:", await r.text());
}

async function addPayrollPaymentForWorklog(worklogId: string, amount: number, note?: string) {
  const r = await fetch(`/api/payroll-payments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      worklog_id: worklogId,
      amount: Number(amount || 0),
      note: note || "Payroll payment",
      // date omitted -> backend uses today
    }),
  });
  if (!r.ok) console.warn("addPayrollPaymentForWorklog failed:", await r.text());
}

async function deletePayrollTxnByWorklog(worklogId: string) {
  await fetch(`/api/payroll-transactions?worklog_id=${encodeURIComponent(worklogId)}`, {
    method: "DELETE",
    credentials: "include",
  });
}



// ---------------- Mapping helpers ----------------
function apiEmpToUi(e: ApiEmployee): UIEmployee {
  return {
    id: e.id,
    firstName: e.first_name,
    lastName: e.last_name,
    email: e.email || "",
    phone: e.phone || "",
    position: e.position || "",
    department: e.department || "",
    hireDate: e.hire_date || "",
    workplaceId: e.workplace_id || "",
    notes: e.notes || "",
  };
}
function uiEmpToApi(input: Partial<UIEmployee>) {
  return {
    first_name: input.firstName?.trim(),
    last_name: input.lastName?.trim(),
    email: input.email?.trim(),
    phone: input.phone?.trim(),
    position: input.position?.trim(),
    department: input.department?.trim(),
    hire_date: input.hireDate?.trim(),
    workplace_id: input.workplaceId?.trim() || null,
    notes: input.notes?.trim(),
  };
}

function apiLogToUi(w: ApiWorklog): UIWorklog {
  return {
    id: w.id,
    employeeId: w.employee_id,
    workplaceId: w.workplace_id,
    date: w.date,
    hoursWorked: Number(w.hours_worked) || 0,
    notes: w.notes || "",
    totalAmount: Number(w.total_amount) || 0,
    amountPaid: Number(w.amount_paid) || 0,
  };
}
function uiLogToApi(input: Partial<UIWorklog>) {
  const p: Record<string, any> = {};
  if (input.employeeId !== undefined)   p.employee_id  = String(input.employeeId).trim();
  if (input.workplaceId !== undefined)  p.workplace_id = String(input.workplaceId).trim();
  if (input.date !== undefined)         p.date         = String(input.date).trim();
  if (input.hoursWorked !== undefined)  p.hours_worked = Number(input.hoursWorked);
  if (input.notes !== undefined)        p.notes        = String(input.notes).trim();
  if (input.totalAmount !== undefined)  p.total_amount = Number(input.totalAmount);
  if (input.amountPaid !== undefined)   p.amount_paid  = Number(input.amountPaid);
  return p;
}

// ---------------- API helpers (same structure as suppliers) ----------------
async function fetchWorkplaces(): Promise<UIWorkplace[]> {
  const r = await fetch(`/api/workplaces`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  const list: any[] = data.workplaces || [];
  return list.map(w => ({ id: w.id, name: w.name, address: w.address || "" }));
}

async function fetchEmployees(): Promise<UIEmployee[]> {
  const r = await fetch(`/api/employees`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  const list: ApiEmployee[] = data.employees || [];
  return list.map(apiEmpToUi);
}
async function createEmployeeApi(input: Partial<UIEmployee>): Promise<string> {
  const r = await fetch(`/api/employees`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(uiEmpToApi(input)),
  });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  return data?.employee?.id as string;
}
async function updateEmployeeApi(id: string, input: Partial<UIEmployee>): Promise<void> {
  const r = await fetch(`/api/employees/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(uiEmpToApi(input)),
  });
  if (!r.ok) throw new Error(await r.text());
}
async function deleteEmployeeApi(id: string): Promise<void> {
  const r = await fetch(`/api/employees/${id}`, { method: "DELETE", credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
}

async function fetchWorklogs(params?: { employeeId?: string; status?: "pending" | "paid"; from?: string; to?: string }): Promise<UIWorklog[]> {
  const qs = new URLSearchParams();
  if (params?.employeeId) qs.set("employeeId", params.employeeId);
  if (params?.status) qs.set("status", params.status);
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  const r = await fetch(`/api/worklogs${qs.toString() ? `?${qs}` : ""}`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  const list: ApiWorklog[] = data.worklogs || [];
  return list.map(apiLogToUi);
}
async function createWorklogApi(input: Partial<UIWorklog>): Promise<string> {
  const r = await fetch(`/api/worklogs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(uiLogToApi(input)),
  });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  return data?.worklog?.id as string;
}
async function updateWorklogApi(id: string, input: Partial<UIWorklog>): Promise<void> {
  const r = await fetch(`/api/worklogs/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(uiLogToApi(input)),
  });
  if (!r.ok) throw new Error(await r.text());
}
async function deleteWorklogApi(id: string): Promise<void> {
  const r = await fetch(`/api/worklogs/${id}`, { method: "DELETE", credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
}

// ---------------- Component ----------------
const departments = [
  t.management,
  t.sales,
  t.marketing,
  t.engineering,
  t.finance,
  t.humanResources,
  t.customerSupport,
  t.operations,
  t.researchDevelopment,
  t.legal,
];

const emptyEmployee: UIEmployee = {
  id: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  position: "",
  department: "",
  hireDate: "",
  workplaceId: "",
  notes: "",
};

const emptyWorklog: UIWorklog = {
  id: "",
  employeeId: "",
  workplaceId: "",
  date: new Date().toISOString().slice(0, 10),
  hoursWorked: 0,
  notes: "",
  totalAmount: 0,
  amountPaid: 0,
};

export default function EmployeesPage() {
  const { toast } = useToast();

  const [employees, setEmployees] = useState<UIEmployee[]>([]);
  const [workplaces, setWorkplaces] = useState<UIWorkplace[]>([]);
  const [worklogs, setWorklogs] = useState<UIWorklog[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<UIEmployee>(emptyEmployee);
  const [selectedEmployee, setSelectedEmployee] = useState<UIEmployee | null>(null);

  const [isWorkLogDialogOpen, setIsWorkLogDialogOpen] = useState(false);
  const [isEditingWorkLog, setIsEditingWorkLog] = useState(false);
  const [currentWorkLog, setCurrentWorkLog] = useState<UIWorklog>(emptyWorklog);

  const [empFilterStatus, setEmpFilterStatus] = useState<"all" | "paid" | "pending">("all");
  const [empSortOrder, setEmpSortOrder] = useState<"desc" | "asc">("desc");
  const [empPage, setEmpPage] = useState(1);

  const workLogsPerPage = 10;

  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("all");
  const [workLogStatusFilter, setWorkLogStatusFilter] = useState<"all"|"paid"|"pending">("all");
  const [currentWorkLogPage, setCurrentWorkLogPage] = useState(1);

  const [isGlobalPayOpen, setIsGlobalPayOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string>("");
  const [globalPaymentAmount, setGlobalPaymentAmount] = useState<string>("");

  // Which employee scope are we showing in the bar? (selected card > table filter > all)
  const scopedEmployee =
    selectedEmployee ??
    (selectedEmployeeFilter !== "all"
      ? employees.find(e => e.id === selectedEmployeeFilter) ?? null
      : null);

  // Open (pending) logs in scope
  const pendingLogs = useMemo(() => {
    let logs = worklogs.filter(w => (w.totalAmount - w.amountPaid) > 0.000001);
    if (scopedEmployee) logs = logs.filter(w => w.employeeId === scopedEmployee.id);
    return logs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [worklogs, scopedEmployee]);

  const selectedDebt = useMemo(
    () => pendingLogs.find(l => l.id === selectedDebtId),
    [pendingLogs, selectedDebtId]
  );

  // Stats for the bar
  const scopedPendingCount = pendingLogs.length;
  const scopedOwed = Number(
    pendingLogs.reduce((s, l) => s + Math.max(0, l.totalAmount - l.amountPaid), 0).toFixed(2)
  );

  function exportEmployeeWorklogsToCSV(rows: UIWorklog[], name = "worklogs") {
    const header = ["employeeId","workplaceId","date","hoursWorked","totalAmount","amountPaid","notes"];
    const body = rows.map(r => [
      r.employeeId, r.workplaceId, r.date, r.hoursWorked, r.totalAmount, r.amountPaid,
      (r.notes ?? "").replace(/\r?\n/g, " ")
    ]);
    const csv = [header, ...body].map(a => a.map(x => `"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}.csv`; a.click();
    URL.revokeObjectURL(url);
  }


  function openGlobalPay() {
    if (pendingLogs.length === 0) {
      toast({ title: "Δεν υπάρχουν εκκρεμείς οφειλές", variant: "destructive" });
      return;
    }
    setSelectedDebtId(pendingLogs[0].id);
    setGlobalPaymentAmount("");
    setIsGlobalPayOpen(true);
  }

  async function handleGlobalPaySubmit(e: React.FormEvent) {
    e.preventDefault();
    const log = selectedDebt;
    if (!log) return;

    const remaining = Math.max(0, log.totalAmount - log.amountPaid);
    const amount = parseFloat(globalPaymentAmount);

    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      toast({ title: "Σφάλμα", description: `Μη έγκυρο ποσό (μέχρι €${remaining}).`, variant: "destructive" });
      return;
    }

    const newPaid = Math.min(
      log.totalAmount,
      Number((log.amountPaid + amount).toFixed(2))
    );

    try {
      // 1) Update the worklog's paid amount
      await updateWorklogApi(log.id, { amountPaid: newPaid });

      // 2) Record payment (your backend also bumps the txn)
      await addPayrollPaymentForWorklog(log.id, amount, "Payroll payment");

      // 3) Keep live transaction in sync
      const emp = employees.find(e => e.id === log.employeeId) || undefined;
      await upsertPayrollTxnFromWorklog({ ...log, amountPaid: newPaid }, emp);

      // 4) Refresh UI
      const fresh = await fetchWorklogs();
      setWorklogs(fresh);
      setIsGlobalPayOpen(false);
      toast({ title: "Καταγράφηκε", description: `Πληρωμή ${formatEUR(amount)}.` });
    } catch (err) {
      console.error(err);
      toast({ title: "Σφάλμα", description: "Αποτυχία καταγραφής πληρωμής.", variant: "destructive" });
    }
  }


  const [workLogSortOrder, setWorkLogSortOrder] = useState<"desc" | "asc">("desc");
  const formatEUR = (v: number) =>
  new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(v);


  // Which employee should the action bar target?
  const actionEmployee = useMemo(() => {
    // prefer the explicitly selected card on the right;
    // otherwise use the filter dropdown if it's not "all"
    return (
      selectedEmployee ??
      (selectedEmployeeFilter !== "all"
        ? employees.find((e) => e.id === selectedEmployeeFilter) ?? null
        : null)
    );
  }, [selectedEmployee, selectedEmployeeFilter, employees]);

  // Pending count + balance for that employee
  const actionPendingCount = useMemo(() => {
    if (!actionEmployee) return 0;
    return worklogs.filter(
      (l) => l.employeeId === actionEmployee.id && (l.amountPaid || 0) < (l.totalAmount || 0)
    ).length;
  }, [actionEmployee, worklogs]);

  const actionBalance = useMemo(() => {
    if (!actionEmployee) return 0;
    return worklogs
      .filter((l) => l.employeeId === actionEmployee.id)
      .reduce((sum, l) => sum + Math.max(0, (l.totalAmount || 0) - (l.amountPaid || 0)), 0);
  }, [actionEmployee, worklogs]);

  // Quick-pay the oldest pending worklog for that employee
  const handleQuickPayFor = (employeeId: string) => {
    const pending = worklogs
      .filter((l) => l.employeeId === employeeId && (l.amountPaid || 0) < (l.totalAmount || 0))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (pending.length === 0) return;
    handleOpenPayDialog(pending[0]);
  };

  // Export that employee's logs to CSV
  const exportEmployeeCSV = (employeeId: string) => {
    const rows = worklogs
      .filter((l) => l.employeeId === employeeId)
      .map((l) => ({
        date: l.date,
        workplace: getWorkplaceName(l.workplaceId),
        hoursWorked: l.hoursWorked,
        totalAmount: l.totalAmount,
        amountPaid: l.amountPaid,
        remaining: Math.max(0, (l.totalAmount || 0) - (l.amountPaid || 0)),
        notes: l.notes || "",
      }));

    const headers = ["Ημερομηνία","Χώρος Εργασίας","Ώρες","Σύνολο (€)","Πληρωμένο (€)","Υπόλοιπο (€)","Σημειώσεις"];
    const csv = [
      headers.join(","),
      ...rows.map(r =>
        [
          r.date,
          `"${(r.workplace || "").replace(/"/g, '""')}"`,
          r.hoursWorked,
          r.totalAmount,
          r.amountPaid,
          r.remaining,
          `"${(r.notes || "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const emp = employees.find((e) => e.id === employeeId);
    const name = emp ? `${emp.firstName}-${emp.lastName}` : "employee";
    a.download = `worklogs-${name}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Columns for the DataTable
  const columns = [
    { key: "firstName", label: "Όνομα" },
    { key: "lastName", label: "Επώνυμο" },
    { key: "email", label: "Email" },
    { key: "position", label: "Θέση" },
    { key: "department", label: "Τμήμα" },
    { key: "owed", label: "Οφειλή (€)" },
  ];

  // --------- Initial load ----------
  useEffect(() => {
    (async () => {
      try {
        const [wps, emps, logs] = await Promise.all([
          fetchWorkplaces(),
          fetchEmployees(),
          fetchWorklogs(),
        ]);
        setWorkplaces(wps);
        setEmployees(emps);
        setWorklogs(logs);
      } catch (e) {
        console.error(e);
        toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης δεδομένων.", variant: "destructive" });
      }
    })();
  }, [toast]);

  // --------- Helpers ----------
  const getWorkplaceName = (workplaceId?: string) => {
    if (!workplaceId) return "Not assigned";
    return workplaces.find(w => w.id === workplaceId)?.name || "Not assigned";
  };

  const owedByEmployee = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of worklogs) {
      const due = Math.max(0, (w.totalAmount || 0) - (w.amountPaid || 0));
      m.set(w.employeeId, (m.get(w.employeeId) || 0) + due);
    }
    return m;
  }, [worklogs]);
  
  const employeesForTable = useMemo(() => {
    return employees.map(e => ({
      ...e,
      owed: Number((owedByEmployee.get(e.id) || 0).toFixed(2)),
    }));
  }, [employees, owedByEmployee]);
  

  const calculateTenure = (hireDate?: string) => {
    if (!hireDate) return t.notSpecified;
    const h = new Date(hireDate);
    if (Number.isNaN(h.getTime())) return t.notSpecified;
    const now = new Date();
    let years = now.getFullYear() - h.getFullYear();
    let months = now.getMonth() - h.getMonth();
    if (months < 0) { years -= 1; months += 12; }
    return `${years} ${t.years}, ${months} ${t.monthss}`;
    };
  
  const filteredLogs = useMemo(() => {
    let logs = worklogs;
    if (selectedEmployeeFilter !== "all") logs = logs.filter(l => l.employeeId === selectedEmployeeFilter);
    if (workLogStatusFilter === "paid")    logs = logs.filter(l => l.amountPaid >= l.totalAmount);
    if (workLogStatusFilter === "pending") logs = logs.filter(l => l.amountPaid < l.totalAmount);
    return logs.slice().sort((a,b) =>
      workLogSortOrder === "desc" // <-- was empSortOrder
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [worklogs, selectedEmployeeFilter, workLogStatusFilter, workLogSortOrder]);

  
  const paginatedWorkLogs = useMemo(() => {
    const start = (currentWorkLogPage - 1) * workLogsPerPage;
    return filteredLogs.slice(start, start + workLogsPerPage);
  }, [filteredLogs, currentWorkLogPage]);
    

  const filteredEmployeeLogs = useMemo(() => {
    if (!selectedEmployee) return [];
    let logs = worklogs.filter(l => l.employeeId === selectedEmployee.id);
    if (empFilterStatus === "paid")   logs = logs.filter(l => l.amountPaid >= l.totalAmount);
    if (empFilterStatus === "pending") logs = logs.filter(l => l.amountPaid < l.totalAmount);
    logs.sort((a, b) =>
      empSortOrder === "desc"
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return logs;
  }, [worklogs, selectedEmployee, empFilterStatus, empSortOrder]);
  

  const paginatedEmployeeLogs = useMemo(() => {
    const start = (empPage - 1) * workLogsPerPage;
    return filteredEmployeeLogs.slice(start, start + workLogsPerPage);
  }, [filteredEmployeeLogs, empPage]);
  

  // --------- Employee CRUD ----------
  const handleAddNew = () => {
    setCurrentEmployee(emptyEmployee);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (employee: UIEmployee) => {
    setCurrentEmployee(employee);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEmployeeApi(id);
      if (selectedEmployee?.id === id) setSelectedEmployee(null);
      const fresh = await fetchEmployees();
      setEmployees(fresh);
      toast({ title: "Διαγράφηκε", description: "Ο υπάλληλος διαγράφηκε." });
    } catch (e) {
      console.error(e);
      toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής.", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmployee.firstName?.trim() || !currentEmployee.lastName?.trim()) {
      toast({ title: "Σφάλμα", description: "Όνομα και Επώνυμο είναι υποχρεωτικά.", variant: "destructive" });
      return;
    }
    try {
      if (isEditing) {
        await updateEmployeeApi(currentEmployee.id, currentEmployee);
        toast({ title: t.employeeUpdated, description: "Ο υπάλληλος ενημερώθηκε." });
      } else {
        await createEmployeeApi(currentEmployee);
        toast({ title: t.employeeAdded, description: "Ο υπάλληλος προστέθηκε." });
      }
      const fresh = await fetchEmployees();
      setEmployees(fresh);
      setIsDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast({ title: "Σφάλμα", description: "Αποτυχία αποθήκευσης υπαλλήλου.", variant: "destructive" });
    }
  };

  // --------- Worklog CRUD + pay ----------
  const handleAddWorkLog = () => {
    if (!selectedEmployee) {
      toast({ title: "Σφάλμα", description: "Επιλέξτε υπάλληλο για καταγραφή.", variant: "destructive" });
      return;
    }
    setCurrentWorkLog({
      ...emptyWorklog,
      employeeId: selectedEmployee.id,
    });
    setIsEditingWorkLog(false);
    setIsWorkLogDialogOpen(true);
  };

  const handleEditWorkLog = (log: UIWorklog) => {
    if (isPaid(log)) {
      toast({
        title: "Μη επεξεργάσιμο",
        description: "Η καταγραφή είναι εξοφλημένη. Μπορείς μόνο να τη διαγράψεις.",
        variant: "destructive",
      });
      return;
    }
    setCurrentWorkLog(log);
    setIsEditingWorkLog(true);
    setIsWorkLogDialogOpen(true);
  };

  const handleDeleteWorkLog = async (id: string) => {
  if (!confirm("Να διαγραφεί αυτή η καταγραφή;")) return;
  try {
    await deleteWorklogApi(id);
    // NEW: clean up the associated transaction
    await deletePayrollTxnByWorklog(id);

    const fresh = await fetchWorklogs();
    setWorklogs(fresh);
    toast({ title: "Διαγράφηκε", description: "Η καταγραφή διαγράφηκε." });
  } catch (e) {
    console.error(e);
    toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής καταγραφής.", variant: "destructive" });
  }
};

  const handleWorkLogSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const w = currentWorkLog;
  if (!w.employeeId || !w.workplaceId || !w.date) {
    toast({ title: "Σφάλμα", description: "Υπάλληλος, Χώρος εργασίας και Ημ/νία απαιτούνται.", variant: "destructive" });
    return;
  }
  try {
    if (isEditingWorkLog && w.id) {
      await updateWorklogApi(w.id, w);
      toast({ title: "Ενημερώθηκε", description: "Η καταγραφή ενημερώθηκε." });
      // NEW: make sure the live transaction reflects the new totals
      const emp = employees.find(e => e.id === w.employeeId) || undefined;
      await upsertPayrollTxnFromWorklog(w, emp);
    } else {
      const newId = await createWorklogApi(w);
      toast({ title: "Προστέθηκε", description: "Η καταγραφή προστέθηκε." });
      // NEW: create live transaction for this new worklog
      const newLog: UIWorklog = { ...w, id: newId, amountPaid: Number(w.amountPaid || 0), totalAmount: Number(w.totalAmount || 0) };
      const emp = employees.find(e => e.id === newLog.employeeId) || undefined;
      await upsertPayrollTxnFromWorklog(newLog, emp);
    }
    const fresh = await fetchWorklogs();
    setWorklogs(fresh);
    setIsWorkLogDialogOpen(false);
  } catch (e) {
    console.error(e);
    toast({ title: "Σφάλμα", description: "Αποτυχία αποθήκευσης καταγραφής.", variant: "destructive" });
  }
};

  // simple “pay” flow: add amount to amountPaid
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [workLogToPay, setWorkLogToPay] = useState<UIWorklog | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");

  const handleOpenPayDialog = (log: UIWorklog) => {
    setWorkLogToPay(log);
    setPaymentAmount("");
    setIsPayDialogOpen(true);
  };

  const isPaid = (w: Pick<UIWorklog, "amountPaid" | "totalAmount">) =>
    Number(w.amountPaid || 0) >= Number(w.totalAmount || 0);
  

  const handleAddWorkLogGlobal = () => {
    if (selectedEmployeeFilter !== "all") {
      const emp = employees.find(e => e.id === selectedEmployeeFilter);
      if (emp) setSelectedEmployee(emp);
    }
    handleAddWorkLog();
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workLogToPay) return;

    const remaining = workLogToPay.totalAmount - workLogToPay.amountPaid;
    const payment = parseFloat(paymentAmount);
    if (!Number.isFinite(payment) || payment <= 0 || payment > remaining) {
      toast({ title: "Σφάλμα", description: `Μη έγκυρο ποσό (μέχρι €${remaining}).`, variant: "destructive" });
      return;
    }
    const newPaid = Math.min(workLogToPay.totalAmount, Number((workLogToPay.amountPaid + payment).toFixed(2)));

    try {
      // Update worklog paid amount
      await updateWorklogApi(workLogToPay.id, { amountPaid: newPaid });

      // NEW: record payroll payment (also bumps amount_paid on the txn)
      await addPayrollPaymentForWorklog(workLogToPay.id, payment, "Payroll payment");


      // NEW: update the live transaction (active -> closed if fully paid)
      const updatedLog: UIWorklog = { ...workLogToPay, amountPaid: newPaid };
      const emp = employees.find(e => e.id === updatedLog.employeeId) || undefined;
      await upsertPayrollTxnFromWorklog(updatedLog, emp);

      const fresh = await fetchWorklogs();
      setWorklogs(fresh);
      setIsPayDialogOpen(false);
      toast({ title: "Καταγράφηκε", description: `Πληρωμή €${payment}.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Σφάλμα", description: "Αποτυχία καταγραφής πληρωμής.", variant: "destructive" });
    }
  };

  // --------- UI ---------
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.employeesTitle}</h1>
        <p className="text-muted-foreground">{t.manageTeam}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <DataTable
            columns={columns}
            data={employeesForTable}
            onAdd={handleAddNew}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSelect={(e: UIEmployee) => setSelectedEmployee(e)}
          />
        </div>

        <div>
          {selectedEmployee ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {selectedEmployee.firstName?.[0] || "?"}
                        {selectedEmployee.lastName?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle>
                        {selectedEmployee.firstName} {selectedEmployee.lastName}
                      </CardTitle>
                      <CardDescription>{selectedEmployee.position}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    <Briefcase className="h-3 w-3 mr-1" />
                    {selectedEmployee.department || "-"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="details">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">{t.details}</TabsTrigger>
                    <TabsTrigger value="employment">{t.employmentDetails}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Στοιχεία Επικοινωνίας</h3>
                      <div className="grid gap-2">
                        <div className="flex items-center text-sm">
                          <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                          {selectedEmployee.email || "—"}
                        </div>
                        <div className="flex items-center text-sm">
                          <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                          {selectedEmployee.phone || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Χώρος Εργασίας</h3>
                      <div className="flex items-center text-sm">
                        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                        {getWorkplaceName(selectedEmployee.workplaceId)}
                      </div>
                    </div>

                    {selectedEmployee.notes ? (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Σημειώσεις</h3>
                        <div className="flex items-start text-sm">
                          <FileText className="h-4 w-4 mr-2 text-muted-foreground mt-0.5" />
                          <span>{selectedEmployee.notes}</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex space-x-2 pt-4">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(selectedEmployee)} className="flex-1">
                        Επεξεργασία
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm("Να διαγραφεί αυτός ο υπάλληλος;")) handleDelete(selectedEmployee.id);
                        }}
                        className="flex-1"
                      >
                        Διαγραφή
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="employment" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Ημ/νία Πρόσληψης</h3>
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {selectedEmployee.hireDate || "—"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Θητεία</h3>
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        {calculateTenure(selectedEmployee.hireDate)}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="space-y-4 pt-4">
                    <div className="flex gap-4 mb-4">
                        <Select
                          value={workLogSortOrder}
                          onValueChange={(value) => {
                            setWorkLogSortOrder(value as "desc" | "asc");
                            setCurrentWorkLogPage(1);
                          }}
                        >
                        <SelectTrigger>
                          <SelectValue placeholder="Ταξινόμηση" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desc">Πιο πρόσφατες</SelectItem>
                          <SelectItem value="asc">Παλαιότερες</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={empFilterStatus}
                        onValueChange={(v: "all" | "paid" | "pending") => { setEmpFilterStatus(v); setEmpPage(1); }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Κατάσταση" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Όλες</SelectItem>
                          <SelectItem value="paid">Πληρωμένες</SelectItem>
                          <SelectItem value="pending">Εκκρεμείς</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button onClick={handleAddWorkLogGlobal} className="ml-auto" size="sm">
                        Προσθήκη Ωρών
                      </Button>
                    </div>

                    {paginatedEmployeeLogs.map((log) => (
                      <div key={log.id} className="border p-2 rounded-md">
                        <p><strong>Ημ/νία:</strong> {log.date}</p>
                        <p><strong>Ώρες:</strong> {log.hoursWorked}</p>
                        <p><strong>Χώρος Εργασίας:</strong> {getWorkplaceName(log.workplaceId)}</p>
                        <p>
                          <strong>Πληρωμή:</strong> {`${log.amountPaid} / ${log.totalAmount}`}
                          {log.amountPaid >= log.totalAmount ? (
                            <Badge className="bg-green-100 text-green-800 ml-2">Πληρωμένη</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800 ml-2">Εκκρεμή</Badge>
                          )}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {!isPaid(log) && (
                            <Button size="sm" variant="outline" onClick={() => handleEditWorkLog(log)}>
                              Επεξεργασία
                            </Button>
                          )}
                          {!isPaid(log) && (log.totalAmount - log.amountPaid) > 0 && (
                            <Button size="sm" variant="secondary" onClick={() => handleOpenPayDialog(log)}>
                              Πληρωμή
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteWorkLog(log.id)}>Διαγραφή</Button>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-center items-center mt-4 space-x-4">
                      <Button disabled={empPage === 1} onClick={() => setEmpPage(p => p - 1)}>←</Button>
                      <span className="text-sm font-medium">
                        {empPage} / {Math.max(1, Math.ceil(filteredEmployeeLogs.length / workLogsPerPage))}
                      </span>
                      <Button
                        disabled={empPage >= Math.ceil(filteredEmployeeLogs.length / workLogsPerPage)}
                        onClick={() => setEmpPage(p => p + 1)}
                      >
                        →
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t.noEmployeeSelected}</CardTitle>
                <CardDescription>{t.selectEmployee}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.selectEmployee}</p>
                <Button onClick={handleAddNew} className="mt-4 w-full">
                  {t.addNewEmployee}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Employee Add/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? t.editEmployee : t.addNewEmployee}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t.firstName} *</Label>
                  <Input
                    id="firstName"
                    value={currentEmployee.firstName}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t.lastName} *</Label>
                  <Input
                    id="lastName"
                    value={currentEmployee.lastName}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    type="text"
                    value={currentEmployee.email}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.phone}</Label>
                  <Input
                    id="phone"
                    value={currentEmployee.phone}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">{t.position}</Label>
                  <Input
                    id="position"
                    value={currentEmployee.position}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, position: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">{t.department}</Label>
                  <Select
                    value={currentEmployee.department || ""}
                    onValueChange={(value) => setCurrentEmployee({ ...currentEmployee, department: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Επιλογή τμήματος" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hireDate">{t.hireDate}</Label>
                  <Input
                    id="hireDate"
                    type="date"
                    className="dark:bg-gray-200 dark:text-gray-900"
                    value={currentEmployee.hireDate}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, hireDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workplaceId">{t.workplace}</Label>
                  <Select
                    value={currentEmployee.workplaceId || ""}
                    onValueChange={(value) => setCurrentEmployee({ ...currentEmployee, workplaceId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Επιλογή χώρου εργασίας" />
                    </SelectTrigger>
                    <SelectContent>
                      {workplaces.map((wp) => (
                        <SelectItem key={wp.id} value={wp.id}>
                          {wp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={currentEmployee.notes}
                  onChange={(e) => setCurrentEmployee({ ...currentEmployee, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit">{isEditing ? t.update : t.add}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Worklog Add/Edit */}
      <Dialog open={isWorkLogDialogOpen} onOpenChange={setIsWorkLogDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditingWorkLog ? "Επεξεργασία Καταγραφής" : "Προσθήκη Καταγραφής"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWorkLogSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Εργαζόμενος</Label>
                <Select
                  value={currentWorkLog.employeeId}
                  onValueChange={(value) => setCurrentWorkLog({ ...currentWorkLog, employeeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλογή Εργαζόμενου" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Χώρος Εργασίας</Label>
                <Select
                  value={currentWorkLog.workplaceId}
                  onValueChange={(value) => setCurrentWorkLog({ ...currentWorkLog, workplaceId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλογή Χώρου Εργασίας" />
                  </SelectTrigger>
                  <SelectContent>
                    {workplaces.map((wp) => (
                      <SelectItem key={wp.id} value={wp.id}>
                        {wp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ημ/νία</Label>
                <Input
                  type="date"
                  className="dark:bg-gray-200 dark:text-gray-900"
                  value={currentWorkLog.date}
                  onChange={(e) => setCurrentWorkLog({ ...currentWorkLog, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Ώρες Εργασίας</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={Number.isFinite(currentWorkLog.hoursWorked) ? String(currentWorkLog.hoursWorked) : ""}
                  onChange={(e) => setCurrentWorkLog({ ...currentWorkLog, hoursWorked: parseFloat(e.target.value || "0") })}
                />
              </div>

              <div className="space-y-2">
                <Label>Συνολικό Ποσό (€)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={String(currentWorkLog.totalAmount)}
                  onChange={(e) => setCurrentWorkLog({ ...currentWorkLog, totalAmount: parseFloat(e.target.value || "0") })}
                />
              </div>

              <div className="space-y-2">
                <Label>Σημειώσεις</Label>
                <Textarea
                  value={currentWorkLog.notes || ""}
                  onChange={(e) => setCurrentWorkLog({ ...currentWorkLog, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWorkLogDialogOpen(false)}>
                Ακύρωση
              </Button>
              <Button type="submit">{isEditingWorkLog ? "Ενημέρωση" : "Προσθήκη"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Πληρωμή</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePaySubmit}>
            <div className="grid gap-4 py-4">
              {workLogToPay && (
                <>
                  <div>
                    <p><strong>Υπόλοιπο:</strong> {workLogToPay.totalAmount - workLogToPay.amountPaid}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-amount">Ποσό πληρωμής (€)</Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={`Μέγιστο €${workLogToPay.totalAmount - workLogToPay.amountPaid}`}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPayDialogOpen(false)}>
                Ακύρωση
              </Button>
              <Button type="submit">Υποβολή Πληρωμής</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isGlobalPayOpen} onOpenChange={setIsGlobalPayOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Πληρωμή</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleGlobalPaySubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Οφειλή</Label>
                <Select
                  value={selectedDebtId}
                  onValueChange={(v) => setSelectedDebtId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλογή οφειλής" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingLogs.map((l) => {
                      const emp = employees.find(e => e.id === l.employeeId);
                      const remaining = Math.max(0, l.totalAmount - l.amountPaid);
                      return (
                        <SelectItem key={l.id} value={l.id}>
                          {(emp ? `${emp.firstName} ${emp.lastName}` : "—")}
                          {" • "}{l.date}
                          {" • Υπόλοιπο "}{formatEUR(remaining)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="global-pay-amount">Ποσό πληρωμής (€)</Label>
                <Input
                  id="global-pay-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={globalPaymentAmount}
                  onChange={(e) => setGlobalPaymentAmount(e.target.value)}
                  placeholder={
                    selectedDebt
                      ? `Μέγιστο ${formatEUR(Math.max(0, selectedDebt.totalAmount - selectedDebt.amountPaid))}`
                      : "Ποσό"
                  }
                />
                {!!selectedDebt && (
                  <p className="text-xs text-muted-foreground">
                    Υπόλοιπο: {formatEUR(Math.max(0, selectedDebt.totalAmount - selectedDebt.amountPaid))}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsGlobalPayOpen(false)}>
                Ακύρωση
              </Button>
              <Button type="submit">Υποβολή Πληρωμής</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="mt-8">
        <div className="space-y-2 mb-4">
          {/* keep your original title + button */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Καταγραφή Εργασίας</h2>
            <Button onClick={handleAddWorkLogGlobal}>Προσθήκη Ωρών</Button>
          </div>

          {/* action bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Ενέργειες για:{" "}
              <span className="font-medium text-foreground">
                {scopedEmployee ? `${scopedEmployee.firstName} ${scopedEmployee.lastName}` : "Όλους"}
              </span>
            </div>

            <div className="text-sm text-muted-foreground">
              Εκκρεμείς συναλλαγές:{" "}
              <span className="font-medium">{scopedPendingCount}</span> • Υπόλοιπο:{" "}
              <span className="font-medium text-foreground">{formatEUR(scopedOwed)}</span>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                className="w-full sm:w-auto"
                variant="secondary"
                onClick={handleAddWorkLogGlobal}
              >
                Προσθήκη Ωρών
              </Button>

              <Button
                className="w-full sm:w-auto"
                onClick={openGlobalPay}
                disabled={pendingLogs.length === 0}
              >
                Πληρωμή
              </Button>

              <Button
                variant="outline"
                onClick={() => exportEmployeeWorklogsToCSV(
                  scopedEmployee ? worklogs.filter(w => w.employeeId === scopedEmployee.id) : worklogs,
                  scopedEmployee ? `${scopedEmployee.firstName}-${scopedEmployee.lastName}` : "all-employees"
                )}
              >
                Εξαγωγή CSV
              </Button>
            </div>
          </div>

        </div>

        <div className="flex gap-4 mb-4">
          <Select
            value={selectedEmployeeFilter}
            onValueChange={(value) => {
              setSelectedEmployeeFilter(value);
              setCurrentWorkLogPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλοι</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={workLogStatusFilter}
            onValueChange={(value) => {
              setWorkLogStatusFilter(value as "all" | "paid" | "pending");
              setCurrentWorkLogPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλα</SelectItem>
              <SelectItem value="paid">Πληρωμένη</SelectItem>
              <SelectItem value="pending">Εκκρεμή</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={workLogSortOrder}
            onValueChange={(value) => {
              setWorkLogSortOrder(value as "desc" | "asc");
              setCurrentWorkLogPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort by Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Νεότερα</SelectItem>
              <SelectItem value="asc">Παλαιότερα</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Υπαλληλος</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Χωρος εργασιας</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ημ/νια</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ωρες Εργασιας</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Πληρωμη</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Σημειωσεις</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ενεργειες</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedWorkLogs.map((log) => {
                const employee = employees.find((emp) => emp.id === log.employeeId);
                return (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                      {employee ? `${employee.firstName} ${employee.lastName}` : "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                      {getWorkplaceName(log.workplaceId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                      {log.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                      {log.hoursWorked}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                      {`${log.amountPaid} / ${log.totalAmount}`}
                      {log.amountPaid >= log.totalAmount ? (
                        <Badge className="bg-green-100 text-green-800 ml-2 dark:bg-green-800 dark:text-green-100">Πληρωμένη</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 ml-2 dark:bg-yellow-800 dark:text-yellow-100">Εκκρεμή</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                      {log.notes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-50">
                      <div className="flex gap-2">
                        {!isPaid(log) && (
                          <Button size="sm" variant="outline" onClick={() => handleEditWorkLog(log)}>
                            Επεξεργασία
                          </Button>
                        )}
                        {!isPaid(log) && (log.totalAmount - log.amountPaid) > 0 && (
                          <Button size="sm" variant="secondary" onClick={() => handleOpenPayDialog(log)}>
                            Πληρωμή
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteWorkLog(log.id)}>Διαγραφή</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-center items-center mt-4 space-x-4">
            <Button
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3"
              disabled={currentWorkLogPage === 1}
              onClick={() => setCurrentWorkLogPage(currentWorkLogPage - 1)}
            >
              ←
            </Button>
            <span className="text-sm font-medium">
              {currentWorkLogPage} / {Math.ceil(filteredLogs.length / workLogsPerPage)}
            </span>
            <Button
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3"
              disabled={currentWorkLogPage === Math.ceil(filteredLogs.length / workLogsPerPage) || Math.ceil(filteredLogs.length / workLogsPerPage) === 0}
              onClick={() => setCurrentWorkLogPage(currentWorkLogPage + 1)}
            >
              →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
