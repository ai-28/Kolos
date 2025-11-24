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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Client Details</h2>
            <p className="text-sm text-gray-500 mt-1">ID: {id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {displayFields.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No details available</p>
            ) : (
              displayFields.map((field, index) => (
                <div key={index} className="border-b pb-4 last:border-b-0">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="sm:w-1/3 flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-700">
                        {field.label}
                      </p>
                    </div>
                    <div className="sm:w-2/3 flex-1">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
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
            <div className="mt-8 pt-6 border-t">
              <p className="text-xs text-gray-400">
                Created: {new Date(createdAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

