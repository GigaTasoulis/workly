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

interface WorkLog {
  id: string
  employeeId: string
  workplaceId: string
  date: string
  hoursWorked: string
  notes: string
  totalAmount: number
  amountPaid: number
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
  const [isCertificationDialogOpen, setIsCertificationDialogOpen] = useState(false);
  // New state for storing performance traits as simple text
  const [performanceTraits, setPerformanceTraits] = useState<{
    productivity: string;
    attendance: string;
    teamwork: string;
    quality: string;
  }>({
    productivity: "Excellent",
    attendance: "Very Good",
    teamwork: "Good",
    quality: "Average",
  });

  // State for controlling the performance trait edit modal
  const [isPerformanceDialogOpen, setIsPerformanceDialogOpen] = useState(false);

  // State for editing traits (used in the modal)
  const [editingPerformanceTraits, setEditingPerformanceTraits] = useState({
    productivity: "Excellent",
    attendance: "Very Good",
    teamwork: "Good",
    quality: "Average",
  });
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [currentWorkLog, setCurrentWorkLog] = useState<WorkLog>({
    id: "",
    employeeId: "",
    workplaceId: "",
    date: "",
    hoursWorked: "",
    notes: "",
    totalAmount: 0,
    amountPaid: 0,
  })
  const [isWorkLogDialogOpen, setIsWorkLogDialogOpen] = useState(false)
  const [isEditingWorkLog, setIsEditingWorkLog] = useState(false)
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("all")
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [workLogToPay, setWorkLogToPay] = useState<WorkLog | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<string>("")

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

  useEffect(() => {
    const storedLogs = getLocalData("worklogs") || []
    setWorkLogs(storedLogs)
  }, [])

