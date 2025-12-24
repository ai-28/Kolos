"use client"

import { useState, useEffect, Suspense } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import {KolosLogo} from "@/app/components/svg"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Edit2, Save, X, Trash2, Menu, Linkedin, Mail } from "lucide-react"
import { toast } from "sonner"
import { DashboardIcon, BusinessGoalsIcon,SignalsIcon, IndustryFocusIcon, BusinessMatchIcon, BusinessRequestsIcon,TravelPlanIcon, UpcomingEventIcon } from "@/app/components/svg"
import Image from "next/image"
import { normalizeRole } from "@/app/lib/roleUtils"

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
  const [updatingDeal, setUpdatingDeal] = useState(false)
  const [editingDeal, setEditingDeal] = useState(null)
  const [deletingDeal, setDeletingDeal] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showLinkedInModal, setShowLinkedInModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedDealForModal, setSelectedDealForModal] = useState(null)

  useEffect(() => {
    // Get client ID from session and fetch client data
    fetchClientData()
  }, [])

  // Check for activate_signal parameter from email "Activate Kolos" button
  // Best practice: Check URL params first, then sessionStorage as fallback
  useEffect(() => {
    // First check URL params (if Supabase preserved them)
    let activateSignalParam = searchParams.get('activate_signal')
    
    // Fallback: Check sessionStorage (stored before clicking magic link)
    // sessionStorage is better than localStorage for auth flow data (clears on tab close)
    if (!activateSignalParam && typeof window !== 'undefined') {
      activateSignalParam = sessionStorage.getItem('kolos_activate_signal')
      if (activateSignalParam) {
        console.log('📧 Found signal data in sessionStorage')
        // Remove from sessionStorage after reading (so it only triggers once)
        sessionStorage.removeItem('kolos_activate_signal')
      }
    }
    
    if (activateSignalParam) {
      console.log('📧 Processing activate_signal:', {
        hasParam: !!activateSignalParam,
        paramLength: activateSignalParam.length,
        signalsLoaded: signals.length,
        source: searchParams.get('activate_signal') ? 'URL' : 'sessionStorage',
      })
      
      try {
        const signalData = JSON.parse(decodeURIComponent(activateSignalParam))
        console.log('📧 Parsed signal data:', signalData)
        
        // Find matching signal in the signals array or use the provided data
        // Don't wait for signals to load - use the data directly
        const matchingSignal = signals.length > 0 ? signals.find(s => 
          s.headline_source === signalData.headline_source && 
          s.date === signalData.date
        ) : null
        
        const signalToUse = matchingSignal || signalData
        console.log('📧 Using signal:', signalToUse)
        
        // Set the signal and open the deal modal
        setSelectedSignal(signalToUse)
        setShowCreateDealModal(true)
        console.log('✅ Deal modal opened with signal data')
        
        // Pre-fill deal form with signal data
        setDealFormData({
          deal_name: signalData.headline_source || '',
          target: '',
          source: signalData.url || '',
          stage: 'list',
          target_deal_size: signalData.estimated_target_value_USD || '',
          next_step: signalData.next_step || ''
        })
        
        // Remove the parameter from URL (clean up)
        if (searchParams.get('activate_signal')) {
          router.replace('/client/dashboard', { scroll: false })
        }
      } catch (error) {
        console.error('❌ Error parsing activate_signal:', error)
        console.error('Raw param:', activateSignalParam)
      }
    }
  }, [searchParams, signals, router])

  const fetchClientData = async () => {
    try {
      setLoading(true)
      
      // Get session to get client_id
      const sessionResponse = await fetch('/api/auth/session')
      const sessionData = await sessionResponse.json()
      
      if (!sessionResponse.ok || !sessionData.clientId) {
        // Not authenticated, redirect to home/login
        router.push('/')
        return
      }

      const clientId = sessionData.clientId
      
      // Fetch client data
      const response = await fetch(`/api/airtable/clients/${clientId}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Unauthorized, redirect to home/login
          router.push('/')
          return
        }
        throw new Error(data.error || "Failed to fetch client")
      }

      const clientData = data.client
      setClient(clientData)
      
      // Set default role from client profile and normalize it
      const clientRole = clientData.role || clientData.Role || clientData["role"] || clientData["Role"] || "Investor"
      const normalizedRole = normalizeRole(clientRole)
      setSelectedRole(normalizedRole)
      
      // Fetch signals - API now uses session automatically
      try {
        const signalsResponse = await fetch('/api/signals')
        const signalsData = await signalsResponse.json()
        
        if (signalsResponse.ok && signalsData.signals && Array.isArray(signalsData.signals)) {
          setSignals(signalsData.signals)
          console.log(`✅ Loaded ${signalsData.signals.length} signals`)
        } else {
          if (signalsResponse.status === 401) {
            router.push('/')
            return
          }
          console.warn("No signals found or error fetching signals:", signalsData)
          setSignals([])
        }
      } catch (signalError) {
        console.error("Error fetching signals:", signalError)
        setSignals([])
      }

      // Fetch deals - API now uses session automatically
      try {
        const dealsResponse = await fetch('/api/deals')
        const dealsData = await dealsResponse.json()
        
        if (dealsResponse.ok && dealsData.deals && Array.isArray(dealsData.deals)) {
          setDeals(dealsData.deals)
          console.log(`✅ Loaded ${dealsData.deals.length} deals`)
        } else {
          if (dealsResponse.status === 401) {
            router.push('/')
            return
          }
          console.warn("No deals found or error fetching deals:", dealsData)
          setDeals([])
        }
      } catch (dealError) {
        console.error("Error fetching deals:", dealError)
        setDeals([])
      }
    } catch (error) {
      console.error("Error fetching client data:", error)
      router.push('/')
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
      strategy_focus: client?.strategy_focus || client?.["strategy_focus"] || "",
      business_stage: client?.business_stage || client?.["business_stage"] || "",
      revenue_range: client?.revenue_range || client?.["revenue_range"] || "",
      facilitator_clients: client?.facilitator_clients || client?.["facilitator_clients"] || "",
      deal_type: client?.deal_type || client?.["deal_type"] || "",
      deal_size: client?.deal_size || client?.["deal_size"] || "",
      ideal_ceo_profile: client?.ideal_ceo_profile || client?.["ideal_ceo_profile"] || "",
      ideal_intro: client?.ideal_intro || client?.["ideal_intro"] || "",
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
    setCreatingDeal(true)
    try {
      console.log('📝 Creating deal with data:', dealFormData)
      
      // Include signal data for Apollo enrichment (company name, decision maker info)
      const dealPayload = {
        deal_name: dealFormData.deal_name,
        target: dealFormData.target,
        source: dealFormData.source,
        stage: dealFormData.stage,
        target_deal_size: dealFormData.target_deal_size,
        next_step: dealFormData.next_step,
      };

      // If we have a selected signal, include its data for Apollo to extract company/decision maker info
      if (selectedSignal) {
        dealPayload.headline_source = selectedSignal.headline_source || '';  // Signal headline - important for extraction
        dealPayload.company_name = selectedSignal.company_name || selectedSignal.company || '';
        dealPayload.decision_maker_name = selectedSignal.decision_maker_name || '';
        dealPayload.decision_maker_role = selectedSignal.decision_maker_role || '';
        dealPayload.decision_maker_linkedin_url = selectedSignal.decision_maker_linkedin_url || selectedSignal.linkedin_url || '';
      }

      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dealPayload),
      })

      const data = await response.json()
      console.log('📥 API Response:', data)

      if (!response.ok) {
        const errorMessage = data.error || data.details || "Failed to create deal"
        console.error('❌ Deal creation failed:', {
          status: response.status,
          error: errorMessage,
          fullResponse: data
        })
        throw new Error(errorMessage)
      }

      // Check Apollo enrichment status
      if (data.apollo_enrichment) {
        console.log('🔍 Apollo enrichment status:', data.apollo_enrichment)
        if (data.apollo_error) {
          console.error('❌ Apollo error:', data.apollo_error)
        }
        if (data.apollo_debug) {
          console.log('🔍 Apollo debug info:', data.apollo_debug)
          console.log('📝 LLM extraction:', data.apollo_debug.llm_result)
          console.log('📝 Pattern matching:', data.apollo_debug.pattern_match_result)
          console.log('📝 Final company name:', data.apollo_debug.final_company_name)
          console.log('📝 Input data:', data.apollo_debug.input_data)
        }
        if (data.decision_maker) {
          console.log('✅ Decision maker found:', data.decision_maker)
        } else {
          console.log('⚠️ No decision maker data returned')
          if (data.apollo_debug) {
            console.warn('⚠️ Debug info available - check LLM extraction results above')
          }
        }
      }

      // Refresh deals list
      console.log('🔄 Refreshing deals list...')
      const dealsResponse = await fetch('/api/deals')
      const dealsData = await dealsResponse.json()
      
      console.log('📊 Deals response:', {
        ok: dealsResponse.ok,
        count: dealsData.deals?.length || 0,
        deals: dealsData.deals
      })
      
      if (dealsResponse.ok && dealsData.deals && Array.isArray(dealsData.deals)) {
        setDeals(dealsData.deals)
        console.log(`✅ Loaded ${dealsData.deals.length} deals`)
      } else {
        console.warn('⚠️ Failed to refresh deals or no deals returned')
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

      // Show success message with Apollo status
      let successMessage = "Deal created successfully!"
      if (data.apollo_enrichment === "completed" && data.decision_maker) {
        successMessage += `\n\n✅ Decision Maker Found:\n- Name: ${data.decision_maker.name || 'N/A'}\n- Role: ${data.decision_maker.role || 'N/A'}\n- Email: ${data.decision_maker.email || 'N/A'}`
      } else if (data.apollo_enrichment === "failed") {
        successMessage += "\n\n⚠️ Deal created but Apollo enrichment failed. Check server logs for details."
      } else if (data.apollo_enrichment === "not_configured") {
        successMessage += "\n\nℹ️ Apollo API key not configured. Deal created without enrichment."
      }
      
      alert(successMessage)
    } catch (error) {
      console.error("❌ Error creating deal:", error)
      console.error("📝 Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      
      // Show detailed error message
      let errorMessage = `Failed to create deal: ${error.message}`
      if (error.message.includes('Unauthorized')) {
        errorMessage += '\n\nPlease make sure you are logged in.'
      } else if (error.message.includes('GOOGLE_SHEET_ID')) {
        errorMessage += '\n\nServer configuration error. Please contact support.'
      } else if (error.message.includes('append')) {
        errorMessage += '\n\nFailed to save to Google Sheets. Please check:\n1. Google Sheets permissions\n2. Sheet name "Deals" exists\n3. Column headers are correct'
      }
      
      alert(errorMessage)
    } finally {
      setCreatingDeal(false)
    }
  }

  const handleEditDeal = (deal) => {
    const dealId = deal.deal_id || deal["deal_id"] || deal.id || deal["id"]
    setEditingDeal(dealId)
    setDealFormData({
      deal_name: deal.deal_name || deal["deal_name"] || '',
      target: deal.target || deal["target"] || '',
      source: deal.source || deal["source"] || '',
      stage: deal.stage || deal["stage"] || 'list',
      target_deal_size: deal.target_deal_size || deal["target_deal_size"] || '',
      next_step: deal.next_step || deal["next_step"] || ''
    })
    setShowCreateDealModal(true)
  }

  const handleUpdateDeal = async () => {
    if (!editingDeal) return

    setUpdatingDeal(true)
    try {
      const response = await fetch(`/api/deals/${editingDeal}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        throw new Error(data.error || "Failed to update deal")
      }

      // Refresh deals list
      const dealsResponse = await fetch('/api/deals')
      const dealsData = await dealsResponse.json()
      
      if (dealsResponse.ok && dealsData.deals && Array.isArray(dealsData.deals)) {
        setDeals(dealsData.deals)
      }

      // Close modal and reset form
      setShowCreateDealModal(false)
      setEditingDeal(null)
      setDealFormData({
        deal_name: '',
        target: '',
        source: '',
        stage: 'list',
        target_deal_size: '',
        next_step: ''
      })
      setSelectedSignal(null)

      toast.success("Deal updated successfully!")
    } catch (error) {
      console.error("Error updating deal:", error)
      toast.error(`Failed to update deal: ${error.message}`)
    } finally {
      setUpdatingDeal(false)
    }
  }

  const handleDeleteDeal = async (dealId) => {
    if (!dealId) {
      console.error("Cannot delete: Deal ID not found")
      toast.error("Deal ID not found")
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
            const dealsResponse = await fetch('/api/deals')
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

  // Get OPM Travel Plans from client profile
  const getOPMTravelPlans = () => {
    if (!client) return []
    try {
      const travelPlansStr = client.opm_travel_plans || client["opm_travel_plans"] || client["OPM Travel Plans"] || client["OPM_travel_plans"] || ""
      if (!travelPlansStr || typeof travelPlansStr !== "string") return []
      
      const parsed = JSON.parse(travelPlansStr)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error("Error parsing OPM travel plans:", error)
      return []
    }
  }
  console.log("client", client)

  // Get Upcoming Industry Events from client profile
  const getUpcomingIndustryEvents = () => {
    if (!client) return []
    try {
      const eventsStr = client.upcoming_industry_events || client["upcoming_industry_events"] || client["Upcoming Industry Events"] || client["Upcoming_industry_events"] || ""
      if (!eventsStr || typeof eventsStr !== "string") return []
      
      const parsed = JSON.parse(eventsStr)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error("Error parsing upcoming industry events:", error)
      return []
    }
  }

  // Helper function to get initials from customer name
  const getCustomerInitials = (customerName) => {
    if (!customerName) return "??"
    const parts = customerName.split(/[\/\s]/).filter(p => p.trim())
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return customerName.substring(0, 2).toUpperCase()
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
    <div className="flex min-h-screen font-montserrat">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-[280px] sm:w-[284px] bg-[#03171a] text-white p-4 sm:p-6 flex flex-col overflow-y-auto z-50 transition-transform duration-300 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="mb-6 sm:mb-8">
            <KolosLogo/>
        </div>

        <nav className="space-y-1 flex-1 text-sm sm:text-[16px] font-marcellus">
          <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 rounded hover:bg-white/10 transition-colors min-h-[44px]">
              <DashboardIcon/>
            <span className="font-thin">Dashboard</span>
          </a>
          <a href="#business-goals" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 rounded hover:bg-white/10 transition-colors min-h-[44px]">
            <BusinessGoalsIcon/>
            <span>Business Goals</span>
          </a>
          <a href="#signals" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 rounded hover:bg-white/10 transition-colors min-h-[44px]">
            <SignalsIcon/>
            <span>Signals</span>
          </a>
          <a href="#industry-focus" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 rounded hover:bg-white/10 transition-colors min-h-[44px]">
            <IndustryFocusIcon/>
            <span>Industry Focus</span>
          </a>
          {/* <a href="#business-requests" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 rounded hover:bg-white/10 transition-colors min-h-[44px]">
            <BusinessRequestsIcon/>
            <span>Business Requests</span>
          </a>
          <a href="#business-matches" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 rounded hover:bg-white/10 transition-colors min-h-[44px]">
            <BusinessMatchIcon/>
            <span>Business Match</span>
          </a> */}
          <a href="#opm-travel-plans" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 rounded hover:bg-white/10 transition-colors min-h-[44px]">
            <TravelPlanIcon/>
            <span>Travel Planning</span>
          </a>
          <a href="#upcoming-industry-events" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 rounded hover:bg-white/10 transition-colors min-h-[44px]">
            <UpcomingEventIcon/>
            <span>Upcoming Events</span>
          </a>
        </nav>

        {/* <div className="border-t border-gray-600 pt-3 sm:pt-4 mt-3 sm:mt-4 space-y-2 sm:space-y-3">
          <div className="text-xs sm:text-sm">
            <div className="text-gray-400 mb-1">Your Havard OPM Cohort</div>
            <div className="font-semibold">59</div>
          </div>
          <div className="text-xs sm:text-sm">
            <div className="text-gray-400 mb-1">Your primary location</div>
            <div className="font-semibold text-xs">Dallas, TX, USA 75093</div>
          </div>
          <div className="text-xs sm:text-sm">
            <div className="text-gray-400 mb-1">Live Virtual Assistant</div>
            <div className="text-xs">Not available under Basic</div>
          </div>
        </div> */}

        <div className="border-t border-gray-600 pt-3 sm:pt-4 mt-3 sm:mt-4 space-y-2 font-marcellus">
          <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="block text-xs sm:text-sm hover:text-[#c9a961] transition-colors min-h-[44px] flex items-center">Harvard OPM Group</a>
          <a href="#" onClick={() => setIsMobileMenuOpen(false)} className="block text-xs sm:text-sm hover:text-[#c9a961] transition-colors min-h-[44px] flex items-center">Updates & FAQ</a>
          <button 
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' })
                router.push('/')
              } catch (error) {
                console.error('Logout error:', error)
                router.push('/')
              }
            }}
            className="block text-xs sm:text-sm hover:text-[#c9a961] transition-colors min-h-[44px] flex items-center w-full text-left"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-[284px] bg-[#faf1dc] min-h-screen" style={{ scrollBehavior: 'smooth', scrollPaddingTop: '100px' }}>
        <div className="max-w-[1400px] mx-auto">
          {/* Header - Fixed */}
          <div className="sticky top-0 bg-[#faf1dc] z-20">
            <div className="sm:p-4 lg:pl-8 lg:pr-8 p-3">
              <div className="flex flex-col sm:flex-row items-center justify-between w-full">
            <div className="flex items-center gap-2 lg:gap-4 flex-1 min-w-0 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden flex items-center gap-2 text-[#0a3d3d] hover:bg-[#0a3d3d]/10 min-w-[44px] min-h-[44px] flex-shrink-0"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="hidden sm:flex items-center gap-2 text-[#0a3d3d] hover:bg-[#0a3d3d]/10 min-h-[44px] flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden md:inline">Back</span>
              </Button>
              <div className="flex-shrink-0">
                {client?.logo ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-white border border-gray-200 flex items-center justify-center p-2 shadow-sm overflow-hidden">
                    <Image 
                      src={client?.logo} 
                      alt={`${clientName} Logo`}
                      width={80}
                      height={80}
                      unoptimized={client?.logo?.includes('seeklogo.com')}
                      className="object-contain w-full h-full"
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto'
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shadow-sm">
                    <span className="text-[#0a3d3d] font-semibold text-sm sm:text-base">
                      {getInitials(clientName)}
                    </span>
                  </div>
                )}
              </div>
              <h1 className="text-[32px] sm:text-[48px] font-medium text-center text-[#532418] text-[#0a3d3d] break-words sm:truncate flex-1 min-w-0 w-full sm:w-auto" style={{ fontFamily: 'var(--font-marcellus), serif' }}>{clientName}</h1>
              
            </div>

            <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0 w-full sm:w-auto">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-[#0a3d3d] hover:bg-[#0a3d3d]/90 text-white flex-1 sm:flex-initial min-h-[44px] text-sm sm:text-base"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save</span>
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    disabled={saving}
                    variant="outline"
                    className="flex items-center gap-2 min-h-[44px] text-sm sm:text-base"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleEdit}
                  className="flex items-center gap-2 bg-[#c9a961] hover:bg-[#c9a961]/90 text-[#0a3d3d] w-full sm:w-auto min-h-[44px] text-sm sm:text-base"
                >
                  <Edit2 className="w-4 h-4 text-[#532418]"/>
                  <span className="hidden sm:inline text-[#532418]">Edit Profile</span>
                  <span className="sm:hidden text-[#532418]">Edit</span>
                </Button>
              )}
              {/* <Avatar className="h-10 w-10 lg:h-12 lg:w-12">
                <AvatarImage src="/placeholder-avatar.jpg" alt={clientName} />
                <AvatarFallback>{getInitials(clientName)}</AvatarFallback>
              </Avatar> */}
            
            </div>

           
            </div>
            {/* Role */}
            <section>
              <h2 className="text-base sm:text-xl md:text-2xl text-center text-[#532418]" style={{ fontFamily: 'var(--font-marcellus), serif' }}>{client?.role}, Founder of {client?.company}</h2>
            </section>            
            </div>

          </div>

          {/* Content Area */}
          <div className="p-3 sm:p-4 md:p-6 lg:p-8 pt-3 sm:pt-4">
          {/* Basic Information */}
          {isEditing && (
            <section className="mb-6 sm:mb-8">
              <Card className="bg-[#fffff4] border-none !shadow-none">
                <CardContent className="p-4 sm:p-6">
                  <h2 className="text-base sm:text-lg md:text-xl font-montserrat text-[#c9a961] mb-3 sm:mb-4">Basic Information</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Name</label>
                      <input
                        type="text"
                        value={editData.name || ""}
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Email</label>
                      <input
                        type="email"
                        value={editData.email || ""}
                        onChange={(e) => setEditData({...editData, email: e.target.value})}
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                        placeholder="your.email@example.com"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Role</label>
                      <select
                        value={editData.role || selectedRole || "Investor"}
                        onChange={(e) => {
                          const newRole = e.target.value;
                          setEditData({...editData, role: newRole});
                          setSelectedRole(newRole);
                        }}
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px] bg-white"
                      >
                        <option value="Investor">Investor</option>
                        <option value="Entrepreneur">Entrepreneur</option>
                        <option value="Asset Manager">Asset Manager</option>
                        <option value="Facilitator">Facilitator</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Changing your role will show/hide relevant fields below</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Constraints Notes</label>
                      <textarea
                        value={editData.constraints_notes || ""}
                        onChange={(e) => setEditData({...editData, constraints_notes: e.target.value})}
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[80px] text-sm sm:text-base"
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
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Project Size</label>
                          <input
                            type="text"
                            value={editData.project_size || ""}
                            onChange={(e) => setEditData({...editData, project_size: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Capital Raise</label>
                          <input
                            type="text"
                            value={editData.raise_amount || ""}
                            onChange={(e) => setEditData({...editData, raise_amount: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
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
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Check Size</label>
                          <input
                            type="text"
                            value={editData.check_size || ""}
                            onChange={(e) => setEditData({...editData, check_size: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                            placeholder="e.g., 5-15 million"
                          />
                        </div>
                      );
                    })()}
                    {/* Active Raise Amount - Only for Investor, Asset Manager, or Entrepreneur */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showActiveRaise = roleNormalized === "investor" || roleNormalized === "asset manager" || roleNormalized === "entrepreneur";
                      
                      if (!showActiveRaise) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Active Raise Amount</label>
                          <input
                            type="text"
                            value={editData.active_raise_amount || ""}
                            onChange={(e) => setEditData({...editData, active_raise_amount: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                            placeholder="e.g., 2 million"
                          />
                        </div>
                      );
                    })()}
                    {/* Strategy Focus - Only for Investor or Asset Manager */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showStrategyFocus = roleNormalized === "investor" || roleNormalized === "asset manager";
                      
                      if (!showStrategyFocus) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Strategy Focus</label>
                          <input
                            type="text"
                            value={editData.strategy_focus || ""}
                            onChange={(e) => setEditData({...editData, strategy_focus: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                            placeholder="e.g., VC, growth, buyout, credit"
                          />
                        </div>
                      );
                    })()}
                    {/* Business Stage - Only for Entrepreneur */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showBusinessStage = roleNormalized === "entrepreneur";
                      
                      if (!showBusinessStage) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Business Stage</label>
                          <input
                            type="text"
                            value={editData.business_stage || ""}
                            onChange={(e) => setEditData({...editData, business_stage: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                            placeholder="e.g., idea, early revenue, growth, scaling"
                          />
                        </div>
                      );
                    })()}
                    {/* Revenue Range - Only for Entrepreneur */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showRevenueRange = roleNormalized === "entrepreneur";
                      
                      if (!showRevenueRange) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Revenue Range</label>
                          <input
                            type="text"
                            value={editData.revenue_range || ""}
                            onChange={(e) => setEditData({...editData, revenue_range: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                            placeholder="e.g., $1M - $10M"
                          />
                        </div>
                      );
                    })()}
                    {/* Facilitator Clients - Only for Facilitator */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showFacilitatorClients = roleNormalized === "facilitator";
                      
                      if (!showFacilitatorClients) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Facilitator Clients</label>
                          <input
                            type="text"
                            value={editData.facilitator_clients || ""}
                            onChange={(e) => setEditData({...editData, facilitator_clients: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                            placeholder="e.g., CEOs, family offices, funds, corporates"
                          />
                        </div>
                      );
                    })()}
                    {/* Deal Type - Only for Facilitator */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showDealType = roleNormalized === "facilitator";
                      
                      if (!showDealType) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Deal Type</label>
                          <input
                            type="text"
                            value={editData.deal_type || ""}
                            onChange={(e) => setEditData({...editData, deal_type: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                            placeholder="e.g., M&A, capital raise, buy side, sell side"
                          />
                        </div>
                      );
                    })()}
                    {/* Deal Size - Only for Facilitator */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showDealSize = roleNormalized === "facilitator";
                      
                      if (!showDealSize) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Deal Size</label>
                          <input
                            type="text"
                            value={editData.deal_size || ""}
                            onChange={(e) => setEditData({...editData, deal_size: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                            placeholder="e.g., $5M - $50M"
                          />
                        </div>
                      );
                    })()}
                    {/* Ideal CEO Profile - Only for Facilitator */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showIdealCEO = roleNormalized === "facilitator";
                      
                      if (!showIdealCEO) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Ideal CEO Profile</label>
                          <textarea
                            value={editData.ideal_ceo_profile || ""}
                            onChange={(e) => setEditData({...editData, ideal_ceo_profile: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[80px] text-sm sm:text-base"
                            placeholder="Characteristics of ideal CEO match"
                          />
                        </div>
                      );
                    })()}
                    {/* Ideal Intro - Only for Facilitator */}
                    {(() => {
                      const currentRole = editData.role || selectedRole;
                      const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                      const showIdealIntro = roleNormalized === "facilitator";
                      
                      if (!showIdealIntro) return null;
                      
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Ideal Intro</label>
                          <textarea
                            value={editData.ideal_intro || ""}
                            onChange={(e) => setEditData({...editData, ideal_intro: e.target.value})}
                            className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[80px] text-sm sm:text-base"
                            placeholder="The single most valuable introduction needed"
                          />
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
 

          {/* Client Information Card */}
          <section className="mb-4 sm:mb-6 md:mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                  {/* Check Size - Only for Investor or Asset Manager */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showCheckSize = roleNormalized === "investor" || roleNormalized === "asset manager";
                    
                    if (!showCheckSize) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Check Size Range</div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.check_size || ""}
                              onChange={(e) => setEditData({...editData, check_size: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                              placeholder="e.g., $5M-$50M"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.check_size || client?.["check_size"] ? <>{client?.check_size || client?.["check_size"]}</> : "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Project Size - Only for Entrepreneur or Facilitator */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showProjectSize = roleNormalized !== "investor" && roleNormalized !== "asset manager";
                    
                    if (!showProjectSize) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Project Size</div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.project_size || ""}
                              onChange={(e) => setEditData({...editData, project_size: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                              placeholder="e.g., $10M-$50M"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.project_size || client?.["project_size"] ? <>{client?.project_size || client?.["project_size"]}</> : "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Raise Amount - Only for Entrepreneur or Facilitator */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showRaiseAmount = roleNormalized !== "investor" && roleNormalized !== "asset manager";
                    
                    if (!showRaiseAmount) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Raise Amount</div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.raise_amount || ""}
                              onChange={(e) => setEditData({...editData, raise_amount: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                              placeholder="e.g., $5M"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.raise_amount || client?.["raise_amount"] ? <>{client?.raise_amount || client?.["raise_amount"]}</> : "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Active Raise Amount - Only for Investor, Asset Manager, or Entrepreneur */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showActiveRaise = roleNormalized === "investor" || roleNormalized === "asset manager" || roleNormalized === "entrepreneur";
                    
                    if (!showActiveRaise) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Active Raise Amount</div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.active_raise_amount || ""}
                              onChange={(e) => setEditData({...editData, active_raise_amount: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                              placeholder="e.g., $2M"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.active_raise_amount || client?.["active_raise_amount"] ? <>{client?.active_raise_amount || client?.["active_raise_amount"]}</> : "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Strategy Focus - Only for Investor or Asset Manager */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showStrategyFocus = roleNormalized === "investor" || roleNormalized === "asset manager";
                    
                    if (!showStrategyFocus) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Strategy Focus</div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.strategy_focus || ""}
                              onChange={(e) => setEditData({...editData, strategy_focus: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                              placeholder="e.g., VC, growth, buyout, credit"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.strategy_focus || client?.["strategy_focus"] || "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Business Stage - Only for Entrepreneur */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showBusinessStage = roleNormalized === "entrepreneur";
                    
                    if (!showBusinessStage) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Business Stage</div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.business_stage || ""}
                              onChange={(e) => setEditData({...editData, business_stage: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                              placeholder="e.g., idea, early revenue, growth, scaling"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.business_stage || client?.["business_stage"] || "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Revenue Range - Only for Entrepreneur */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showRevenueRange = roleNormalized === "entrepreneur";
                    
                    if (!showRevenueRange) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Revenue Range</div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.revenue_range || ""}
                              onChange={(e) => setEditData({...editData, revenue_range: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                              placeholder="e.g., $1M - $10M"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.revenue_range || client?.["revenue_range"] || "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Facilitator Clients - Only for Facilitator */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showFacilitatorClients = roleNormalized === "facilitator";
                    
                    if (!showFacilitatorClients) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Facilitator Clients</div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.facilitator_clients || ""}
                              onChange={(e) => setEditData({...editData, facilitator_clients: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                              placeholder="e.g., CEOs, family offices, funds, corporates"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.facilitator_clients || client?.["facilitator_clients"] || "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Deal Type - Only for Facilitator */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showDealType = roleNormalized === "facilitator";
                    
                    if (!showDealType) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Deal Type</div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.deal_type || ""}
                              onChange={(e) => setEditData({...editData, deal_type: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                              placeholder="e.g., M&A, capital raise, buy side, sell side"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.deal_type || client?.["deal_type"] || "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Deal Size - Only for Facilitator */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showDealSize = roleNormalized === "facilitator";
                    
                    if (!showDealSize) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Deal Size</div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.deal_size || ""}
                              onChange={(e) => setEditData({...editData, deal_size: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                              placeholder="e.g., $5M - $50M"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.deal_size || client?.["deal_size"] || "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Ideal CEO Profile - Only for Facilitator */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showIdealCEO = roleNormalized === "facilitator";
                    
                    if (!showIdealCEO) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] border-none !shadow-none rounded-lg sm:col-span-2 lg:col-span-3">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Ideal CEO Profile</div>
                          {isEditing ? (
                            <textarea
                              value={editData.ideal_ceo_profile || ""}
                              onChange={(e) => setEditData({...editData, ideal_ceo_profile: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[100px] text-sm sm:text-base"
                              placeholder="Characteristics of ideal CEO match"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.ideal_ceo_profile || client?.["ideal_ceo_profile"] || "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Ideal Intro - Only for Facilitator */}
                  {(() => {
                    const currentRole = isEditing ? editData.role : selectedRole;
                    const roleNormalized = currentRole ? currentRole.toLowerCase() : "";
                    const showIdealIntro = roleNormalized === "facilitator";
                    
                    if (!showIdealIntro) return null;
                    
                    return (
                      <Card className="bg-[#fffff4] border-none !shadow-none rounded-lg sm:col-span-2 lg:col-span-3">
                        <CardContent className="p-4">
                          <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Ideal Intro</div>
                          {isEditing ? (
                            <textarea
                              value={editData.ideal_intro || ""}
                              onChange={(e) => setEditData({...editData, ideal_intro: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[100px] text-sm sm:text-base"
                              placeholder="The single most valuable introduction needed"
                            />
                          ) : (
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                              {client?.ideal_intro || client?.["ideal_intro"] || "-"}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Company */}
                  <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                    <CardContent className="p-4">
                      <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Firm</div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData.company || ""}
                          onChange={(e) => setEditData({...editData, company: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                          placeholder="Company name"
                        />
                      ) : (
                        <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                          {client?.company || client?.["company"] || client?.Company || client?.["Company"] || "-"}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Partner Types */}
                  <Card className="bg-[#fffff4] !border !border-[#ffe0ccff] !shadow-none rounded-lg">
                    <CardContent className="p-4">
                      <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Partner Types</div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData.partner_types || ""}
                          onChange={(e) => setEditData({...editData, partner_types: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                          placeholder="e.g., LPs, Operators (separate with semicolons)"
                        />
                      ) : (
                        <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
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
                    </CardContent>
                  </Card>

                  {/* Industries */}
                  <Card className="bg-[#fffff4] border border-[#ffe0ccff] !shadow-none rounded-lg">
                    <CardContent className="p-4">
                      <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Main Sectors</div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData.industries || ""}
                          onChange={(e) => setEditData({...editData, industries: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                          placeholder="e.g., Industrial services, Healthcare IT"
                        />
                      ) : (
                        <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                          {client?.industries || client?.["industries"] || client?.Industries || client?.["Industries"] || "-"}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Regions */}
                  <Card className="bg-[#fffff4] border border-[#ffe0ccff] !shadow-none rounded-lg">
                    <CardContent className="p-4">
                      <div className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-marcellus), serif', color: '#67534F' }}>Geography</div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData.regions || ""}
                          onChange={(e) => setEditData({...editData, regions: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-base font-medium text-[#0a3d3d]"
                          placeholder="e.g., Southeast US"
                        />
                      ) : (
                        <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '16px', color: '#67534F' }}>
                          {client?.regions || client?.["regions"] || client?.Regions || client?.["Regions"] || "-"}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
          </section>

          {/* Business Goals Overview */}
          <section className=" mb-4 sm:mb-6 md:mb-8 scroll-mt-38 sm:scroll-mt-24 lg:scroll-mt-28" id="business-goals">
            <h2 className="text-base sm:text-lg md:text-xl font-montserrat text-[#c9a961] mb-2 sm:mb-3 md:mb-4 flex items-center gap-2">
              <span className="text-[#67534F] text-[16px] font-bold">Goals Summary</span>
            </h2>
            {isEditing ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Goals (one per line)</label>
                <textarea
                  value={editData.goals || ""}
                  onChange={(e) => setEditData({...editData, goals: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[100px] text-sm sm:text-base"
                  placeholder="Enter your business goals, one per line"
                />
              </div>
            ) : (
              <div>
                {client?.goals || client?.["goals"] ? (
                  <p className="text-gray-700 whitespace-pre-line">
                    {client?.goals || client?.["goals"]}
                  </p>
                ) : (
                  <p className="text-gray-500">No goals set. Goals will appear here when available.</p>
                )}
              </div>
            )}
          </section>

          {/* Live Private Deal Flow */}
          {!isEditing && (
          <section className="mb-4 sm:mb-6 md:mb-8 scroll-mt-38 sm:scroll-mt-24 lg:scroll-mt-28" id="signals">
            <h2 className="text-base sm:text-lg md:text-xl font-montserrat text-[#c9a961] mb-2 sm:mb-3 md:mb-4 flex items-center gap-2">
              <span className="text-[#532418] text-[32px] font-marcellus">Signals</span>
            </h2>
            <Card className="bg-[#fffff4] border-none !shadow-none">
              <CardContent className="p-3 sm:p-4 md:p-6">
                {signals.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4 lg:space-y-6 max-h-[600px] overflow-y-auto pr-1 sm:pr-2">
                    {signals.map((signal, index) => {
                      const badge = getIndustryBadge(signal.signal_type, signal.category)
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 hover:shadow-md transition-shadow">
                          {/* Header Row */}
                          <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-3 md:gap-4">
                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                              <h3 className="font-semibold text-[#67534F] text-sm sm:text-base md:text-lg mb-1 sm:mb-2 break-words">
                                {signal.headline_source || `Signal ${index + 1}`}
                              </h3>
                              {signal.url && (
                                <a 
                                  href={signal.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs sm:text-sm text-[#c9a961] hover:underline inline-flex items-center gap-1"
                                >
                                  <span>View Source</span>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              {signal.overall && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-[#67534F] hidden sm:inline">Overall:</span>
                                  <Badge className="bg-[#c9a961] text-[#532418] text-xs">
                                    {signal.overall}/5
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm">
                            <div>
                              <div className="text-[#67534F] mb-1">Date</div>
                              <div className="font-medium text-[#532418]">
                                {signal.date ? new Date(signal.date).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                }) : '-'}
                              </div>
                            </div>
                            <div>
                              <div className="text-[#67534F] mb-1">Signal Type</div>
                              <div className="font-medium text-[#532418] capitalize">
                                {signal.signal_type || '-'}
                              </div>
                            </div>
                            {/* <div>
                              <div className="text-[#67534F] mb-1">Category</div>
                              <div className="font-medium text-[#0a3d3d]">
                                {signal.category ? signal.category.replace("_opportunity", "").replace(/_/g, " ") : '-'}
                              </div>
                            </div> */}
                            <div>
                              <div className="text-[#67534F] mb-1">Scores (R,O,A)</div>
                              <div className="font-medium text-[#532418]">
                                {signal.scores_R_O_A || '-'}
                              </div>
                            </div>
                            {/* <div>
                              <div className="text-[#67534F] mb-1">Company</div>
                              <div className="font-medium text-[#532418]">
                                {signal.company || '-'}
                              </div>
                            </div> */}
                            <div>
                              <div className="text-[#67534F] mb-1">Estimated target value</div>
                              <div className="font-medium text-[#532418]">
                                {signal.estimated_target_value_USD || '-'}
                              </div>
                            </div>
                          </div>

                          {/* Next Step */}
                          {signal.next_step && (
                            <div className="pt-4 border-t border-gray-200">
                              <div className="text-[#67534F] mb-2 text-sm font-medium">Next Step</div>
                              <div className="text-[#532418] bg-[#faf1dc] p-3 rounded-md">
                                {signal.next_step}
                              </div>
                            </div>
                          )}

                          {/* Create Deal Button */}
                          <div className="pt-3 sm:pt-4 border-t border-gray-200">
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
                              className="bg-[#0a3d3d] hover:bg-[#0a3d3d]/90 text-white w-full sm:w-auto min-h-[44px] text-sm sm:text-base"
                            >
                              Activate Kolos
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
          )}

          {/* Active Deals */}
          {!isEditing && (
          <section className="mb-4 sm:mb-6 md:mb-8 scroll-mt-38 sm:scroll-mt-24 lg:scroll-mt-28" id="active-deals">
            <h2 className="text-base sm:text-lg md:text-xl font-montserrat text-[#c9a961] mb-2 sm:mb-3 md:mb-4 flex items-center gap-2">
              <span className="text-[#532418] text-[32px] font-marcellus">Active Deals</span>
            </h2>
            <Card className="bg-[#fffff4] border-none !shadow-none">
              <CardContent className="p-3 sm:p-4 md:p-6">
                {deals.length > 0 ? (
                  <>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3 max-h-[600px] overflow-y-auto">
                      {deals.map((deal, index) => {
                        const dealId = deal.deal_id || deal["deal_id"] || deal.id || deal["id"]
                        const currentStage = deal.stage || deal["stage"] || "list"
                        const isUpdating = updatingStage === dealId
                        const isDeleting = deletingDeal === dealId
                        
                        return (
                          <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2.5 bg-white">
                            {/* Deal Name & Actions */}
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-semibold text-[#0a3d3d] flex-1 break-words">
                                {deal.deal_name || deal["deal_name"] || "-"}
                              </h3>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditDeal(deal)}
                                  disabled={!dealId}
                                  className="text-[#0a3d3d] hover:text-[#0a3d3d]/80 hover:bg-[#0a3d3d]/10 min-h-[44px] min-w-[44px] p-0"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDeal(dealId)}
                                  disabled={isDeleting || !dealId}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0 min-h-[44px] min-w-[44px] p-0"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            
                            {/* Stage */}
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Stage</div>
                              <select
                                value={currentStage}
                                onChange={(e) => handleStageChange(dealId, e.target.value)}
                                disabled={isUpdating || !dealId}
                                className={`w-full px-3 py-2 rounded-md border-2 border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] focus:border-[#0a3d3d] min-h-[44px] ${
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
                                } ${isUpdating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                              >
                                <option value="list" style={{ backgroundColor: '#f3f4f6', color: '#1f2937' }}>list</option>
                                <option value="intro" style={{ backgroundColor: '#f3e8ff', color: '#6b21a8' }}>intro</option>
                                <option value="first call" style={{ backgroundColor: '#fff7ed', color: '#9a3412' }}>first call</option>
                                <option value="NDA signed" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>NDA signed</option>
                                <option value="in negotiation" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>in negotiation</option>
                                <option value="closed" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>closed</option>
                              </select>
                            </div>
                            
                            {/* Target */}
                            {(deal.target || deal["target"]) && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Target</div>
                                <div className="text-sm text-gray-700 break-words">
                                  {deal.target || deal["target"]}
                                </div>
                              </div>
                            )}
                            
                            {/* Source */}
                            {(deal.source || deal["source"]) && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Source</div>
                                <a 
                                  href={deal.source || deal["source"]} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs sm:text-sm text-[#c9a961] hover:underline inline-flex items-center gap-1"
                                >
                                  <span>View Source</span>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </div>
                            )}
                            
                            {/* Target Deal Size */}
                            {(deal.target_deal_size || deal["target_deal_size"]) && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Target Deal Size</div>
                                <div className="text-sm text-gray-700">
                                  {deal.target_deal_size || deal["target_deal_size"]}
                                </div>
                              </div>
                            )}
                            
                            {/* Next Step */}
                            {(deal.next_step || deal["next_step"]) && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Next Step</div>
                                <div className="text-sm text-gray-600 break-words">
                                  {deal.next_step || deal["next_step"]}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto">
                      <table className="w-full border-collapse">
                        <thead className="top-0 bg-white z-20">
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white">Deal Name</th>
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white">Target</th>
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white hidden lg:table-cell">Source</th>
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white">Stage</th>
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white hidden lg:table-cell">Target Deal Size</th>
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white hidden xl:table-cell">Next Step</th>
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-xs sm:text-sm font-semibold text-gray-700 bg-white">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deals.map((deal, index) => {
                            const dealId = deal.deal_id || deal["deal_id"] || deal.id || deal["id"]
                            const currentStage = deal.stage || deal["stage"] || "list"
                            const isUpdating = updatingStage === dealId
                            const isDeleting = deletingDeal === dealId
                            
                            return (
                              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-xs sm:text-sm text-[#0a3d3d] font-medium break-words">
                                  {deal.deal_name || deal["deal_name"] || "-"}
                                </td>
                                <td className="py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-xs sm:text-sm text-gray-700 break-words">
                                  {deal.target || deal["target"] || "-"}
                                </td>
                                <td className="py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-xs sm:text-sm text-gray-700 hidden lg:table-cell break-words max-w-[200px]">
                                  {(deal.source || deal["source"]) ? (
                                    <a 
                                      href={deal.source || deal["source"]} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-[#c9a961] hover:underline inline-flex items-center gap-1"
                                    >
                                      <span>View Source</span>
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-sm sm:text-sm">
                                  <select
                                    value={currentStage}
                                    onChange={(e) => handleStageChange(dealId, e.target.value)}
                                    disabled={isUpdating || !dealId}
                                    style={{ 
                                      minWidth: '100px',
                                      zIndex: 1,
                                      position: 'relative'
                                    }}
                                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md border-2 border-gray-300 text-sm sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] focus:border-[#0a3d3d] min-h-[44px] ${
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
                                </td>
                                <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700 hidden lg:table-cell break-words">
                                  {deal.target_deal_size || deal["target_deal_size"] || "-"}
                                </td>
                                <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 hidden xl:table-cell break-words">
                                  {deal.next_step || deal["next_step"] || "-"}
                                </td>
                                <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedDealForModal(deal)
                                        setShowLinkedInModal(true)
                                      }}
                                      disabled={!dealId}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 min-h-[44px] min-w-[44px]"
                                      title="View LinkedIn URLs"
                                    >
                                      <span className="text-xs font-semibold">L</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedDealForModal(deal)
                                        setShowEmailModal(true)
                                      }}
                                      disabled={!dealId}
                                      className="text-green-600 hover:text-green-700 hover:bg-green-50 min-h-[44px] min-w-[44px]"
                                      title="View Email Addresses"
                                    >
                                      <span className="text-xs font-semibold">E</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditDeal(deal)}
                                      disabled={!dealId}
                                      className="text-[#0a3d3d] hover:text-[#0a3d3d]/80 hover:bg-[#0a3d3d]/10 min-h-[44px] min-w-[44px]"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteDeal(dealId)}
                                      disabled={isDeleting || !dealId}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 min-h-[44px] min-w-[44px]"
                                    >
                                      {isDeleting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No active deals. Deals will appear here once created.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
          )}

          {/* Industry & Geographic Focus */}
          <section className="mb-4 sm:mb-6 md:mb-8 scroll-mt-38 sm:scroll-mt-24 lg:scroll-mt-28" id="industry-focus">
            <h2 className="text-base sm:text-lg md:text-xl font-montserrat text-[#c9a961] mb-2 sm:mb-3 md:mb-4 flex items-center gap-2">
              <span className="text-[#532418] text-[32px] font-marcellus">Industry & Geographic Focus</span>
            </h2>
            {isEditing ? (
              <Card className="bg-[#fffff4] border-none !shadow-none">
                <CardContent className="p-4 md:p-6 space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Industries (separate with semicolons)</label>
                    <input
                      type="text"
                      value={editData.industries || ""}
                      onChange={(e) => setEditData({...editData, industries: e.target.value})}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                      placeholder="e.g., Tech; Healthcare; Finance"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Regions (separate with semicolons)</label>
                    <input
                      type="text"
                      value={editData.regions || ""}
                      onChange={(e) => setEditData({...editData, regions: e.target.value})}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                      placeholder="e.g., US; Europe; MENA"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-2 sm:gap-3 flex-wrap">
                {getIndustries().map((industry, index) => (
                  <Badge key={index} className="bg-[#e8dcc8] text-[#8b6f3e] hover:bg-[#e8dcc8] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm">
                    {industry}
                  </Badge>
                ))}
                {getRegions().map((region, index) => (
                  <Badge key={`region-${index}`} className="bg-[#d0e8e8] text-[#3e6b8b] hover:bg-[#d0e8e8] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm">
                    🌎 {region}
                  </Badge>
                ))}
                {getIndustries().length === 0 && getRegions().length === 0 && (
                  <p className="text-gray-500 text-xs sm:text-sm">No industries or regions specified</p>
                )}
              </div>
            )}
          </section>

          {/* <div className="mb-4 sm:mb-6 md:mb-8 scroll-mt-38 sm:scroll-mt-24 lg:scroll-mt-28" id="business-requests"> */}
            {/* Business Requests */}
            {/* <section className="mb-4 sm:mb-6 md:mb-8">
              <h2 className="text-base sm:text-lg md:text-xl font-montserrat text-[#c9a961] mb-2 sm:mb-3 md:mb-4 flex items-center gap-2">
                <span className="text-[#c9a961]">⊞</span>
                <span className="break-words">{clientName}'s Business Requests</span>
              </h2>
              <Card className="bg-[#fffff4] border-none !shadow-none">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  {isEditing ? (
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Active Deal/Project</label>
                        <textarea
                          value={editData.active_deal || ""}
                          onChange={(e) => setEditData({...editData, active_deal: e.target.value})}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[80px] text-sm sm:text-base"
                          placeholder="Describe your active deal or project"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Travel Cities</label>
                        <input
                          type="text"
                          value={editData.travel_cities || ""}
                          onChange={(e) => setEditData({...editData, travel_cities: e.target.value})}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                          placeholder="e.g., New York, London, Dubai"
                        />
                      </div>
                    </div>
                  ) : (
                    client.active_deal || client["active_deal"] || client.Active_deal || client["Active_deal"] ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 md:gap-4 pb-2 border-b text-xs sm:text-sm text-gray-600 font-medium">
                          <div className="col-span-1 sm:col-span-5">Request</div>
                          <div className="col-span-1 sm:col-span-4">Location</div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 md:gap-4 items-start sm:items-center py-2 sm:py-3">
                          <div className="col-span-1 sm:col-span-5">
                            <div className="font-semibold text-sm sm:text-base">Active Deal/Project</div>
                            <div className="text-xs sm:text-sm text-gray-600 break-words mt-1">{client.active_deal || client["active_deal"] || client.Active_deal || client["Active_deal"]}</div>
                          </div>
                          <div className="col-span-1 sm:col-span-4 text-xs sm:text-sm break-words">
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
            </section> */}

            {/* Potential Business Matches */}
            {/* {!isEditing && (
            <section id="business-matches" className="scroll-mt-38 sm:scroll-mt-24 lg:scroll-mt-28">
              <h2 className="text-base sm:text-lg md:text-xl font-montserrat text-[#c9a961] mb-2 sm:mb-3 md:mb-4 flex items-center gap-2">
                <span className="text-[#c9a961]">⚭</span>
                Potential Business Matches
              </h2>
              <Card className="bg-[#fffff4] border-none !shadow-none">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="pb-2 border-b text-xs sm:text-sm text-gray-600 font-medium">
                      Request
                    </div>
                    <div className="py-2 sm:py-3">
                      <div className="font-semibold mb-1 text-sm sm:text-base">Institutional partner</div>
                      <div className="text-xs sm:text-sm text-gray-600">Seeking US-based RE developments</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
            )} */}
          {/* </div> */}

          {/* OPM Travel Plans */}
          {!isEditing && (
          <section className="mb-4 sm:mb-6 md:mb-8 scroll-mt-38 sm:scroll-mt-24 lg:scroll-mt-28" id="opm-travel-plans">
            <h2 className="text-base sm:text-lg md:text-xl font-montserrat text-[#c9a961] mb-2 sm:mb-3 md:mb-4 flex items-center gap-2">
                <span className="text-[#532418] text-[32px] font-marcellus">OPM Travel Matches</span>
            </h2>
            <Card className="bg-[#fffff4] border-none !shadow-none">
              <CardContent className="p-3 sm:p-4 md:p-6">
                {getOPMTravelPlans().length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="hidden sm:grid grid-cols-12 gap-3 sm:gap-4 pb-2 border-b text-xs sm:text-[16px] text-[#67534F] font-bold">
                      <div className="col-span-2">Connection</div>
                      <div className="col-span-2">OPM #</div>
                      <div className="col-span-3">Travel Plans</div>
                      <div className="col-span-2">Date</div>
                      <div className="col-span-3">How they can help</div>
                    </div>

                    {getOPMTravelPlans().map((plan, index) => {
                      const customerName = plan.customer || ""
                      const initials = getCustomerInitials(customerName)
                      const travelPlans = plan.travel_plans || ""
                      const dates = plan.date || ""
                      const travelPlansList = travelPlans.split('\n').filter(p => p.trim())
                      const datesList = dates.split('\n').filter(d => d.trim())

                      return (
                        <div 
                          key={index} 
                          className={`grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 md:gap-4 items-start py-2 sm:py-3 ${
                            index < getOPMTravelPlans().length - 1 ? 'border-b border-gray-100' : ''
                          }`}
                        >
                          <div className="col-span-1 sm:col-span-2 flex items-center gap-2">
                            <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs sm:text-sm text-[#67534F] break-words">{customerName}</span>
                          </div>
                          <div className="col-span-1 sm:col-span-2">
                            <Badge className="bg-[#c9a961] text-[#532418] hover:bg-[#c9a961] text-xs">
                              {plan.opm_number || ""}
                            </Badge>
                          </div>
                          <div className="col-span-1 sm:col-span-3 text-xs sm:text-sm text-[#67534F] break-words">
                            {travelPlansList.length > 0 ? (
                              travelPlansList.map((planText, i) => (
                                <div key={i}>{planText.trim()}</div>
                              ))
                            ) : (
                              <div className="text-[#67534F]">-</div>
                            )}
                          </div>
                          <div className="col-span-1 sm:col-span-2 text-xs sm:text-sm text-[#67534F]">
                            {datesList.length > 0 ? (
                              datesList.map((dateText, i) => (
                                <div key={i}>{dateText.trim()}</div>
                              ))
                            ) : (
                              <div className="text-[#67534F]">-</div>
                            )}
                          </div>
                          <div className="col-span-1 sm:col-span-3 text-xs sm:text-sm break-words text-[#67534F]">
                            {plan.how_they_can_help || plan["how_they_can_help"] || plan["How they can help"] || "-"}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#67534F]">
                    <p className="text-sm text-[#67534F]">No travel plans available. Travel plans will appear here once generated.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
          )}

          {/* Upcoming Industry Events */}
          {!isEditing && (
          <section className="mb-4 sm:mb-6 md:mb-8 scroll-mt-38 sm:scroll-mt-24 lg:scroll-mt-28" id="upcoming-industry-events">
            <h2 className="text-base sm:text-lg md:text-xl font-montserrat text-[#c9a961] mb-2 sm:mb-3 md:mb-4 flex items-center gap-2">
                  <span className="text-[#532418] text-[32px] font-marcellus">Upcoming Industry Events</span>
            </h2>
            <Card className="bg-[#fffff4] border-none !shadow-none">
              <CardContent className="p-3 sm:p-4 md:p-6">
                {getUpcomingIndustryEvents().length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="hidden sm:grid grid-cols-12 gap-3 sm:gap-4 pb-2 border-b text-xs sm:text-[16px] text-[#67534F] font-bold">
                      <div className="col-span-3">Event</div>
                      <div className="col-span-2">Industry</div>
                      <div className="col-span-2">Location</div>
                      <div className="col-span-2">Event Date</div>
                      <div className="col-span-3">Why it matters</div>
                    </div>

                    {getUpcomingIndustryEvents().map((event, index) => {
                      // Determine badge styling based on industry
                      const industry = event.industry || ""
                      let badgeClass = "bg-[#e8dcc8] text-[#8b6f3e] hover:bg-[#e8dcc8]"
                      if (industry.includes("Finance") || industry.includes("Private Equity")) {
                        badgeClass = "bg-[#e8d8c8] text-[#8b5f3e] hover:bg-[#e8d8c8]"
                      } else if (industry.includes("Renewable Energy") || industry.includes("Energy")) {
                        badgeClass = "bg-[#f0e8d0] text-[#8b7537] hover:bg-[#f0e8d0]"
                      }

                      return (
                        <div 
                          key={index}
                          className={`grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 md:gap-4 items-start py-2 sm:py-3 ${
                            index < getUpcomingIndustryEvents().length - 1 ? 'border-b border-gray-100' : ''
                          }`}
                        >
                          <div className="col-span-1 sm:col-span-3 break-words text-sm sm:text-base text-[#67534F]">
                            {event.event_name || "-"}
                          </div>
                          <div className="col-span-1 sm:col-span-2">
                            <Badge className={`${badgeClass} text-xs`}>
                              {industry || "-"}
                            </Badge>
                          </div>
                          <div className="col-span-1 sm:col-span-2 text-xs sm:text-sm break-words text-[#67534F]">
                            {event.location || "-"}
                          </div>
                          <div className="col-span-1 sm:col-span-2 text-xs sm:text-sm text-[#67534F]">
                            {event.event_date || "-"}
                          </div>
                          <div className="col-span-1 sm:col-span-3 text-xs sm:text-sm break-words text-[#67534F]">
                            {event.why_it_matters || event["why_it_matters"] || event["Why it matters"] || "-"}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#67534F]">
                    <p className="text-sm text-[#67534F]">No upcoming events available. Events will appear here once generated.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
          )}
          </div>
        </div>

        {/* Create Deal Modal */}
        {showCreateDealModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <Card className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-montserrat text-[#0a3d3d]">
                    {editingDeal ? 'Edit Deal' : 'Create New Deal'}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowCreateDealModal(false)
                      setEditingDeal(null)
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
                    className="min-w-[44px] min-h-[44px]"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <form onSubmit={(e) => { 
                  e.preventDefault(); 
                  if (editingDeal) {
                    handleUpdateDeal();
                  } else {
                    handleCreateDeal();
                  }
                }}
                  className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Deal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={dealFormData.deal_name}
                      onChange={(e) => setDealFormData({...dealFormData, deal_name: e.target.value})}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                      placeholder="Enter deal name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Target
                    </label>
                    <input
                      type="text"
                      value={dealFormData.target}
                      onChange={(e) => setDealFormData({...dealFormData, target: e.target.value})}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                      placeholder="Enter target"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Source
                    </label>
                    <input
                      type="text"
                      value={dealFormData.source}
                      onChange={(e) => setDealFormData({...dealFormData, source: e.target.value})}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                      placeholder="Enter source URL or name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Stage *
                    </label>
                    <select
                      required
                      value={dealFormData.stage}
                      onChange={(e) => setDealFormData({...dealFormData, stage: e.target.value})}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Target Deal Size
                    </label>
                    <input
                      type="text"
                      value={dealFormData.target_deal_size}
                      onChange={(e) => setDealFormData({...dealFormData, target_deal_size: e.target.value})}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] text-sm sm:text-base min-h-[44px]"
                      placeholder="e.g., $5M - $15M"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Next Step
                    </label>
                    <textarea
                      value={dealFormData.next_step}
                      onChange={(e) => setDealFormData({...dealFormData, next_step: e.target.value})}
                      className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3d3d] min-h-[100px] text-sm sm:text-base"
                      placeholder="Enter next step"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                    <Button
                      type="submit"
                      disabled={creatingDeal || updatingDeal}
                      className="flex-1 sm:flex-initial bg-[#0a3d3d] hover:bg-[#0a3d3d]/90 text-white min-h-[44px] text-sm sm:text-base"
                    >
                      {creatingDeal || updatingDeal ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          {editingDeal ? 'Updating...' : 'Creating...'}
                        </>
                      ) : (
                        editingDeal ? 'Update Deal' : 'Activate Kolos'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateDealModal(false)
                        setEditingDeal(null)
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
                      disabled={creatingDeal || updatingDeal}
                      className="flex-1 sm:flex-initial min-h-[44px] text-sm sm:text-base"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* LinkedIn Modal */}
        {showLinkedInModal && selectedDealForModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <Card className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-montserrat text-[#0a3d3d]">
                    Decision Makers - LinkedIn
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowLinkedInModal(false)
                      setSelectedDealForModal(null)
                    }}
                    className="min-w-[44px] min-h-[44px]"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {(() => {
                    try {
                      const allDecisionMakers = selectedDealForModal.all_decision_makers 
                        ? (typeof selectedDealForModal.all_decision_makers === 'string' 
                            ? JSON.parse(selectedDealForModal.all_decision_makers) 
                            : selectedDealForModal.all_decision_makers)
                        : []
                      
                      const primaryName = selectedDealForModal.decision_maker_name || selectedDealForModal["decision_maker_name"] || ""
                      
                      // If no decision makers in array, try to show primary from individual fields
                      if (!Array.isArray(allDecisionMakers) || allDecisionMakers.length === 0) {
                        // Fallback: Show primary decision maker from individual fields
                        const primaryEmail = selectedDealForModal.decision_maker_email 
                          || selectedDealForModal["decision_maker_email"]
                          || ""
                        const primaryName = selectedDealForModal.decision_maker_name 
                          || selectedDealForModal["decision_maker_name"]
                          || ""
                        const primaryRole = selectedDealForModal.decision_maker_role 
                          || selectedDealForModal["decision_maker_role"]
                          || ""
                        
                        if (primaryName || primaryEmail) {
                          return (
                            <div className="border rounded-lg p-4 bg-green-50 border-green-300 shadow-md">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-semibold text-green-700 text-lg">
                                      {primaryName || "Unknown"}
                                    </h3>
                                    <Badge className="bg-green-600 text-white text-xs">
                                      Primary
                                    </Badge>
                                  </div>
                                  {primaryRole && (
                                    <p className="text-sm text-gray-600 mb-2">{primaryRole}</p>
                                  )}
                                  {primaryEmail ? (
                                    <a
                                      href={`mailto:${primaryEmail}`}
                                      className="text-green-600 hover:text-green-700 hover:underline text-sm flex items-center gap-1"
                                    >
                                      <Mail className="w-4 h-4" />
                                      {primaryEmail}
                                    </a>
                                  ) : (
                                    <p className="text-sm text-gray-400 italic">No email address available</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        }
                        
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <p>No decision makers found for this deal.</p>
                          </div>
                        )
                      }

                      return allDecisionMakers.map((dm, index) => {
                        const isPrimary = dm.name === primaryName
                        // Try multiple possible field names for linkedin_url
                        let linkedinUrl = dm.linkedin_url 
                          || dm["linkedin_url"]
                          || ""
                        
                        // If this is the primary decision maker and no LinkedIn in array, try primary fields
                        if (isPrimary && !linkedinUrl) {
                          linkedinUrl = selectedDealForModal.decision_maker_linkedin_url 
                            || selectedDealForModal["decision_maker_linkedin_url"]
                            || ""
                        }
                        
                        return (
                          <div
                            key={index}
                            className={`border rounded-lg p-4 ${
                              isPrimary 
                                ? 'bg-blue-50 border-blue-300 shadow-md' 
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className={`font-semibold ${
                                    isPrimary ? 'text-blue-700 text-lg' : 'text-gray-900'
                                  }`}>
                                    {dm.name || "Unknown"}
                                  </h3>
                                  {isPrimary && (
                                    <Badge className="bg-blue-600 text-white text-xs">
                                      Primary
                                    </Badge>
                                  )}
                                </div>
                                {dm.role && (
                                  <p className="text-sm text-gray-600 mb-2">{dm.role}</p>
                                )}
                                {linkedinUrl ? (
                                  <a
                                    href={linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                                  >
                                    <Linkedin className="w-4 h-4" />
                                    {linkedinUrl}
                                  </a>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">No LinkedIn URL available</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    } catch (error) {
                      console.error("Error parsing decision makers:", error)
                      return (
                        <div className="text-center py-8 text-red-500">
                          <p>Error loading decision makers data.</p>
                        </div>
                      )
                    }
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Email Modal */}
        {showEmailModal && selectedDealForModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <Card className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-montserrat text-[#0a3d3d]">
                    Decision Makers - Email
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowEmailModal(false)
                      setSelectedDealForModal(null)
                    }}
                    className="min-w-[44px] min-h-[44px]"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {(() => {
                    try {
                      // Debug: Log the deal object to see what fields are available
                      console.log('🔍 Deal data for Email modal:', selectedDealForModal)
                      
                      // Try multiple possible field names for all_decision_makers
                      const allDecisionMakersField = selectedDealForModal.all_decision_makers 
                        || selectedDealForModal["all_decision_makers"]
                        || null
                      
                      console.log('🔍 all_decision_makers field:', allDecisionMakersField)
                      
                      const allDecisionMakers = allDecisionMakersField
                        ? (typeof allDecisionMakersField === 'string' 
                            ? JSON.parse(allDecisionMakersField) 
                            : allDecisionMakersField)
                        : []
                      
                      console.log('🔍 Parsed decision makers:', allDecisionMakers)
                      
                      // Try multiple possible field names for primary decision maker
                      const primaryName = selectedDealForModal.decision_maker_name 
                        || selectedDealForModal["decision_maker_name"]
                        || ""
                      
                      // If no decision makers in array, try to show primary from individual fields
                      if (!Array.isArray(allDecisionMakers) || allDecisionMakers.length === 0) {
                        // Fallback: Show primary decision maker from individual fields
                        const primaryLinkedIn = selectedDealForModal.decision_maker_linkedin_url 
                          || selectedDealForModal["decision_maker_linkedin_url"]
                          || ""
                        const primaryName = selectedDealForModal.decision_maker_name 
                          || selectedDealForModal["decision_maker_name"]
                          || ""
                        const primaryRole = selectedDealForModal.decision_maker_role 
                          || selectedDealForModal["decision_maker_role"]
                          || ""
                        
                        if (primaryName || primaryLinkedIn) {
                          return (
                            <div className="border rounded-lg p-4 bg-blue-50 border-blue-300 shadow-md">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-semibold text-blue-700 text-lg">
                                      {primaryName || "Unknown"}
                                    </h3>
                                    <Badge className="bg-blue-600 text-white text-xs">
                                      Primary
                                    </Badge>
                                  </div>
                                  {primaryRole && (
                                    <p className="text-sm text-gray-600 mb-2">{primaryRole}</p>
                                  )}
                                  {primaryLinkedIn ? (
                                    <a
                                      href={primaryLinkedIn}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                                    >
                                      <Linkedin className="w-4 h-4" />
                                      {primaryLinkedIn}
                                    </a>
                                  ) : (
                                    <p className="text-sm text-gray-400 italic">No LinkedIn URL available</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        }
                        
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <p>No decision makers found for this deal.</p>
                            <p className="text-xs mt-2">Available fields: {Object.keys(selectedDealForModal).join(', ')}</p>
                          </div>
                        )
                      }

                      return allDecisionMakers.map((dm, index) => {
                        const isPrimary = dm.name === primaryName
                        console.log('🔍 Decision maker:', dm, 'Email field:', dm.email)
                        // Try multiple possible field names for email
                        let email = dm.email 
                          || dm["email"]
                          || ""
                        
                        // If this is the primary decision maker and no email in array, try primary fields
                        if (isPrimary && !email) {
                          email = selectedDealForModal.decision_maker_email 
                            || selectedDealForModal["decision_maker_email"]
                            || ""
                        }
                        
                        return (
                          <div
                            key={index}
                            className={`border rounded-lg p-4 ${
                              isPrimary 
                                ? 'bg-green-50 border-green-300 shadow-md' 
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className={`font-semibold ${
                                    isPrimary ? 'text-green-700 text-lg' : 'text-gray-900'
                                  }`}>
                                    {dm.name || "Unknown"}
                                  </h3>
                                  {isPrimary && (
                                    <Badge className="bg-green-600 text-white text-xs">
                                      Primary
                                    </Badge>
                                  )}
                                </div>
                                {dm.role && (
                                  <p className="text-sm text-gray-600 mb-2">{dm.role}</p>
                                )}
                                {email ? (
                                  <a
                                    href={`mailto:${email}`}
                                    className="text-green-600 hover:text-green-700 hover:underline text-sm flex items-center gap-1"
                                  >
                                    <Mail className="w-4 h-4" />
                                    {email}
                                  </a>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">No email address available</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    } catch (error) {
                      console.error("Error parsing decision makers:", error)
                      return (
                        <div className="text-center py-8 text-red-500">
                          <p>Error loading decision makers data.</p>
                        </div>
                      )
                    }
                  })()}
                </div>
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
