"use client"

import { useState, useEffect, Suspense } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import {KolosLogo} from "@/app/components/svg"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"

function ClientDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState("Investor")
  const [signals, setSignals] = useState([])

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
      
      // Set default role from client profile
      const clientRole = clientData.Role || clientData["Role"] || "Investor"
      // Normalize role to match button labels
      const normalizedRole = clientRole.charAt(0).toUpperCase() + clientRole.slice(1).toLowerCase()
      if (["Investor", "Entrepreneur", "Asset Manager", "Facilitator"].includes(normalizedRole)) {
        setSelectedRole(normalizedRole)
      }
      
      // Parse recommendations JSON to get signals
      const recommendations = clientData.Recommendations || clientData["Recommendations"]
      if (recommendations) {
        try {
          const recData = typeof recommendations === "string" ? JSON.parse(recommendations) : recommendations
          if (recData.signals && Array.isArray(recData.signals)) {
            setSignals(recData.signals)
          }
        } catch (e) {
          console.error("Error parsing recommendations:", e)
        }
      }
    } catch (error) {
      console.error("Error fetching client data:", error)
    } finally {
      setLoading(false)
    }
  }
console.log("client",client)
console.log("signal",signals)
  // Get client name
  const clientName = client 
    ? (client["Full Name"] || client["Name"] || client.name || client.full_name || "Client")
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
  // Get industries from client profile
  const getIndustries = () => {
    if (!client) return []
    const industries = client.Industries || client["Industries"] || ""
    
    if (Array.isArray(industries)) {
      return industries
    }
    
    if (typeof industries === "string" && industries.trim()) {
      // Split by semicolon and clean up whitespace
      return industries.split(";").map(item => item.trim()).filter(item => item.length > 0)
    }
    
    return []
  }

  // Get regions from client profile
  const getRegions = () => {
    if (!client) return []
    const regions = client.Regions || client["Regions"] || ""
    
    if (Array.isArray(regions)) {
      return regions
    }
    
    if (typeof regions === "string" && regions.trim()) {
      // Split by semicolon and clean up whitespace
      return regions.split(";").map(item => item.trim()).filter(item => item.length > 0)
    }
    
    return []
  }

  // Get partner types from client profile
  const getPartnerTypes = () => {
    if (!client) return []
    const partnerTypes = client.Partner_types || client["Partner_types"] || client["Partner Types"] || ""
    
    if (Array.isArray(partnerTypes)) {
      return partnerTypes
    }
    
    if (typeof partnerTypes === "string" && partnerTypes.trim()) {
      // Split by semicolon and clean up whitespace
      return partnerTypes.split(";").map(item => item.trim()).filter(item => item.length > 0)
    }
    
    return []
  }

  // Get goals from client profile
  const getGoals = () => {
    if (!client) return []
    const goals = client.Goals || client["Goals"] || ""
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
          <Button onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-[284px] bg-[#03171a] text-white p-6 flex flex-col">
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
      <main className="flex-1 p-8 bg-[#f5f3f0]">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2 text-[#0a3d3d] hover:bg-[#0a3d3d]/10"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              <h1 className="text-3xl font-serif text-[#0a3d3d]">{clientName} Dashboard</h1>
            </div>
            <Avatar className="h-12 w-12">
              <AvatarImage src="/placeholder-avatar.jpg" alt={clientName} />
              <AvatarFallback>{getInitials(clientName)}</AvatarFallback>
            </Avatar>
          </div>

          {/* Select Your Role */}
          <section className="mb-8">
            <h2 className="text-xl font-serif text-[#c9a961] mb-4">Select Your Role</h2>
            <div className="grid grid-cols-4 gap-4 font-hedvig">
              {["Investor", "Entrepreneur", "Asset Manager", "Facilitator"].map((role) => (
                <Button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`rounded-full py-6 ${
                    selectedRole === role
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Check Size */}
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Check Size</div>
                    <div className="text-lg font-semibold text-[#0a3d3d]">
                      {client?.Check_size? <>{client?.Check_size} M</> : "-"}
                    </div>
                  </div>

                  {/* Company */}
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Company</div>
                    <div className="text-lg font-semibold text-[#0a3d3d]">
                      {client?.Company || client?.["Company"] || client?.company || "-"}
                    </div>
                  </div>

                  {/* Partner Types */}
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Partner Types</div>
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
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Business Goals Overview */}
          <section className="mb-8">
            <h2 className="text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">◎</span>
              Business Goals Overview
            </h2>
            <div className="grid grid-cols-2 gap-6">
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
          </section>

          {/* Live Private Deal Flow */}
          <section className="mb-8">
            <h2 className="text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">⊟</span>
              Live Private Deal Flow
            </h2>
            <Card className="bg-white border-none shadow-sm">
              <CardContent className="p-6">
                {signals.length > 0 ? (
                  <div className="space-y-6">
                    {signals.map((signal, index) => {
                      const badge = getIndustryBadge(signal.signal_type, signal.category)
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-4 hover:shadow-md transition-shadow">
                          {/* Header Row */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-[#0a3d3d] text-lg mb-2">
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
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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

          {/* Industry & Geographic Focus */}
          <section className="mb-8">
            <h2 className="text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">◇</span>
              Industry & Geographic Focus
            </h2>
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
          </section>

          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Business Requests */}
            <section>
              <h2 className="text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
                <span className="text-[#c9a961]">⊞</span>
                {clientName}'s Business Requests
              </h2>
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="p-6">
                  {client.Active_deal || client["Active_deal"] ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-12 gap-4 pb-2 border-b text-sm text-gray-600 font-medium">
                        <div className="col-span-5">Request</div>
                        <div className="col-span-4">Location</div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 items-center py-3">
                        <div className="col-span-5">
                          <div className="font-semibold">Active Deal/Project</div>
                          <div className="text-sm text-gray-600">{client.Active_deal || client["Active_deal"]}</div>
                        </div>
                        <div className="col-span-4 text-sm">
                          {client.city || client["City"] || client.regions?.[0] || client["Regions"]?.[0] || "-"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No active deals or requests at this time</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Potential Business Matches */}
            <section>
              <h2 className="text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
                <span className="text-[#c9a961]">⚭</span>
                Potential Business Matches
              </h2>
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="p-6">
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
            <h2 className="text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">✈</span>
              OPM Travel Plans
            </h2>
            <Card className="bg-white border-none shadow-sm">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 pb-2 border-b text-sm text-gray-600 font-medium">
                    <div className="col-span-3">Customer</div>
                    <div className="col-span-2">OPM #</div>
                    <div className="col-span-4">Travel Plans</div>
                    <div className="col-span-3">Date</div>
                  </div>

                  <div className="grid grid-cols-12 gap-4 items-center py-3 border-b border-gray-100">
                    <div className="col-span-3 flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>VG</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">Vit Goncharuk/AI</span>
                    </div>
                    <div className="col-span-2">
                      <Badge className="bg-[#b8d8d8] text-[#0a3d3d] hover:bg-[#b8d8d8]">OPM62</Badge>
                    </div>
                    <div className="col-span-4 text-sm">
                      <div>Washington → Miami</div>
                      <div>Washington → Finland</div>
                    </div>
                    <div className="col-span-3 text-sm">
                      <div>February 21 - 23, 2025</div>
                      <div>February 27 - March 5, 2025</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-4 items-center py-3 border-b border-gray-100">
                    <div className="col-span-3 flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>ZZ</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">Zoe Zhao/Re</span>
                    </div>
                    <div className="col-span-2">
                      <Badge className="bg-[#b8d8d8] text-[#0a3d3d] hover:bg-[#b8d8d8]">OPM55</Badge>
                    </div>
                    <div className="col-span-4 text-sm">
                      New York City → Barcelona/YPO Edge
                    </div>
                    <div className="col-span-3 text-sm">
                      February 18 - 25, 2025
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-4 items-center py-3">
                    <div className="col-span-3 flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>HH</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">Hans Hammer</span>
                    </div>
                    <div className="col-span-2">
                      <Badge className="bg-[#b8d8d8] text-[#0a3d3d] hover:bg-[#b8d8d8]">OPM53</Badge>
                    </div>
                    <div className="col-span-4 text-sm">
                      Germany → New York City
                    </div>
                    <div className="col-span-3 text-sm">
                      February 18 - 25, 2025
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Upcoming Industry Events */}
          <section className="mb-8">
            <h2 className="text-xl font-serif text-[#c9a961] mb-4 flex items-center gap-2">
              <span className="text-[#c9a961]">📅</span>
              Upcoming Industry Events
            </h2>
            <Card className="bg-white border-none shadow-sm">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 pb-2 border-b text-sm text-gray-600 font-medium">
                    <div className="col-span-4">Event</div>
                    <div className="col-span-3">Industry</div>
                    <div className="col-span-3">Location</div>
                    <div className="col-span-2">Event Date</div>
                  </div>

                  <div className="grid grid-cols-12 gap-4 items-center py-3 border-b border-gray-100">
                    <div className="col-span-4 text-[#c9a961] font-semibold">Ken Hersh Private Equity & Sports</div>
                    <div className="col-span-3">
                      <Badge className="bg-[#e8d8c8] text-[#8b5f3e] hover:bg-[#e8d8c8]">💼 Finance & Privat Equity</Badge>
                    </div>
                    <div className="col-span-3 text-sm">Virtual</div>
                    <div className="col-span-2 text-sm">March 8, 2025 (11 AM ET)</div>
                  </div>

                  <div className="grid grid-cols-12 gap-4 items-center py-3 border-b border-gray-100">
                    <div className="col-span-4 font-semibold">DFW State of the Market</div>
                    <div className="col-span-3">
                      <Badge className="bg-[#e8dcc8] text-[#8b6f3e] hover:bg-[#e8dcc8]">🏗 Real Estate & Infrastructure</Badge>
                    </div>
                    <div className="col-span-3 text-sm">Dallas, TX</div>
                    <div className="col-span-2 text-sm">March 5, 2025</div>
                  </div>

                  <div className="grid grid-cols-12 gap-4 items-center py-3 border-b border-gray-100">
                    <div className="col-span-4 font-semibold">IREI Spring Conference</div>
                    <div className="col-span-3">
                      <Badge className="bg-[#e8dcc8] text-[#8b6f3e] hover:bg-[#e8dcc8]">🏗 Real Estate & Infrastructure</Badge>
                    </div>
                    <div className="col-span-3 text-sm">Dallas, TX</div>
                    <div className="col-span-2 text-sm">March 25 - 26, 2025</div>
                  </div>

                  <div className="grid grid-cols-12 gap-4 items-center py-3">
                    <div className="col-span-4 font-semibold">Global Energy Meet (GEM) 2025</div>
                    <div className="col-span-3">
                      <Badge className="bg-[#f0e8d0] text-[#8b7537] hover:bg-[#f0e8d0]">⚡ Renewable Energy</Badge>
                    </div>
                    <div className="col-span-3 text-sm">Houston, TX</div>
                    <div className="col-span-2 text-sm">March 5-6, 2025</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
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
