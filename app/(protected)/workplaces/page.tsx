"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { translations as t } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Users, FileText } from "lucide-react";

import {
  fetchWorkplaces,
  createWorkplace,
  updateWorkplace,
  deleteWorkplace,
  type UIWorkplace as Workplace,
} from "@/lib/api/workplaces";

const initialWorkplace: Workplace = {
  id: "",
  name: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  capacity: "",
  notes: "",
};

export default function WorkplacesPage() {
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentWorkplace, setCurrentWorkplace] = useState<Workplace>(initialWorkplace);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWorkplace, setSelectedWorkplace] = useState<Workplace | null>(null);
  const { toast } = useToast();

  // columns unchanged
  const columns = [
    { key: "name", label: t.workplaceName },
    { key: "address", label: t.address },
    { key: "city", label: t.city },
    { key: "capacity", label: t.capacity },
  ];

  // load list from API (reused after mutations)
  const loadWorkplaces = async () => {
    try {
      const data = await fetchWorkplaces();
      setWorkplaces(data);
      // keep selection in sync if it still exists
      if (selectedWorkplace) {
        const updated = data.find((w) => w.id === selectedWorkplace.id) || null;
        setSelectedWorkplace(updated);
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία φόρτωσης χώρων εργασίας.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadWorkplaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddNew = () => {
    setCurrentWorkplace(initialWorkplace);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (workplace: Workplace) => {
    setCurrentWorkplace(workplace);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkplace(id);
      toast({
        title: t.workplaceDeleted ?? "Διαγράφηκε",
        description: "Ο χώρος εργασίας διαγράφηκε.",
      });
      if (selectedWorkplace && selectedWorkplace.id === id) setSelectedWorkplace(null);
      await loadWorkplaces();
    } catch (e) {
      console.error(e);
      toast({
        title: "Σφάλμα",
        description: "Δεν ήταν δυνατή η διαγραφή.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentWorkplace.name?.trim() || !currentWorkplace.address?.trim()) {
      toast({
        title: "Error",
        description: "Name and address are required fields.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: currentWorkplace.name?.trim(),
      address: currentWorkplace.address?.trim() || "",
      city: currentWorkplace.city?.trim() || "",
      state: currentWorkplace.state?.trim() || "",
      zipCode: currentWorkplace.zipCode?.trim() || "",
      capacity: currentWorkplace.capacity?.trim() || "",
      notes: currentWorkplace.notes?.trim() || "",
    };

    try {
      if (isEditing) {
        await updateWorkplace(currentWorkplace.id, payload);
        toast({
          title: t.workplaceUpdated,
          description: "Ο χώρος εργασίας ενημερώθηκε με επιτυχία.",
        });
      } else {
        await createWorkplace(payload);
        toast({ title: t.workplaceAdded, description: "Ο χώρος εργασίας προστέθηκε με επιτυχία." });
      }

      setIsDialogOpen(false);
      await loadWorkplaces();
    } catch (e) {
      console.error(e);
      toast({
        title: "Σφάλμα",
        description: "Δεν ήταν δυνατή η αποθήκευση.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.workplacesTitle}</h1>
        <p className="text-muted-foreground">{t.manageOffices}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <DataTable
            columns={columns}
            data={workplaces}
            onAdd={handleAddNew}
            onEdit={handleEdit}
            onDelete={(id: string) => {
              if (confirm(t.confirmDelete)) handleDelete(id);
            }}
            onSelect={setSelectedWorkplace}
          />
        </div>

        <div>
          {selectedWorkplace ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedWorkplace.name}</CardTitle>
                    <CardDescription>{t.workplaceDetails}</CardDescription>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    <Building2 className="mr-1 h-3 w-3" />
                    {selectedWorkplace.capacity}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">{t.address}</h3>
                  <div className="flex items-start text-sm">
                    <MapPin className="mr-2 mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p>{selectedWorkplace.address}</p>
                      <p>
                        {selectedWorkplace.city}, {selectedWorkplace.state}{" "}
                        {selectedWorkplace.zipCode}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">{t.capacity}</h3>
                  <div className="flex items-center text-sm">
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    {selectedWorkplace.capacity}
                  </div>
                </div>

                {selectedWorkplace.notes && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">{t.notes}</h3>
                    <div className="flex items-start text-sm">
                      <FileText className="mr-2 mt-0.5 h-4 w-4 text-muted-foreground" />
                      <span>{selectedWorkplace.notes}</span>
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(selectedWorkplace)}
                    className="flex-1"
                  >
                    {t.edit}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(t.confirmDelete)) handleDelete(selectedWorkplace.id);
                    }}
                    className="flex-1"
                  >
                    {t.delete}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t.noWorkplaceSelected}</CardTitle>
                <CardDescription>{t.selectWorkplace}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.selectWorkplace}</p>
                <Button onClick={handleAddNew} className="mt-4 w-full">
                  {t.addNewWorkplace}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? t.editWorkplace : t.addNewWorkplace}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.workplaceName} *</Label>
                <Input
                  id="name"
                  value={currentWorkplace.name}
                  onChange={(e) =>
                    setCurrentWorkplace({ ...currentWorkplace, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t.address} *</Label>
                <Input
                  id="address"
                  value={currentWorkplace.address}
                  onChange={(e) =>
                    setCurrentWorkplace({ ...currentWorkplace, address: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t.city}</Label>
                  <Input
                    id="city"
                    value={currentWorkplace.city}
                    onChange={(e) =>
                      setCurrentWorkplace({ ...currentWorkplace, city: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">{t.state}</Label>
                  <Input
                    id="state"
                    value={currentWorkplace.state}
                    onChange={(e) =>
                      setCurrentWorkplace({ ...currentWorkplace, state: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">{t.zipCode}</Label>
                  <Input
                    id="zipCode"
                    value={currentWorkplace.zipCode}
                    onChange={(e) =>
                      setCurrentWorkplace({ ...currentWorkplace, zipCode: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">{t.capacity}</Label>
                <Input
                  id="capacity"
                  value={currentWorkplace.capacity}
                  onChange={(e) =>
                    setCurrentWorkplace({ ...currentWorkplace, capacity: e.target.value })
                  }
                  placeholder="e.g., 50 people"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={currentWorkplace.notes}
                  onChange={(e) =>
                    setCurrentWorkplace({ ...currentWorkplace, notes: e.target.value })
                  }
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
    </div>
  );
}
