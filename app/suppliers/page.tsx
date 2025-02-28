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
import { initializeData } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingBag, Mail, Phone, MapPin, FileText } from "lucide-react"

interface Supplier {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  notes: string
}

const initialSupplier: Supplier = {
  id: "",
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentSupplier, setCurrentSupplier] = useState<Supplier>(initialSupplier)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Initialize sample data if needed
    if (typeof window !== "undefined") {
      initializeData()
    }

    const data = getLocalData("suppliers")
    setSuppliers(data)
  }, [])

  const columns = [
    { key: "name", label: "Name" },
    { key: "contactPerson", label: "Contact Person" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
  ]

  const handleAddNew = () => {
    setCurrentSupplier(initialSupplier)
    setIsEditing(false)
    setIsDialogOpen(true)
  }

  const handleEdit = (supplier: Supplier) => {
    setCurrentSupplier(supplier)
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    const updatedSuppliers = suppliers.filter((supplier) => supplier.id !== id)
    setSuppliers(updatedSuppliers)
    setLocalData("suppliers", updatedSuppliers)

    // If the deleted supplier is currently selected, clear the selection
    if (selectedSupplier && selectedSupplier.id === id) {
      setSelectedSupplier(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentSupplier.name || !currentSupplier.email) {
      toast({
        title: "Error",
        description: "Name and email are required fields.",
        variant: "destructive",
      })
      return
    }

    let updatedSuppliers: Supplier[]

    if (isEditing) {
      updatedSuppliers = suppliers.map((supplier) => (supplier.id === currentSupplier.id ? currentSupplier : supplier))
      toast({
        title: "Supplier updated",
        description: "The supplier has been successfully updated.",
      })

      // Update selected supplier if it's the one being edited
      if (selectedSupplier && selectedSupplier.id === currentSupplier.id) {
        setSelectedSupplier(currentSupplier)
      }
    } else {
      const newSupplier = {
        ...currentSupplier,
        id: generateId(),
      }
      updatedSuppliers = [...suppliers, newSupplier]
      toast({
        title: "Supplier added",
        description: "The supplier has been successfully added.",
      })
    }

    setSuppliers(updatedSuppliers)
    setLocalData("suppliers", updatedSuppliers)
    setIsDialogOpen(false)
  }

  const handleRowClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground">Manage your suppliers and vendor relationships.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <DataTable
            columns={columns}
            data={suppliers}
            onAdd={handleAddNew}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRowClick={handleRowClick}
          />
        </div>

        <div>
          {selectedSupplier ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{selectedSupplier.name}</CardTitle>
                    <CardDescription>Supplier Details</CardDescription>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    <ShoppingBag className="h-3 w-3 mr-1" />
                    Supplier
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Contact Person</h3>
                  <p className="text-sm">{selectedSupplier.contactPerson || "Not specified"}</p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Contact Information</h3>
                  <div className="grid gap-2">
                    <div className="flex items-center text-sm">
                      <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                      {selectedSupplier.email}
                    </div>
                    <div className="flex items-center text-sm">
                      <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                      {selectedSupplier.phone || "Not provided"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Address</h3>
                  <div className="flex items-start text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground mt-0.5" />
                    <span>{selectedSupplier.address || "Not provided"}</span>
                  </div>
                </div>

                {selectedSupplier.notes && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Notes</h3>
                    <div className="flex items-start text-sm">
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground mt-0.5" />
                      <span>{selectedSupplier.notes}</span>
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(selectedSupplier)} className="flex-1">
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this supplier?")) {
                        handleDelete(selectedSupplier.id)
                      }
                    }}
                    className="flex-1"
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Supplier Selected</CardTitle>
                <CardDescription>Select a supplier to view details</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Click on a supplier from the list to view their complete details here. You can also add a new supplier
                  using the "Add New" button.
                </p>
                <Button onClick={handleAddNew} className="mt-4 w-full">
                  Add New Supplier
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={currentSupplier.name}
                    onChange={(e) => setCurrentSupplier({ ...currentSupplier, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={currentSupplier.contactPerson}
                    onChange={(e) => setCurrentSupplier({ ...currentSupplier, contactPerson: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={currentSupplier.email}
                    onChange={(e) => setCurrentSupplier({ ...currentSupplier, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={currentSupplier.phone}
                    onChange={(e) => setCurrentSupplier({ ...currentSupplier, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={currentSupplier.address}
                  onChange={(e) => setCurrentSupplier({ ...currentSupplier, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={currentSupplier.notes}
                  onChange={(e) => setCurrentSupplier({ ...currentSupplier, notes: e.target.value })}
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

