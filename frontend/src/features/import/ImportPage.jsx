import React, { useState } from 'react';
import { toast } from '../../components/ui/sonner';
import * as contactsApi from '../../api/contacts';
import { useInvalidate } from '../../context/CacheContext';
import { ImportPreviewTable } from './ImportPreviewTable';

export function ImportPage() {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const invalidate = useInvalidate();

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    try {
      const preview = await contactsApi.previewImport(selectedFile);
      setColumns(preview.columns);
    } catch (err) {
      toast.error('Failed to preview file');
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setImporting(true);
    try {
      const importResult = await contactsApi.importContacts(file, mapping);
      setResult(importResult);
      invalidate('contacts', 'contacts.count', 'activityLogs');
    } catch (err) {
      toast.error('Import failed: ' + (err.detail || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">
        Import Contacts from Excel
      </h2>

      <div className="bg-white rounded-xl shadow-md p-4 lg:p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Excel File (.xlsx)
          </label>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileSelect}
            className="w-full px-4 py-3 sm:py-2 border border-gray-300 rounded-lg text-base"
          />
        </div>

        {columns.length > 0 && (
          <ImportPreviewTable columns={columns} mapping={mapping} onMappingChange={setMapping} />
        )}

        {columns.length > 0 && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold disabled:bg-gray-400 min-h-11 touch-manipulation"
          >
            {importing ? 'Importing...' : 'Import Contacts'}
          </button>
        )}

        {result && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-3 text-sm lg:text-base">Import Complete!</h4>
            <div className="space-y-2 text-xs lg:text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">📊 Total Excel Rows:</span>
                <span className="font-medium text-green-800">{result.original_excel_rows || 0}</span>
              </div>
              {result.file_duplicates_removed > 0 && (
                <div className="flex justify-between">
                  <span className="text-orange-700">🗂️ File Duplicates Removed:</span>
                  <span className="font-medium text-orange-800">{result.file_duplicates_removed}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-blue-700">⚙️ Rows Processed:</span>
                <span className="font-medium text-blue-800">{result.total_processed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">✅ Successfully Imported:</span>
                <span className="font-medium text-green-800">{result.imported}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">🔄 Database Duplicates:</span>
                <span className="font-medium text-red-800">{result.db_duplicates || 0}</span>
              </div>
              {result.empty_data_skipped > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">📝 Empty Data Skipped:</span>
                  <span className="font-medium text-gray-700">{result.empty_data_skipped}</span>
                </div>
              )}
              <div className="border-t border-green-300 pt-2 mt-3">
                <div className="flex justify-between font-semibold">
                  <span className="text-green-700">📋 Total Skipped:</span>
                  <span className="text-green-800">{result.skipped}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
