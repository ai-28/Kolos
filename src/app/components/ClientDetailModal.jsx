"use client";

import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

export default function ClientDetailModal({ client, isOpen, onClose }) {
  if (!isOpen || !client) return null;

  // Get all fields from the client object (excluding id and createdAt)
  const { id, createdAt, ...fields } = client;

  // Format field names for display (convert "Field Name" to "Field Name")
  const formatFieldName = (fieldName) => {
    return fieldName
      .split(/(?=[A-Z])/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Filter out empty/null/undefined values and format for display
  const displayFields = Object.entries(fields)
    .filter(([_, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
    .map(([key, value]) => {
      let displayValue = value;
      
      // Handle arrays (like attachments, multiple select fields)
      if (Array.isArray(value)) {
        displayValue = value.join(", ");
      }
      
      // Handle dates
      if (value && typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        displayValue = new Date(value).toLocaleDateString();
      }
      
      return {
        key,
        label: formatFieldName(key),
        value: displayValue,
      };
    });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-3 md:p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b flex-shrink-0">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate">Client Details</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 truncate">ID: {id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="space-y-3 sm:space-y-4">
            {displayFields.length === 0 ? (
              <p className="text-gray-500 text-center py-6 sm:py-8 text-sm sm:text-base">No details available</p>
            ) : (
              displayFields.map((field, index) => (
                <div key={index} className="border-b pb-3 sm:pb-4 last:border-b-0">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-2">
                    <div className="sm:w-1/3 flex-shrink-0">
                      <p className="text-xs sm:text-sm font-semibold text-gray-700">
                        {field.label}
                      </p>
                    </div>
                    <div className="sm:w-2/3 flex-1">
                      <p className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap break-words">
                        {String(field.value)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Metadata */}
          {createdAt && (
            <div className="mt-4 sm:mt-6 md:mt-8 pt-4 sm:pt-5 md:pt-6 border-t">
              <p className="text-xs text-gray-400">
                Created: {new Date(createdAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 md:p-6 border-t flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 sm:py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base font-medium min-h-[44px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

