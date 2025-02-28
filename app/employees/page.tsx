"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { DataTable } from "@/components/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { generateId, getLocalData, setLocalData } from "@/lib/utils"
import { initializeData } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Briefcase, Mail, Phone, Building2, Calendar, FileText, Clock, GraduationCap, Award } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { translations as t } from "@/lib/translations" // Import translation keys

interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  department: string
  hireDate: string
  workplaceId: string
  notes: string
}

const initialEmployee: Employee = {
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
}

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
]

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [workplaces, setWorkplaces] = useState<any[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentEmployee, setCurrentEmployee] = useState<Employee>(initialEmployee)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Initialize sample data if needed
    if (typeof window !== "undefined") {
      initializeData()
    }

    const employeesData = getLocalData("employees")
    const workplacesData = getLocalData("workplaces")
    setEmployees(employeesData)
    setWorkplaces(workplacesData)
  }, [])

  const columns = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "position", label: "Position" },
    { key: "department", label: "Department" },
  ]

  const handleAddNew = () => {
    setCurrentEmployee(initialEmployee)
    setIsEditing(false)
    setIsDialogOpen(true)
  }

  const handleEdit = (employee: Employee) => {
    setCurrentEmployee(employee)
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    const updatedEmployees = employees.filter((employee) => employee.id !== id)
    setEmployees(updatedEmployees)
    setLocalData("employees", updatedEmployees)

    // If the deleted employee is currently selected, clear the selection
    if (selectedEmployee && selectedEmployee.id === id) {
      setSelectedEmployee(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentEmployee.firstName || !currentEmployee.lastName || !currentEmployee.email) {
      toast({
        title: "Error",
        description: "First name, last name, and email are required fields.",
        variant: "destructive",
      })
      return
    }

    let updatedEmployees: Employee[]

    if (isEditing) {
      updatedEmployees = employees.map((employee) => (employee.id === currentEmployee.id ? currentEmployee : employee))
      toast({
        title: t.employeeUpdated,
        description: "Ο υπάλληλος ενημερώθηκε με επιτυχία.",
      })

      // Update selected employee if it's the one being edited
      if (selectedEmployee && selectedEmployee.id === currentEmployee.id) {
        setSelectedEmployee(currentEmployee)
      }
    } else {
      const newEmployee = {
        ...currentEmployee,
        id: generateId(),
      }
      updatedEmployees = [...employees, newEmployee]
      toast({
        title: t.employeeAdded,
        description: "Ο υπάλληλος προστέθηκε με επιτυχία.",
      })
    }

    setEmployees(updatedEmployees)
    setLocalData("employees", updatedEmployees)
    setIsDialogOpen(false)
  }

  const handleRowClick = (employee: Employee) => {
    setSelectedEmployee(employee)
  }

  // Find workplace name for the selected employee
  const getWorkplaceName = (workplaceId: string) => {
    const workplace = workplaces.find((wp) => wp.id === workplaceId)
    return workplace ? workplace.name : "Not assigned"
  }

  // Calculate employee tenure
  const calculateTenure = (hireDate: string) => {
    if (!hireDate) return t.notSpecified

    const hire = new Date(hireDate)
    const now = new Date()

    const yearDiff = now.getFullYear() - hire.getFullYear()
    const monthDiff = now.getMonth() - hire.getMonth()

    if (monthDiff < 0) {
      return `${yearDiff - 1} ${t.years}, ${monthDiff + 12} ${t.months}`
    }

    return `${yearDiff} ${t.years}, ${monthDiff} ${t.months}`
  }

  // Generate mock performance metrics
  const getPerformanceMetrics = (id: string) => {
    // Use employee ID to generate consistent random values
    const seed = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)

    return {
      productivity: (seed % 30) + 70, // 70-100
      attendance: (seed % 20) + 80, // 80-100
      teamwork: (seed % 25) + 75, // 75-100
      quality: (seed % 25) + 75, // 75-100
    }
  }

  // Generate mock certifications
  const getCertifications = (id: string) => {
    const seed = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const certifications = [
      {
        name: "Project Management Professional (PMP)",
        issuer: "Project Management Institute",
        date: "2022-05-15",
      },
      {
        name: "Certified Scrum Master",
        issuer: "Scrum Alliance",
        date: "2021-08-22",
      },
      {
        name: "Six Sigma Green Belt",
        issuer: "ASQ",
        date: "2023-01-10",
      },
      {
        name: "ITIL Foundation",
        issuer: "Axelos",
        date: "2022-11-30",
      },
    ]

    // Return 1-3 certifications based on the seed
    return certifications.slice(0, (seed % 3) + 1)
  }

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
            data={employees}
            onAdd={handleAddNew}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSelect={setSelectedEmployee}
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
                        {selectedEmployee.firstName.charAt(0)}
                        {selectedEmployee.lastName.charAt(0)}
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
                    {selectedEmployee.department}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="details">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details">{t.details}</TabsTrigger>
                    <TabsTrigger value="employment">{t.employmentDetails}</TabsTrigger>
                    <TabsTrigger value="performance">{t.performance}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Contact Information</h3>
                      <div className="grid gap-2">
                        <div className="flex items-center text-sm">
                          <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                          {selectedEmployee.email}
                        </div>
                        <div className="flex items-center text-sm">
                          <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                          {selectedEmployee.phone || "Not provided"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Workplace</h3>
                      <div className="flex items-center text-sm">
                        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                        {getWorkplaceName(selectedEmployee.workplaceId)}
                      </div>
                    </div>

                    {selectedEmployee.notes && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Notes</h3>
                        <div className="flex items-start text-sm">
                          <FileText className="h-4 w-4 mr-2 text-muted-foreground mt-0.5" />
                          <span>{selectedEmployee.notes}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-2 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(selectedEmployee)}
                        className="flex-1"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this employee?")) {
                            handleDelete(selectedEmployee.id)
                          }
                        }}
                        className="flex-1"
                      >
                        Delete
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="employment" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Hire Date</h3>
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {selectedEmployee.hireDate || "Not specified"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Tenure</h3>
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        {calculateTenure(selectedEmployee.hireDate)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Certifications</h3>
                      <div className="space-y-2">
                        {getCertifications(selectedEmployee.id).map((cert, index) => (
                          <div key={index} className="flex items-start gap-2 rounded-md border p-2">
                            <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">{cert.name}</p>
                              <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                              <p className="text-xs text-muted-foreground">Issued: {cert.date}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="performance" className="space-y-4 pt-4">
                    <div className="space-y-4">
                      {Object.entries(getPerformanceMetrics(selectedEmployee.id)).map(([key, value]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between">
                            <h3 className="text-sm font-medium">
                              {key === "productivity" && t.productivity}
                              {key === "attendance" && t.attendance}
                              {key === "teamwork" && t.teamwork}
                              {key === "quality" && t.quality}
                            </h3>
                            <span className="text-sm text-muted-foreground">{value}%</span>
                          </div>
                          <Progress value={value} className="h-2" />
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 space-y-2">
                      <h3 className="text-sm font-medium">{t.recentAchievements}</h3>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 rounded-md border p-2">
                          <Award className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">{t.employeeOfTheMonth}</p>
                            <p className="text-xs text-muted-foreground">{t.outstandingPerformance}</p>
                          </div>
                        </div>
                      </div>
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
                  <Label htmlFor="email">{t.email} *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={currentEmployee.email}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, email: e.target.value })}
                    required
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
                    value={currentEmployee.department}
                    onValueChange={(value) => setCurrentEmployee({ ...currentEmployee, department: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
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
                    value={currentEmployee.hireDate}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, hireDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workplaceId">{t.workplace}</Label>
                  <Select
                    value={currentEmployee.workplaceId}
                    onValueChange={(value) => setCurrentEmployee({ ...currentEmployee, workplaceId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a workplace" />
                    </SelectTrigger>
                    <SelectContent>
                      {workplaces.map((workplace) => (
                        <SelectItem key={workplace.id} value={workplace.id}>
                          {workplace.name}
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
    </div>
  )
}

