"use client"

import { useState, useEffect, Suspense } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import {KolosLogo} from "@/app/components/svg"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Edit2, Save, X, Trash2, Menu } from "lucide-react"
import { toast } from "sonner"

function ClientDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState("Investor")
  const [signals, setSignals] = useState([])
  const [deals, setDeals] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState({})
  const [updatingStage, setUpdatingStage] = useState(null)
  const [showCreateDealModal, setShowCreateDealModal] = useState(false)
  const [selectedSignal, setSelectedSignal] = useState(null)
  const [dealFormData, setDealFormData] = useState({
    deal_name: '',
    target: '',
    source: '',
    stage: 'list',
    target_deal_size: '',
    next_step: ''
  })
  const [creatingDeal, setCreatingDeal] = useState(false)
  const [deletingDeal, setDeletingDeal] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Get client ID from URL params and fetch client data
    const clientId = searchParams.get("id")
    if (clientId) {
      fetchClientData(clientId)
    } else {
      setLoading(false)
    }
  }, [searchParams])

  const fetchClientData = async (clientId) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/airtable/clients/${clientId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch client")
      }

      const clientData = data.client
      setClient(clientData)
      
      // Set default role from client profile (check lowercase first, then uppercase)
      const clientRole = clientData.role || clientData.Role || clientData["role"] || clientData["Role"] || "Investor"
      // Normalize role to match button labels
      const normalizedRole = clientRole.charAt(0).toUpperCase() + clientRole.slice(1).toLowerCase()
      if (["Investor", "Entrepreneur", "Asset Manager", "Facilitator"].includes(normalizedRole)) {
        setSelectedRole(normalizedRole)
      }
      
      // Fetch signals from Signals sheet using profile_id
      const profileId = clientData.id || clientData.ID || clientData["id"] || clientData["ID"]
      if (profileId) {
        try {
          const signalsResponse = await fetch(`/api/signals?profile_id=${encodeURIComponent(profileId)}`)
          const signalsData = await signalsResponse.json()
          
          if (signalsResponse.ok && signalsData.signals && Array.isArray(signalsData.signals)) {
            setSignals(signalsData.signals)
            console.log(`✅ Loaded ${signalsData.signals.length} signals for profile ${profileId}`)
          } else {
            console.warn("No signals found or error fetching signals:", signalsData)
            setSignals([])
          }
        } catch (signalError) {
          console.error("Error fetching signals:", signalError)
          setSignals([])
        }

        // Fetch deals from Deals sheet using profile_id
        try {
          const dealsResponse = await fetch(`/api/deals?profile_id=${encodeURIComponent(profileId)}`)
          const dealsData = await dealsResponse.json()
          
          if (dealsResponse.ok && dealsData.deals && Array.isArray(dealsData.deals)) {
            setDeals(dealsData.deals)
            console.log(`✅ Loaded ${dealsData.deals.length} deals for profile ${profileId}`)
          } else {
            console.warn("No deals found or error fetching deals:", dealsData)
            setDeals([])
          }
        } catch (dealError) {
          console.error("Error fetching deals:", dealError)
          setDeals([])
        }
      } else {
        console.warn("No profile ID found, cannot fetch signals or deals")
        setSignals([])
        setDeals([])
      }
    } catch (error) {
      console.error("Error fetching client data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    // Initialize edit data with current client values
    setEditData({
      name: client?.name || client?.["name"] || "",
      email: client?.email || client?.["email"] || "",
      role: client?.role || client?.["role"] || selectedRole,
      company: client?.company || client?.["company"] || "",
      industries: client?.industries || client?.["industries"] || "",
      project_size: client?.project_size || client?.["project_size"] || "",
      raise_amount: client?.raise_amount || client?.["raise_amount"] || "",
      check_size: client?.check_size || client?.["check_size"] || "",
      active_raise_amount: client?.active_raise_amount || client?.["active_raise_amount"] || "",
      goals: client?.goals || client?.["goals"] || "",
      regions: client?.regions || client?.["regions"] || "",
      partner_types: client?.partner_types || client?.["partner_types"] || "",
      constraints_notes: client?.constraints_notes || client?.["constraints_notes"] || client?.constraints || client?.["constraints"] || "",
      active_deal: client?.active_deal || client?.["active_deal"] || "",
      travel_cities: client?.travel_cities || client?.["travel_cities"] || client?.city || client?.["city"] || "",
    })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditData({})
  }

  const handleSave = async () => {
    if (!client) return

    const clientId = client.id || client.ID || client["id"] || client["ID"]
    if (!clientId) {
      alert("Cannot save: Client ID not found")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/airtable/clients/${clientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update client")
      }

      // Update local client state
      setClient(data.client)
      setIsEditing(false)
      setEditData({})
      
      // Update role if it was changed
      if (editData.role) {
        setSelectedRole(editData.role)
      }

      alert("Profile updated successfully!")
    } catch (error) {
      console.error("Error saving client:", error)
      alert(`Failed to save: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleStageChange = async (dealId, newStage) => {
    if (!dealId) {
      console.error("Cannot update: Deal ID not found")
      return
    }

    setUpdatingStage(dealId)
    try {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stage: newStage }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update deal stage")
      }

      // Update local deals state
      setDeals(prevDeals => 
        prevDeals.map(deal => {
          const id = deal.deal_id || deal["deal_id"] || deal.id || deal["id"]
          if (id && String(id).trim() === String(dealId).trim()) {
            return { ...deal, stage: newStage }
          }
          return deal
        })
      )

      console.log(`✅ Deal stage updated to: ${newStage}`)
    } catch (error) {
      console.error("Error updating deal stage:", error)
      alert(`Failed to update stage: ${error.message}`)
    } finally {
      setUpdatingStage(null)
    }
  }

  const handleCreateDeal = async () => {
    if (!client) {
      alert("Client data not available")
      return
    }

    const profileId = client.id || client.ID || client["id"] || client["ID"]
    if (!profileId) {
      alert("Cannot create deal: Client ID not found")
      return
    }

    setCreatingDeal(true)
    try {
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_id: profileId,
          deal_name: dealFormData.deal_name,
          target: dealFormData.target,
          source: dealFormData.source,
          stage: dealFormData.stage,
          target_deal_size: dealFormData.target_deal_size,
          next_step: dealFormData.next_step,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create deal")
      }

      // Refresh deals list
      const dealsResponse = await fetch(`/api/deals?profile_id=${encodeURIComponent(profileId)}`)
      const dealsData = await dealsResponse.json()
      
      if (dealsResponse.ok && dealsData.deals && Array.isArray(dealsData.deals)) {
        setDeals(dealsData.deals)
      }

      // Close modal and reset form
      setShowCreateDealModal(false)
      setDealFormData({
        deal_name: '',
        target: '',
        source: '',
        stage: 'list',
        target_deal_size: '',
        next_step: ''
      })
      setSelectedSignal(null)

      alert("Deal created successfully!")
    } catch (error) {
      console.error("Error creating deal:", error)
      alert(`Failed to create deal: ${error.message}`)
    } finally {
      setCreatingDeal(false)
    }
  }

  const handleDeleteDeal = async (dealId) => {
    if (!dealId) {
      console.error("Cannot delete: Deal ID not found")
      toast.error("Deal ID not found")
      return
    }

    if (!client) {
      toast.error("Client data not available")
      return
    }

    const profileId = client.id || client.ID || client["id"] || client["ID"]
    if (!profileId) {
      toast.error("Cannot delete: Client ID not found")
      return
    }

    // Show confirmation toast with action buttons
    toast.warning("Delete Deal", {
      description: "Are you sure you want to delete this deal? This action cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          setDeletingDeal(dealId)
          const loadingToast = toast.loading("Deleting deal...")
          
          try {
            // Create abort controller for timeout
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

            const response = await fetch(`/api/deals/${dealId}`, {
              method: "DELETE",
              signal: controller.signal
            })

            clearTimeout(timeoutId)
            const data = await response.json()
            
            if (!response.ok) {
              throw new Error(data.error || data.details || "Failed to delete deal")
            }
            
            // Refresh deals list immediately
            const dealsResponse = await fetch(`/api/deals?profile_id=${encodeURIComponent(profileId)}`)
            const dealsData = await dealsResponse.json()
            
            if (dealsResponse.ok && dealsData.deals && Array.isArray(dealsData.deals)) {
              setDeals(dealsData.deals)
            }
            
            toast.success("Deal deleted successfully!", { id: loadingToast })
          } catch (error) {
            console.error("Error deleting deal:", error)
            if (error.name === 'AbortError') {
              toast.error("Delete request timed out. Please check if the deal was deleted.", { id: loadingToast })
            } else {
              toast.error(`Failed to delete deal: ${error.message}`, { id: loadingToast })
            }
          } finally {
            setDeletingDeal(null)
          }
        }
      },
      cancel: {
        label: "Cancel",
        onClick: () => {}
      },
      duration: 10000
    })
  }
console.log("signal",signals)
  // Get client name (check lowercase first, then uppercase)
  const clientName = client 
    ? (client.name || client["name"] || client["Full Name"] || client["Name"] || client.full_name || "Client")
    : "Hans Hammer"

  // Get client initials for avatar
  const getInitials = (name) => {
    if (!name) return "C"
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
console.log("client",client)
  // Get industries from client profile (check lowercase first)
  const getIndustries = () => {
    if (!client) return []
    const industries = client.industries || client["industries"] || client.Industries || client["Industries"] || ""
    
    if (Array.isArray(industries)) {
      return industries
    }
    
    if (typeof industries === "string" && industries.trim()) {
      // Split by semicolon and clean up whitespace
      return industries.split(";").map(item => item.trim()).filter(item => item.length > 0)
    }
    
    return []
  }

  // Get regions from client profile (check lowercase first)
  const getRegions = () => {
    if (!client) return []
    const regions = client.regions || client["regions"] || client.Regions || client["Regions"] || ""
    
    if (Array.isArray(regions)) {
      return regions
    }
    
    if (typeof regions === "string" && regions.trim()) {
      // Split by semicolon and clean up whitespace
      return regions.split(";").map(item => item.trim()).filter(item => item.length > 0)
    }
    
    return []
  }

  // Get partner types from client profile (check lowercase first)
  const getPartnerTypes = () => {
    if (!client) return []
    const partnerTypes = client.partner_types || client["partner_types"] || client.Partner_types || client["Partner_types"] || client["Partner Types"] || ""
    
    if (Array.isArray(partnerTypes)) {
      return partnerTypes
    }
    
    if (typeof partnerTypes === "string" && partnerTypes.trim()) {
      // Split by semicolon and clean up whitespace
      return partnerTypes.split(";").map(item => item.trim()).filter(item => item.length > 0)
    }
    
    return []
  }

  // Get goals from client profile (check lowercase first)
  const getGoals = () => {
    if (!client) return []
    const goals = client.goals || client["goals"] || client.Goals || client["Goals"] || ""
    if (typeof goals === "string") {
      // Split by common delimiters if it's a string
      return goals.split(/[,\n]/).filter(g => g.trim()).map(g => g.trim())
    }
    return Array.isArray(goals) ? goals : []
  }

  // Map signal_type to industry badge
  const getIndustryBadge = (signalType, category) => {
    const type = signalType?.toLowerCase() || ""
    if (type.includes("real estate") || type.includes("infrastructure")) {
      return { bg: "bg-[#e8dcc8]", text: "text-[#8b6f3e]", label: "🏗 Real Estate & Infrastructure" }
    }
    if (type.includes("renewable") || type.includes("energy")) {
      return { bg: "bg-[#f0e8d0]", text: "text-[#8b7537]", label: "⚡ Renewable Energy" }
    }
    if (type.includes("finance") || type.includes("equity")) {
      return { bg: "bg-[#e8d8c8]", text: "text-[#8b5f3e]", label: "💼 Finance & Private Equity" }
    }
    return { bg: "bg-[#e8dcc8]", text: "text-[#8b6f3e]", label: category || signalType || "Other" }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0a3d3d]" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Client not found</h2>
          <Button onClick={() => router.push("/")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-[284px] bg-[#03171a] text-white p-6 flex flex-col overflow-y-auto z-50 transition-transform duration-300 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="mb-8">
            <KolosLogo/>
        </div>

        <nav className="space-y-1 flex-1 text-[16px] font-hedvig">
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 transition-colors">
            <span className="text-[#c9a961]">◫</span>
            <span>Dashboard</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 transition-colors">
            <span className="text-[#c9a961]">◎</span>
            <span>Business Goals</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 transition-colors">
            <span className="text-[#c9a961]">⊟</span>
            <span>Live Private Deal Flow</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 transition-colors">
            <span className="text-[#c9a961]">◇</span>
            <span>Industry Focus</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 transition-colors">
            <span className="text-[#c9a961]">⊙</span>
            <span>Business Requests</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 transition-colors">
            <span className="text-[#c9a961]">⚭</span>
            <span>Business Match</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 transition-colors">
            <span className="text-[#c9a961]">✈</span>
            <span>Travel Planning</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 transition-colors">
            <span className="text-[#c9a961]">⊟</span>
            <span>Upcoming Events</span>
          </a>
        </nav>

        <div className="border-t border-gray-600 pt-4 mt-4 space-y-3">
          <div className="text-sm">
            <div className="text-gray-400 mb-1">Your OPM Cohort</div>
            <div className="font-semibold">42</div>
          </div>
          <div className="text-sm">
            <div className="text-gray-400 mb-1">Your primary location</div>
            <div className="font-semibold text-xs">Washington DC, USA 20852</div>
          </div>
          <div className="text-sm">
            <div className="text-gray-400 mb-1">Live Virtual Assistant</div>
            <div className="text-xs">Not available under Basic</div>
          </div>
        </div>

        <div className="border-t border-gray-600 pt-4 mt-4 space-y-2">
          <a href="#" className="block text-sm hover:text-[#c9a961] transition-colors">OPM WA Group</a>
          <a href="#" className="block text-sm hover:text-[#c9a961] transition-colors">Updates & FAQ</a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-[284px] bg-[#f5f3f0]">
        <div className="max-w-[1400px] mx-auto">
          {/* Header - Fixed */}
          <div className="sticky top-0 bg-[#f5f3f0] z-20 border-b border-gray-200 shadow-sm">
            <div className="flex justify-between items-center p-4 lg:p-8 pb-4">
            <div className="flex items-center gap-2 lg:gap-4 flex-1 min-w-0">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden flex items-center gap-2 text-[#0a3d3d] hover:bg-[#0a3d3d]/10"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="hidden sm:flex items-center gap-2 text-[#0a3d3d] hover:bg-[#0a3d3d]/10"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden md:inline">Back to Dashboard</span>
              </Button>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-serif text-[#0a3d3d] truncate">{clientName} Dashboard</h1>
            </div>
            <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-[#0a3d3d] hover:bg-[#0a3d3d]/90 text-white"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    disabled={saving}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleEdit}
                  className="flex items-center gap-2 bg-[#c9a961] hover:bg-[#c9a961]/90 text-[#0a3d3d]"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </Button>
              )}
              <Avatar className="h-10 w-10 lg:h-12 lg:w-12">
                <AvatarImage src="/placeholder-avatar.jpg" alt={clientName} />
                <AvatarFallback>{getInitials(clientName)}</AvatarFallback>
              </Avatar>
            </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4 sm:p-6 lg:p-8 pt-4">
          {/* Basic Information */}
          {isEditing && (
            <section className="mb-8">
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="p-6">
                  <h2 className="text-lg sm:text-xl font-serif text-[#c9a961] mb-4">Basic Information</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        value={editData.name || ""}
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={editData.email || ""}
                        onChange={(e) => setEditData({...editData, email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                        placeholder="your.email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Constraints Notes</label>
                      <textarea
                        value={editData.constraints_notes || ""}
                        onChange={(e) => setEditData({...editData, constraints_notes: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[80px]"
                        placeholder="Any constraints or preferences"
                      />
                    </div>
                    {/* Project Size - Only for Entrepreneur or Facilitator */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showProjectSize = roleNormalized !== "investor" && roleNormalized !== "asset manager";
                      
                      if (!showProjectSize) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Project Size</label>
                          <input
                            type="text"
                            value={editData.project_size || ""}
                            onChange={(e) => setEditData({...editData, project_size: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                            placeholder="e.g., 10-50 million"
                          />
                        </div>
                      );
                    })()}
                    {/* Raise Amount - Only for Entrepreneur or Facilitator */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showRaiseAmount = roleNormalized !== "investor" && roleNormalized !== "asset manager";
                      
                      if (!showRaiseAmount) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Raise Amount</label>
                          <input
                            type="text"
                            value={editData.raise_amount || ""}
                            onChange={(e) => setEditData({...editData, raise_amount: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                            placeholder="e.g., 5 million"
                          />
                        </div>
                      );
                    })()}
                    {/* Check Size - Only for Investor or Asset Manager */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showCheckSize = roleNormalized === "investor" || roleNormalized === "asset manager";
                      
                      if (!showCheckSize) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Check Size</label>
                          <input
                            type="text"
                            value={editData.check_size || ""}
                            onChange={(e) => setEditData({...editData, check_size: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                            placeholder="e.g., 5-15 million"
                          />
                        </div>
                      );
                    })()}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Active Raise Amount</label>
                      <input
                        type="text"
                        value={editData.active_raise_amount || ""}
                        onChange={(e) => setEditData({...editData, active_raise_amount: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                        placeholder="e.g., 2 million"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
          {/* Select Your Role */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-serif text-[#c9a961] mb-4">Select Your Role</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 font-hedvig">
              {["Investor", "Entrepreneur", "Asset Manager", "Facilitator"].map((role) => (
                <Button
                  key={role}
                  onClick={() => {
                    setSelectedRole(role)
                    if (isEditing) {
                      setEditData({...editData, role: role})
                    }
                  }}
                  className={`rounded-full py-4 lg:py-6 text-sm lg:text-base ${
                    (isEditing ? editData.role : selectedRole) === role
                      ? "bg-[#0a3d3d] hover:bg-[#0a3d3d]/90 text-white"
                      : "bg-[#c9a961] hover:bg-[#c9a961]/90 text-[#0a3d3d]"
                  }`}
                >
                  {role}
                </Button>
              ))}
            </div>
          </section>

          {/* Client Information Card */}
          <section className="mb-8">
            <Card className="bg-white border-none shadow-sm">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                  {/* Check Size - Only for Investor or Asset Manager */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showCheckSize = roleNormalized === "investor" || roleNormalized === "asset manager";
                    
                    if (!showCheckSize) return null;
                    
                    return (
                      <div>
                        <div className="text-sm text-gray-500 mb-2">Check Size</div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.check_size || ""}
                            onChange={(e) => setEditData({...editData, check_size: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-lg font-semibold text-[#0a3d3d]"
                            placeholder="e.g., 5-15 million"
                          />
                        ) : (
                          <div className="text-lg font-semibold text-[#0a3d3d]">
                            {client?.check_size || client?.["check_size"] ? <>{client?.check_size || client?.["check_size"]} M</> : "-"}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Project Size - Only for Entrepreneur or Facilitator */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showProjectSize = roleNormalized !== "investor" && roleNormalized !== "asset manager";
                    
                    if (!showProjectSize) return null;
                    
                    return (
                      <div>
                        <div className="text-sm text-gray-500 mb-2">Project Size</div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.project_size || ""}
                            onChange={(e) => setEditData({...editData, project_size: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-lg font-semibold text-[#0a3d3d]"
                            placeholder="e.g., 10-50 million"
                          />
                        ) : (
                          <div className="text-lg font-semibold text-[#0a3d3d]">
                            {client?.project_size || client?.["project_size"] ? <>{client?.project_size || client?.["project_size"]} M</> : "-"}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Raise Amount - Only for Entrepreneur or Facilitator */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showRaiseAmount = roleNormalized !== "investor" && roleNormalized !== "asset manager";
                    
                    if (!showRaiseAmount) return null;
                    
                    return (
                      <div>
                        <div className="text-sm text-gray-500 mb-2">Raise Amount</div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.raise_amount || ""}
                            onChange={(e) => setEditData({...editData, raise_amount: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-lg font-semibold text-[#0a3d3d]"
                            placeholder="e.g., 5 million"
                          />
                        ) : (
                          <div className="text-lg font-semibold text-[#0a3d3d]">
                            {client?.raise_amount || client?.["raise_amount"] ? <>{client?.raise_amount || client?.["raise_amount"]} M</> : "-"}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Active Raise Amount */}
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Active Raise Amount</div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.active_raise_amount || ""}
                        onChange={(e) => setEditData({...editData, active_raise_amount: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-lg font-semibold text-[#0a3d3d]"
                        placeholder="e.g., 2 million"
                      />
                    ) : (
                      <div className="text-lg font-semibold text-[#0a3d3d]">
                        {client?.active_raise_amount || client?.["active_raise_amount"] ? <>{client?.active_raise_amount || client?.["active_raise_amount"]} M</> : "-"}
                      </div>
                    )}
                  </div>

                  {/* Company */}
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Company</div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.company || ""}
                        onChange={(e) => setEditData({...editData, company: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-lg font-semibold text-[#0a3d3d]"
                        placeholder="Company name"
                      />
                    ) : (
                      <div className="text-lg font-semibold text-[#0a3d3d]">
                        {client?.company || client?.["company"] || client?.Company || client?.["Company"] || "-"}
                      </div>
                    )}
                  </div>

                  {/* Partner Types */}
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Partner Types</div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.partner_types || ""}
                        onChange={(e) => setEditData({...editData, partner_types: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-lg font-semibold text-[#0a3d3d]"
                        placeholder="e.g., LPs, Operators (separate with semicolons)"
                      />
                    ) : (
                      <div className="text-lg font-semibold text-[#0a3d3d]">
                        {getPartnerTypes().length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {getPartnerTypes().map((type, index) => (
                              <Badge 
                                key={index} 
                                className="bg-[#c9a961] text-[#0a3d3d] hover:bg-[#c9a961]/90"
                              >
                                {type}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Business Goals Overview */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">◎</span>
              Business Goals Overview
            </h2>
            {isEditing ? (
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Goals (one per line)</label>
                  <textarea
                    value={editData.goals || ""}
                    onChange={(e) => setEditData({...editData, goals: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[100px]"
                    placeholder="Enter your business goals, one per line"
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                {getGoals().slice(0, 2).map((goal, index) => (
                  <Card key={index} className="bg-white border-none shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-[#c9a961] flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="text-[#c9a961] text-sm">{index + 1}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#0a3d3d] mb-1">Goal {index + 1}</h3>
                          <p className="text-gray-600">{goal}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {getGoals().length === 0 && (
                  <>
                    <Card className="bg-white border-none shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full border-2 border-[#c9a961] flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-[#c9a961] text-sm">i</span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-[#0a3d3d] mb-1">No goals set</h3>
                            <p className="text-gray-600">Goals will appear here when available</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Live Private Deal Flow */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">⊟</span>
              Signals
            </h2>
            <Card className="bg-white border-none shadow-sm">
              <CardContent className="p-4 sm:p-6">
                {signals.length > 0 ? (
                  <div className="space-y-4 lg:space-y-6 max-h-[600px] overflow-y-auto pr-2">
                    {signals.map((signal, index) => {
                      const badge = getIndustryBadge(signal.signal_type, signal.category)
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 sm:p-6 space-y-4 hover:shadow-md transition-shadow">
                          {/* Header Row */}
                          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-[#0a3d3d] text-base sm:text-lg mb-2 break-words">
                                {signal.headline_source || `Signal ${index + 1}`}
                              </h3>
                              {signal.url && (
                                <a 
                                  href={signal.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-[#c9a961] hover:underline inline-flex items-center gap-1"
                                >
                                  <span>View Source</span>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {signal.overall && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500">Overall:</span>
                                  <Badge className="bg-[#0a3d3d] text-white">
                                    {signal.overall}/5
                                  </Badge>
                                </div>
                              )}
                              <Badge className={`${badge.bg} ${badge.text}`}>
                                {badge.label}
                              </Badge>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm">
                            <div>
                              <div className="text-gray-500 mb-1">Date</div>
                              <div className="font-medium text-[#0a3d3d]">
                                {signal.date ? new Date(signal.date).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                }) : '-'}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500 mb-1">Signal Type</div>
                              <div className="font-medium text-[#0a3d3d] capitalize">
                                {signal.signal_type || '-'}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500 mb-1">Category</div>
                              <div className="font-medium text-[#0a3d3d]">
                                {signal.category ? signal.category.replace("_opportunity", "").replace(/_/g, " ") : '-'}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500 mb-1">Scores (R,O,A)</div>
                              <div className="font-medium text-[#0a3d3d]">
                                {signal.scores_R_O_A || '-'}
                              </div>
                            </div>
                          </div>

                          {/* Next Step */}
                          {signal.next_step && (
                            <div className="pt-4 border-t border-gray-200">
                              <div className="text-gray-500 mb-2 text-sm font-medium">Next Step</div>
                              <div className="text-[#0a3d3d] bg-[#f5f3f0] p-3 rounded-md">
                                {signal.next_step}
                              </div>
                            </div>
                          )}

                          {/* Create Deal Button */}
                          <div className="pt-4 border-t border-gray-200">
                            <Button
                              onClick={() => {
                                setSelectedSignal(signal)
                                setDealFormData({
                                  deal_name: signal.headline_source || '',
                                  target: '',
                                  source: signal.url || '',
                                  stage: 'list',
                                  target_deal_size: '',
                                  next_step: signal.next_step || ''
                                })
                                setShowCreateDealModal(true)
                              }}
                              className="bg-[#0a3d3d] hover:bg-[#0a3d3d]/90 text-white"
                            >
                              Create Deal
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No signals available. Recommendations will appear here once generated.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Active Deals */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">💼</span>
              Active Deals
            </h2>
            <Card className="bg-white border-none shadow-sm">
              <CardContent className="p-4 sm:p-6">
                {deals.length > 0 ? (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto -mx-4 sm:mx-0">
                    <table className="w-full border-collapse min-w-[800px]">
                      <thead className="sticky top-0 bg-white z-20">
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white">Deal Name</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white hidden md:table-cell">Target</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white hidden lg:table-cell">Source</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white">Stage</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white hidden lg:table-cell">Target Deal Size</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white hidden xl:table-cell">Next Step</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deals.map((deal, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-[#0a3d3d] font-medium">
                              {deal.deal_name || deal["deal_name"] || "-"}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700 hidden md:table-cell">
                              {deal.target || deal["target"] || "-"}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700 hidden lg:table-cell">
                              {deal.source || deal["source"] || "-"}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {(() => {
                                const dealId = deal.deal_id || deal["deal_id"] || deal.id || deal["id"]
                                const currentStage = deal.stage || deal["stage"] || "list"
                                const isUpdating = updatingStage === dealId
                                
                                return (
                                  <select
                                    value={currentStage}
                                    onChange={(e) => handleStageChange(dealId, e.target.value)}
                                    disabled={isUpdating || !dealId}
                                    style={{ 
                                      minWidth: '120px',
                                      zIndex: 1,
                                      position: 'relative'
                                    }}
                                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md border-2 border-gray-300 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] focus:border-[#0a3d3d] ${
                                      currentStage === "closed" 
                                        ? "bg-green-100 text-green-800 border-green-300"
                                        : currentStage === "in negotiation"
                                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                        : currentStage === "NDA signed"
                                        ? "bg-blue-100 text-blue-800 border-blue-300"
                                        : currentStage === "intro"
                                        ? "bg-purple-100 text-purple-800 border-purple-300"
                                        : currentStage === "first call"
                                        ? "bg-orange-100 text-orange-800 border-orange-300"
                                        : "bg-gray-100 text-gray-800 border-gray-300"
                                    } ${isUpdating ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-[#0a3d3d]"}`}
                                  >
                                    <option value="list" style={{ backgroundColor: '#f3f4f6', color: '#1f2937' }}>list</option>
                                    <option value="intro" style={{ backgroundColor: '#f3e8ff', color: '#6b21a8' }}>intro</option>
                                    <option value="first call" style={{ backgroundColor: '#fff7ed', color: '#9a3412' }}>first call</option>
                                    <option value="NDA signed" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>NDA signed</option>
                                    <option value="in negotiation" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>in negotiation</option>
                                    <option value="closed" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>closed</option>
                                  </select>
                                )
                              })()}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700 hidden lg:table-cell">
                              {deal.target_deal_size || deal["target_deal_size"] || "-"}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 hidden xl:table-cell">
                              {deal.next_step || deal["next_step"] || "-"}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">
                              {(() => {
                                const dealId = deal.deal_id || deal["deal_id"] || deal.id || deal["id"]
                                const isDeleting = deletingDeal === dealId
                                
                                return (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteDeal(dealId)}
                                    disabled={isDeleting || !dealId}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                )
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No active deals. Deals will appear here once created.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Industry & Geographic Focus */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">◇</span>
              Industry & Geographic Focus
            </h2>
            {isEditing ? (
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Industries (separate with semicolons)</label>
                    <input
                      type="text"
                      value={editData.industries || ""}
                      onChange={(e) => setEditData({...editData, industries: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                      placeholder="e.g., Tech; Healthcare; Finance"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Regions (separate with semicolons)</label>
                    <input
                      type="text"
                      value={editData.regions || ""}
                      onChange={(e) => setEditData({...editData, regions: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                      placeholder="e.g., US; Europe; MENA"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-3 flex-wrap">
                {getIndustries().map((industry, index) => (
                  <Badge key={index} className="bg-[#e8dcc8] text-[#8b6f3e] hover:bg-[#e8dcc8] px-4 py-2">
                    {industry}
                  </Badge>
                ))}
                {getRegions().map((region, index) => (
                  <Badge key={`region-${index}`} className="bg-[#d0e8e8] text-[#3e6b8b] hover:bg-[#d0e8e8] px-4 py-2">
                    🌎 {region}
                  </Badge>
                ))}
                {getIndustries().length === 0 && getRegions().length === 0 && (
                  <p className="text-gray-500 text-sm">No industries or regions specified</p>
                )}
              </div>
            )}
          </section>

          <div className="mb-8">
            {/* Business Requests */}
            <section className="mb-8">
              <h2 className="text-lg sm:text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
                <span className="text-[#c9a961]">⊞</span>
                <span className="break-words">{clientName}'s Business Requests</span>
              </h2>
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Active Deal/Project</label>
                        <textarea
                          value={editData.active_deal || ""}
                          onChange={(e) => setEditData({...editData, active_deal: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[80px]"
                          placeholder="Describe your active deal or project"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Travel Cities</label>
                        <input
                          type="text"
                          value={editData.travel_cities || ""}
                          onChange={(e) => setEditData({...editData, travel_cities: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                          placeholder="e.g., New York, London, Dubai"
                        />
                      </div>
                    </div>
                  ) : (
                    client.active_deal || client["active_deal"] || client.Active_deal || client["Active_deal"] ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 pb-2 border-b text-sm text-gray-600 font-medium">
                          <div className="col-span-1 sm:col-span-5">Request</div>
                          <div className="col-span-1 sm:col-span-4">Location</div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center py-3">
                          <div className="col-span-1 sm:col-span-5">
                            <div className="font-semibold">Active Deal/Project</div>
                            <div className="text-sm text-gray-600 break-words">{client.active_deal || client["active_deal"] || client.Active_deal || client["Active_deal"]}</div>
                          </div>
                          <div className="col-span-1 sm:col-span-4 text-sm break-words">
                            {client.travel_cities || client["travel_cities"] || client["Travel Cities"] || client.city || client["city"] || client["City"] || client.regions?.[0] || client["Regions"]?.[0] || "-"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No active deals or projects</p>
                    )
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Potential Business Matches */}
            <section>
              <h2 className="text-lg sm:text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
                <span className="text-[#c9a961]">⚭</span>
                Potential Business Matches
              </h2>
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-4">
                    <div className="pb-2 border-b text-sm text-gray-600 font-medium">
                      Request
                    </div>

                    <div className="py-3 border-b border-gray-100">
                      <div className="font-semibold mb-1">High-net-worth investor</div>
                      <div className="text-sm text-gray-600">Interested in Texas multifamily assets</div>
                    </div>

                    <div className="py-3">
                      <div className="font-semibold mb-1">Institutional partner</div>
                      <div className="text-sm text-gray-600">Seeking US-based RE developments</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

          {/* OPM Travel Plans */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">✈</span>
              OPM Travel Plans
            </h2>
            <Card className="bg-white border-none shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="hidden sm:grid grid-cols-12 gap-4 pb-2 border-b text-sm text-gray-600 font-medium">
                    <div className="col-span-3">Customer</div>
                    <div className="col-span-2">OPM #</div>
                    <div className="col-span-4">Travel Plans</div>
                    <div className="col-span-3">Date</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start py-3 border-b border-gray-100">
                    <div className="col-span-1 sm:col-span-3 flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>VG</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">Vit Goncharuk/AI</span>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Badge className="bg-[#b8d8d8] text-[#0a3d3d] hover:bg-[#b8d8d8]">OPM62</Badge>
                    </div>
                    <div className="col-span-1 sm:col-span-4 text-sm">
                      <div>Washington → Miami</div>
                      <div>Washington → Finland</div>
                    </div>
                    <div className="col-span-1 sm:col-span-3 text-sm">
                      <div>February 21 - 23, 2025</div>
                      <div>February 27 - March 5, 2025</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start py-3 border-b border-gray-100">
                    <div className="col-span-1 sm:col-span-3 flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>ZZ</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">Zoe Zhao/Re</span>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Badge className="bg-[#b8d8d8] text-[#0a3d3d] hover:bg-[#b8d8d8]">OPM55</Badge>
                    </div>
                    <div className="col-span-1 sm:col-span-4 text-sm">
                      New York City → Barcelona/YPO Edge
                    </div>
                    <div className="col-span-1 sm:col-span-3 text-sm">
                      February 18 - 25, 2025
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start py-3">
                    <div className="col-span-1 sm:col-span-3 flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>HH</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">Hans Hammer</span>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Badge className="bg-[#b8d8d8] text-[#0a3d3d] hover:bg-[#b8d8d8]">OPM53</Badge>
                    </div>
                    <div className="col-span-1 sm:col-span-4 text-sm">
                      Germany → New York City
                    </div>
                    <div className="col-span-1 sm:col-span-3 text-sm">
                      February 18 - 25, 2025
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Upcoming Industry Events */}
          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">📅</span>
              Upcoming Industry Events
            </h2>
            <Card className="bg-white border-none shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="hidden sm:grid grid-cols-12 gap-4 pb-2 border-b text-sm text-gray-600 font-medium">
                    <div className="col-span-4">Event</div>
                    <div className="col-span-3">Industry</div>
                    <div className="col-span-3">Location</div>
                    <div className="col-span-2">Event Date</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start py-3 border-b border-gray-100">
                    <div className="col-span-1 sm:col-span-4 text-[#c9a961] font-semibold break-words">Ken Hersh Private Equity & Sports</div>
                    <div className="col-span-1 sm:col-span-3">
                      <Badge className="bg-[#e8d8c8] text-[#8b5f3e] hover:bg-[#e8d8c8]">💼 Finance & Privat Equity</Badge>
                    </div>
                    <div className="col-span-1 sm:col-span-3 text-sm">Virtual</div>
                    <div className="col-span-1 sm:col-span-2 text-sm">March 8, 2025 (11 AM ET)</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start py-3 border-b border-gray-100">
                    <div className="col-span-1 sm:col-span-4 font-semibold break-words">DFW State of the Market</div>
                    <div className="col-span-1 sm:col-span-3">
                      <Badge className="bg-[#e8dcc8] text-[#8b6f3e] hover:bg-[#e8dcc8]">🏗 Real Estate & Infrastructure</Badge>
                    </div>
                    <div className="col-span-1 sm:col-span-3 text-sm">Dallas, TX</div>
                    <div className="col-span-1 sm:col-span-2 text-sm">March 5, 2025</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start py-3 border-b border-gray-100">
                    <div className="col-span-1 sm:col-span-4 font-semibold break-words">IREI Spring Conference</div>
                    <div className="col-span-1 sm:col-span-3">
                      <Badge className="bg-[#e8dcc8] text-[#8b6f3e] hover:bg-[#e8dcc8]">🏗 Real Estate & Infrastructure</Badge>
                    </div>
                    <div className="col-span-1 sm:col-span-3 text-sm">Dallas, TX</div>
                    <div className="col-span-1 sm:col-span-2 text-sm">March 25 - 26, 2025</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-start py-3">
                    <div className="col-span-1 sm:col-span-4 font-semibold break-words">Global Energy Meet (GEM) 2025</div>
                    <div className="col-span-1 sm:col-span-3">
                      <Badge className="bg-[#f0e8d0] text-[#8b7537] hover:bg-[#f0e8d0]">⚡ Renewable Energy</Badge>
                    </div>
                    <div className="col-span-1 sm:col-span-3 text-sm">Houston, TX</div>
                    <div className="col-span-1 sm:col-span-2 text-sm">March 5-6, 2025</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
          </div>
        </div>

        {/* Create Deal Modal */}
        {showCreateDealModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-serif text-[#0a3d3d]">Create New Deal</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowCreateDealModal(false)
                      setDealFormData({
                        deal_name: '',
                        target: '',
                        source: '',
                        stage: 'list',
                        target_deal_size: '',
                        next_step: ''
                      })
                      setSelectedSignal(null)
                    }}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleCreateDeal(); }}
                  className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={dealFormData.deal_name}
                      onChange={(e) => setDealFormData({...dealFormData, deal_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                      placeholder="Enter deal name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target
                    </label>
                    <input
                      type="text"
                      value={dealFormData.target}
                      onChange={(e) => setDealFormData({...dealFormData, target: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                      placeholder="Enter target"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Source
                    </label>
                    <input
                      type="text"
                      value={dealFormData.source}
                      onChange={(e) => setDealFormData({...dealFormData, source: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                      placeholder="Enter source URL or name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stage *
                    </label>
                    <select
                      required
                      value={dealFormData.stage}
                      onChange={(e) => setDealFormData({...dealFormData, stage: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                    >
                      <option value="list">list</option>
                      <option value="intro">intro</option>
                      <option value="first call">first call</option>
                      <option value="NDA signed">NDA signed</option>
                      <option value="in negotiation">in negotiation</option>
                      <option value="closed">closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Deal Size
                    </label>
                    <input
                      type="text"
                      value={dealFormData.target_deal_size}
                      onChange={(e) => setDealFormData({...dealFormData, target_deal_size: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d]"
                      placeholder="e.g., $5M - $15M"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Next Step
                    </label>
                    <textarea
                      value={dealFormData.next_step}
                      onChange={(e) => setDealFormData({...dealFormData, next_step: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[100px]"
                      placeholder="Enter next step"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={creatingDeal}
                      className="flex-1 bg-[#0a3d3d] hover:bg-[#0a3d3d]/90 text-white"
                    >
                      {creatingDeal ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Creating...
                        </>
                      ) : (
                        "Create Deal"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateDealModal(false)
                        setDealFormData({
                          deal_name: '',
                          target: '',
                          source: '',
                          stage: 'list',
                          target_deal_size: '',
                          next_step: ''
                        })
                        setSelectedSignal(null)
                      }}
                      disabled={creatingDeal}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0a3d3d]" />
      </div>
    }>
      <ClientDashboardContent />
    </Suspense>
  )
}
