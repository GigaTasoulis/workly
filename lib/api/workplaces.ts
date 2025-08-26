export type UIWorkplace = {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    capacity: string;
    notes: string;
  };
  
  type ApiWorkplace = {
    id: string;
    name: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    capacity?: string;
    notes?: string;
    created_at: string;
  };
  
  function apiToUi(w: ApiWorkplace): UIWorkplace {
    return {
      id: w.id,
      name: w.name,
      address: w.address || "",
      city: w.city || "",
      state: w.state || "",
      zipCode: w.zip_code || "",
      capacity: w.capacity || "",
      notes: w.notes || "",
    };
  }
  
  function uiToApi(input: Partial<UIWorkplace>) {
    return {
      name: input.name?.trim(),
      address: input.address?.trim(),
      city: input.city?.trim(),
      state: input.state?.trim(),
      zip_code: input.zipCode?.trim(),
      capacity: input.capacity?.trim(),
      notes: input.notes?.trim(),
    };
  }
  
  export async function fetchWorkplaces(): Promise<UIWorkplace[]> {
    const r = await fetch("/api/workplaces", { credentials: "include" });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    const list: ApiWorkplace[] = data.workplaces || [];
    return list.map(apiToUi);
  }
  
  export async function createWorkplace(input: Partial<UIWorkplace>): Promise<{ id: string }> {
    const r = await fetch("/api/workplaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(uiToApi(input)),
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    return { id: data?.workplace?.id };
  }
  
  export async function updateWorkplace(id: string, input: Partial<UIWorkplace>): Promise<void> {
    const r = await fetch(`/api/workplaces/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(uiToApi(input)),
    });
    if (!r.ok) throw new Error(await r.text());
  }
  
  export async function deleteWorkplace(id: string): Promise<void> {
    const r = await fetch(`/api/workplaces/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) throw new Error(await r.text());
  }
  