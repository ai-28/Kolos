"use client"

import { Button } from "@/app/components/ui/button"
import { Loader2, FileText, Edit2, Check, Mail, CheckCircle } from "lucide-react"
import { Badge } from "@/app/components/ui/badge"

/**
 * ConnectionWorkflowStepper - Unified workflow component
 * Shows: Draft → Review → Approved → Sent
 * Displays one primary action button based on current step
 */
export function ConnectionWorkflowStepper({
  connection,
  onGenerateDraft,
  onReviewDraft,
  onApproveDraft,
  onSendEmail,
  generatingDraft,
  processing,
  gmailConnected,
  className = ""
}) {
  // Helper to check if value is truthy
  const isTruthy = (value) => {
    if (value === true || value === 1) return true
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim()
      return lower === 'true' || lower === '1' || lower === 'yes'
    }
    return false
  }

  // Determine current workflow step
  const getWorkflowStep = () => {
    const hasDraft = connection.draft_message && connection.draft_message.trim() !== ''
    const adminApproved = isTruthy(connection.admin_approved || connection['admin_approved'])
    const clientApproved = isTruthy(connection.client_approved || connection['client_approved'])
    const draftLocked = isTruthy(connection.draft_locked || connection['draft_locked'])
    const emailSent = connection.email_sent_at || connection['email_sent_at']
    const status = connection.status || 'pending'

    if (emailSent) return 'sent'
    if (draftLocked && clientApproved) return 'approved'
    if (clientApproved && !draftLocked) return 'review' // Waiting for admin final approval
    if (hasDraft && !clientApproved) return 'review' // Member can review/approve
    if (adminApproved && !hasDraft) return 'draft' // Ready to generate
    return 'pending' // Waiting for admin approval
  }

  const currentStep = getWorkflowStep()
  const steps = [
    { key: 'draft', label: 'Draft' },
    { key: 'review', label: 'Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'sent', label: 'Sent' }
  ]

  const getStepStatus = (stepKey) => {
    const stepIndex = steps.findIndex(s => s.key === stepKey)
    const currentIndex = steps.findIndex(s => s.key === currentStep)
    
    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'active'
    return 'pending'
  }

  const getPrimaryAction = () => {
    switch (currentStep) {
      case 'draft':
        return {
          label: 'Generate Draft',
          icon: FileText,
          onClick: onGenerateDraft,
          disabled: generatingDraft,
          loading: generatingDraft,
          variant: 'default',
          className: 'bg-[#0a3d3d] hover:bg-[#083030] text-white'
        }
      case 'review':
        const hasDraft = connection.draft_message && connection.draft_message.trim() !== ''
        const clientApproved = isTruthy(connection.client_approved || connection['client_approved'])
        
        if (!hasDraft) {
          return {
            label: 'Generate Draft',
            icon: FileText,
            onClick: onGenerateDraft,
            disabled: generatingDraft,
            loading: generatingDraft,
            variant: 'default',
            className: 'bg-[#0a3d3d] hover:bg-[#083030] text-white'
          }
        }
        
        if (!clientApproved) {
          return {
            label: 'Approve & Submit',
            icon: Check,
            onClick: onApproveDraft,
            disabled: processing,
            loading: processing,
            variant: 'default',
            className: 'bg-green-600 hover:bg-green-700 text-white'
          }
        }
        
        return {
          label: 'Review Draft',
          icon: Edit2,
          onClick: onReviewDraft,
          disabled: false,
          loading: false,
          variant: 'outline',
          className: ''
        }
      case 'approved':
        return {
          label: 'Send Email',
          icon: Mail,
          onClick: onSendEmail,
          disabled: !gmailConnected || processing,
          loading: processing,
          variant: 'default',
          className: 'bg-[#0a3d3d] hover:bg-[#083030] text-white'
        }
      case 'sent':
        return {
          label: 'Email Sent',
          icon: CheckCircle,
          onClick: null,
          disabled: true,
          loading: false,
          variant: 'outline',
          className: 'bg-green-50 text-green-700 border-green-300'
        }
      default:
        return null
    }
  }

  const primaryAction = getPrimaryAction()

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Step Indicators */}
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const status = getStepStatus(step.key)
          const isLast = index === steps.length - 1
          
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                {/* Step Circle */}
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                    transition-all duration-200
                    ${
                      status === 'completed'
                        ? 'bg-green-600 text-white'
                        : status === 'active'
                        ? 'bg-[#0a3d3d] text-white ring-2 ring-[#0a3d3d] ring-offset-2'
                        : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  {status === 'completed' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {/* Step Label */}
                <span
                  className={`
                    mt-1 text-xs font-medium
                    ${
                      status === 'completed'
                        ? 'text-green-600'
                        : status === 'active'
                        ? 'text-[#0a3d3d] font-semibold'
                        : 'text-gray-400'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>
              {/* Connector Line */}
              {!isLast && (
                <div
                  className={`
                    h-0.5 flex-1 mx-1
                    ${
                      status === 'completed' || getStepStatus(steps[index + 1].key) === 'completed'
                        ? 'bg-green-600'
                        : 'bg-gray-200'
                    }
                  `}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Primary Action Button */}
      {primaryAction && (
        <div className="flex justify-center pt-2">
          <Button
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            variant={primaryAction.variant}
            className={`min-h-[44px] ${primaryAction.className}`}
            size="default"
          >
            {primaryAction.loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {primaryAction.label === 'Generate Draft' ? 'Generating...' :
                 primaryAction.label === 'Approve & Submit' ? 'Submitting...' :
                 primaryAction.label === 'Send Email' ? 'Sending...' :
                 'Processing...'}
              </>
            ) : (
              <>
                {primaryAction.icon && (() => {
                  const IconComponent = primaryAction.icon
                  return <IconComponent className="w-4 h-4 mr-2" />
                })()}
                {primaryAction.label}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Status Message for Pending */}
      {currentStep === 'pending' && (
        <p className="text-xs text-center text-gray-500 italic">
          Waiting for admin approval...
        </p>
      )}
    </div>
  )
}
