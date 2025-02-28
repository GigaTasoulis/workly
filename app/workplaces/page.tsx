"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { DataTable } from "@/components/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { generateId, getLocalData, setLocalData } from "@/lib/utils"

interface Workplace {
  id: string
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  capacity: string
  notes: string
}

const initialWorkplace: Workplace = {
  id: "",
  name: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  capacity: "",
  notes: "",
}

export default function WorkplacesPage() {
  const [workplaces, setWorkplaces] = useState<Workplace[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentWorkplace, setCurrentWorkplace] = useState<Workplace>(initialWorkplace)
  const [isEditing, setIsEditing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const data = getLocalData("workplaces")
    setWorkplaces(data)
  }, [])

  const columns = [
    { key: "name", label: "Name" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "capacity", label: "Capacity" },
  ]

  const handleAddNew = () => {
    setCurrentWorkplace(initialWorkplace)
    setIsEditing(false)
    setIsDialogOpen(true)
  }

  const handleEdit = (workplace: Workplace) => {
    setCurrentWorkplace(workplace)
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    const updatedWorkplaces = workplaces.filter((workplace) => workplace.id !== id)
    setWorkplaces(updatedWorkplaces)
    setLocalData("workplaces", updatedWorkplaces)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentWorkplace.name || !currentWorkplace.address) {
      toast({
        title: "Error",
        description: "Name and address are required fields.",
        variant: "destructive",
      })
      return
    }

    let updatedWorkplaces: Workplace[]

    if (isEditing) {
      updatedWorkplaces = workplaces.map((workplace) =>
        workplace.id === currentWorkplace.id ? currentWorkplace : workplace,
      )
      toast({
        title: "Workplace updated",
        description: "The workplace has been successfully updated.",
      })
    } else {
      const newWorkplace = {
        ...currentWorkplace,
        id: generateId(),
      }
      updatedWorkplaces = [...workplaces, newWorkplace]
      toast({
        title: "Workplace added",
        description: "The workplace has been successfully added.",
      })
    }

    setWorkplaces(updatedWorkplaces)
    setLocalData("workplaces", updatedWorkplaces)
    setIsDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workplaces</h1>
        <p className="text-muted-foreground">Manage your office locations and work sites.</p>
      </div>

      <DataTable columns={columns} data={workplaces} onAdd={handleAddNew} onEdit={handleEdit} onDelete={handleDelete} />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Workplace" : "Add New Workplace"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={currentWorkplace.name}
                  onChange={(e) => setCurrentWorkplace({ ...currentWorkplace, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={currentWorkplace.address}
                  onChange={(e) => setCurrentWorkplace({ ...currentWorkplace, address: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={currentWorkplace.city}
                    onChange={(e) => setCurrentWorkplace({ ...currentWorkplace, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={currentWorkplace.state}
                    onChange={(e) => setCurrentWorkplace({ ...currentWorkplace, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={currentWorkplace.zipCode}
                    onChange={(e) => setCurrentWorkplace({ ...currentWorkplace, zipCode: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  value={currentWorkplace.capacity}
                  onChange={(e) => setCurrentWorkplace({ ...currentWorkplace, capacity: e.target.value })}
                  placeholder="e.g., 50 people"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={currentWorkplace.notes}
                  onChange={(e) => setCurrentWorkplace({ ...currentWorkplace, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? "Update" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

