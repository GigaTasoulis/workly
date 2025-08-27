export type UIWorklog = {
    id: string;
    employeeId: string;
    workplaceId: string;
    date: string;           // YYYY-MM-DD
    hoursWorked: number;
    notes?: string;
    totalAmount: number;
    amountPaid: number;
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
  
  function apiToUi(w: ApiWorklog): UIWorklog {
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
  
  function uiToApi(input: Partial<UIWorklog>) {
    return {
      employee_id: input.employeeId?.trim(),
      workplace_id: input.workplaceId?.trim(),
      date: input.date?.trim(),
      hours_worked: input.hoursWorked,
      notes: input.notes?.trim(),
      total_amount: input.totalAmount,
      amount_paid: input.amountPaid,
    };
  }
  
  export async function fetchWorklogs(params?: { employeeId?: string; status?: "pending"|"paid"; from?: string; to?: string }): Promise<UIWorklog[]> {
    const qs = new URLSearchParams();
    if (params?.employeeId) qs.set("employeeId", params.employeeId);
    if (params?.status) qs.set("status", params.status);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const r = await fetch(`/api/worklogs${qs.toString() ? `?${qs}` : ""}`, { credentials: "include" });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    const list: ApiWorklog[] = data.worklogs || [];
    return list.map(apiToUi);
  }
  
  export async function createWorklog(input: Partial<UIWorklog>): Promise<{ id: string }> {
    const r = await fetch("/api/worklogs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(uiToApi(input)),
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    return { id: data?.worklog?.id };
  }
  
  export async function updateWorklog(id: string, input: Partial<UIWorklog>): Promise<void> {
    const r = await fetch(`/api/worklogs/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(uiToApi(input)),
    });
    if (!r.ok) throw new Error(await r.text());
  }
  
  export async function deleteWorklog(id: string): Promise<void> {
    const r = await fetch(`/api/worklogs/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) throw new Error(await r.text());
  }
  