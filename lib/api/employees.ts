export type UIEmployee = {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    position?: string;
    department?: string;
    hireDate?: string;
    workplaceId?: string;
    notes?: string;
  };
  
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
  
  function apiToUi(e: ApiEmployee): UIEmployee {
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
  
  function uiToApi(input: Partial<UIEmployee>) {
    return {
      first_name: input.firstName?.trim(),
      last_name: input.lastName?.trim(),
      email: input.email?.trim(),
      phone: input.phone?.trim(),
      position: input.position?.trim(),
      department: input.department?.trim(),
      hire_date: input.hireDate?.trim(),
      workplace_id: input.workplaceId?.trim(),
      notes: input.notes?.trim(),
    };
  }
  
  export async function fetchEmployees(): Promise<UIEmployee[]> {
    const r = await fetch("/api/employees", { credentials: "include" });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    const list: ApiEmployee[] = data.employees || [];
    return list.map(apiToUi);
  }
  
  export async function createEmployee(input: Partial<UIEmployee>): Promise<{ id: string }> {
    const r = await fetch("/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(uiToApi(input)),
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    return { id: data?.employee?.id };
  }
  
  export async function updateEmployee(id: string, input: Partial<UIEmployee>): Promise<void> {
    const r = await fetch(`/api/employees/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(uiToApi(input)),
    });
    if (!r.ok) throw new Error(await r.text());
  }
  
  export async function deleteEmployee(id: string): Promise<void> {
    const r = await fetch(`/api/employees/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) throw new Error(await r.text());
  }
  