  useEffect(() => {
    if (selectedEmployee) {
      const storageKey = `performanceTraits_${selectedEmployee.id}`;
      const stored = getLocalData(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPerformanceTraits(parsed);
        setEditingPerformanceTraits(parsed);
      } else {
        const defaultTraits = {
          productivity: "Excellent",
          attendance: "Very Good",
          teamwork: "Good",
          quality: "Average",
        };
        setPerformanceTraits(defaultTraits);
        setEditingPerformanceTraits(defaultTraits);
        setLocalData(storageKey, JSON.stringify(defaultTraits));
      }
    }
  }, [selectedEmployee]);
  
  
  const columns = [
    { key: "firstName", label: "Όνομα" },
    { key: "lastName", label: "Επώνυμο" },
    { key: "email", label: "Email" },
    { key: "position", label: "Θέση" },
    { key: "department", label: "Τμήμα" },
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

  const handleAddWorkLog = () => {
    setCurrentWorkLog({
      id: "",
      employeeId: selectedEmployee ? selectedEmployee.id : "",
      workplaceId: "",
      date: "",
      hoursWorked: "",
      notes: "",
      totalAmount: 0,
      amountPaid: 0,
    })
    setIsEditingWorkLog(false)
    setIsWorkLogDialogOpen(true)
  }

  const handleEditWorkLog = (log: WorkLog) => {
    setCurrentWorkLog(log)
    setIsEditingWorkLog(true)
    setIsWorkLogDialogOpen(true)
  }

  const handleDeleteWorkLog = (id: string) => {
    if (confirm("Are you sure you want to delete this work log?")) {
      const updatedLogs = workLogs.filter((log) => log.id !== id)
      setWorkLogs(updatedLogs)
      setLocalData("worklogs", updatedLogs)
      toast({
        title: "Work Log deleted",
        description: "Work log entry deleted successfully.",
      })
    }
  }

  const handleWorkLogSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentWorkLog.employeeId || !currentWorkLog.workplaceId || !currentWorkLog.date) {
      toast({
        title: "Error",
        description: "Employee, workplace, and date are required.",
        variant: "destructive",
      })
      return
    }
    let updatedLogs: WorkLog[]
    if (isEditingWorkLog) {
      updatedLogs = workLogs.map((log) =>
        log.id === currentWorkLog.id ? currentWorkLog : log
      )
      toast({
        title: "Work Log updated",
        description: "Work log updated successfully.",
      })
    } else {
      const newLog = { ...currentWorkLog, id: generateId() }
      updatedLogs = [...workLogs, newLog]
      toast({
        title: "Work Log added",
        description: "Work log added successfully.",
      })
    }
    setWorkLogs(updatedLogs)
    setLocalData("worklogs", updatedLogs)
    setIsWorkLogDialogOpen(false)
  }

  const handleOpenPayDialog = (log: WorkLog) => {
    setWorkLogToPay(log)
    setPaymentAmount("")
    setIsPayDialogOpen(true)
  }
  
  // Handler for submitting a payment
  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!workLogToPay) return
    const remaining = workLogToPay.totalAmount - workLogToPay.amountPaid
    const payment = parseFloat(paymentAmount)
    if (isNaN(payment) || payment <= 0) {
      toast({
        title: "Error",
        description: "Enter a valid payment amount.",
        variant: "destructive",
      })
      return
    }
    if (payment > remaining) {
      toast({
        title: "Error",
        description: `Payment cannot exceed the remaining amount (€${remaining}).`,
        variant: "destructive",
      })
      return
    }
    // Update work log payment
    const updatedLog = { ...workLogToPay, amountPaid: workLogToPay.amountPaid + payment }
    const updatedLogs = workLogs.map((log) => log.id === updatedLog.id ? updatedLog : log)
    setWorkLogs(updatedLogs)
    setLocalData("worklogs", updatedLogs)
    toast({
      title: "Payment recorded",
      description: `€${payment} payment recorded.`,
    })
    setIsPayDialogOpen(false)
  }

  // Filtering work logs based on employee selection
  const filteredWorkLogs =
    selectedEmployeeFilter === "all"
      ? workLogs
      : workLogs.filter((log) => log.employeeId === selectedEmployeeFilter)

  

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
                      <h3 className="text-sm font-medium">Στοιχεία Επικοινωνίας</h3>
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
                      <h3 className="text-sm font-medium">Χώρος Εργασίας</h3>
                      <div className="flex items-center text-sm">
                        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                        {getWorkplaceName(selectedEmployee.workplaceId)}
                      </div>
                    </div>

                    {selectedEmployee.notes && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Σημειώσεις</h3>
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
                      <h3 className="text-sm font-medium">Ημ/νία Πρόσληψης</h3>
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {selectedEmployee.hireDate || "Not specified"}
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

                  <TabsContent value="performance" className="space-y-4 pt-4">
                    {selectedEmployee ? (
                      <div className="space-y-4">
                        {Object.entries(performanceTraits).map(([key, trait]) => (
                          <div key={key} className="flex justify-between">
                            <h3 className="text-sm font-medium">
                              {key === "productivity" && t.productivity}
                              {key === "attendance" && t.attendance}
                              {key === "teamwork" && t.teamwork}
                              {key === "quality" && t.quality}
                            </h3>
                            <span className="text-sm text-muted-foreground">{trait}</span>
                          </div>
                        ))}
                        <Button onClick={() => { 
                          console.log("Editing traits clicked");
                          setIsPerformanceDialogOpen(true);
                        }} size="sm">
                          Επεξεργασία
                        </Button>
                      </div>
                    ) : (
                      <p>No performance metrics available.</p>
                    )}
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
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold tracking-tight">Καταγραφή Εργασίας</h2>
          <Button onClick={handleAddWorkLog}>Προσθήκη Ωρών</Button>
        </div>
        <div className="mb-4">
          <Select value={selectedEmployeeFilter} onValueChange={(value) => setSelectedEmployeeFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Υπαλληλος
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Χωρος εργασιας
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ημ/νια
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ωρες Εργασιας
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Be Paid</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Σημειωσεις
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ενεργειες
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredWorkLogs.map((log) => {
                const employee = employees.find((emp) => emp.id === log.employeeId)
                return (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee ? `${employee.firstName} ${employee.lastName}` : "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getWorkplaceName(log.workplaceId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.hoursWorked}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {`${log.amountPaid} / ${log.totalAmount}`}
                      {log.amountPaid === log.totalAmount ? (
                        <Badge className="bg-green-100 text-green-800 ml-2">Paid</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 ml-2">Pending</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.notes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditWorkLog(log)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteWorkLog(log.id)}>
                          Delete
                        </Button>
                        {(log.totalAmount - log.amountPaid) > 0 && (
                          <Button size="sm" variant="secondary" onClick={() => handleOpenPayDialog(log)}>
                            Pay
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
      <Dialog open={isPerformanceDialogOpen} onOpenChange={setIsPerformanceDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Επεξεργασία Αποδόσεων</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // Save the edited traits
              setPerformanceTraits(editingPerformanceTraits);
              if (selectedEmployee) {
                setLocalData(`performanceTraits_${selectedEmployee.id}`, editingPerformanceTraits);
              }
              setIsPerformanceDialogOpen(false);
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="prod">Productivity</Label>
                <Input
                  id="prod"
                  value={editingPerformanceTraits.productivity}
                  onChange={(e) =>
                    setEditingPerformanceTraits({
                      ...editingPerformanceTraits,
                      productivity: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="att">Attendance</Label>
                <Input
                  id="att"
                  value={editingPerformanceTraits.attendance}
                  onChange={(e) =>
                    setEditingPerformanceTraits({
                      ...editingPerformanceTraits,
                      attendance: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team">Teamwork</Label>
                <Input
                  id="team"
                  value={editingPerformanceTraits.teamwork}
                  onChange={(e) =>
                    setEditingPerformanceTraits({
                      ...editingPerformanceTraits,
                      teamwork: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qual">Quality</Label>
                <Input
                  id="qual"
                  value={editingPerformanceTraits.quality}
                  onChange={(e) =>
                    setEditingPerformanceTraits({
                      ...editingPerformanceTraits,
                      quality: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPerformanceDialogOpen(false)}>
                Ακύρωση
              </Button>
              <Button type="submit">Αποθήκευση</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isWorkLogDialogOpen} onOpenChange={setIsWorkLogDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditingWorkLog ? "Edit Work Log" : "Add Work Log"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWorkLogSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="worklog-employee">Employee</Label>
                <Select
                  value={currentWorkLog.employeeId}
                  onValueChange={(value) =>
                    setCurrentWorkLog({ ...currentWorkLog, employeeId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Employee" />
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
              {/* Replace free-text location with workplace selection */}
              <div className="space-y-2">
                <Label htmlFor="worklog-workplace">Workplace</Label>
                <Select
                  value={currentWorkLog.workplaceId}
                  onValueChange={(value) =>
                    setCurrentWorkLog({ ...currentWorkLog, workplaceId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Workplace" />
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
                <Label htmlFor="worklog-date">Date</Label>
                <Input
                  id="worklog-date"
                  type="date"
                  value={currentWorkLog.date}
                  onChange={(e) =>
                    setCurrentWorkLog({ ...currentWorkLog, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worklog-hours">Hours Worked</Label>
                <Input
                  id="worklog-hours"
                  type="number"
                  value={currentWorkLog.hoursWorked}
                  onChange={(e) =>
                    setCurrentWorkLog({ ...currentWorkLog, hoursWorked: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worklog-total-amount">Total Amount (€)</Label>
                <Input
                  id="worklog-total-amount"
                  type="number"
                  value={currentWorkLog.totalAmount}
                  onChange={(e) =>
                    setCurrentWorkLog({ ...currentWorkLog, totalAmount: parseFloat(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worklog-notes">Notes</Label>
                <Textarea
                  id="worklog-notes"
                  value={currentWorkLog.notes}
                  onChange={(e) =>
                    setCurrentWorkLog({ ...currentWorkLog, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWorkLogDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditingWorkLog ? "Update" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Pay Work Log</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePaySubmit}>
            <div className="grid gap-4 py-4">
              {workLogToPay && (
                <>
                  <div>
                    <p>Remaining Amount: {workLogToPay.totalAmount - workLogToPay.amountPaid}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-amount">Payment Amount (€)</Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={`Enter amount (max €${workLogToPay.totalAmount - workLogToPay.amountPaid})`}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPayDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

