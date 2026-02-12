import React, { useState } from 'react';
import { AppSettings } from '../types';
import { saveSettings, exportData, importData, clearData, logoutUser } from '../services/storage';
import { Save, Download, Upload, Trash2, LogOut, Laptop } from 'lucide-react';
import { useToast } from './Toast';

interface SettingsProps {
  settings: AppSettings;
  onSave: () => void;
  installPrompt?: any;
  onInstall?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave, installPrompt, onInstall }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<AppSettings>(settings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings(formData);
    onSave();
    showToast('Settings saved successfully', 'success');
  };

  const handleChange = (field: keyof AppSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const content = evt.target?.result as string;
        if (await importData(content)) {
           showToast('Data imported successfully!', 'success');
           onSave(); // Refresh App state
        } else {
           showToast('Failed to import data.', 'error');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      await logoutUser();
      window.location.reload();
    }
  };

  const handleClear = async () => {
    if (confirm("WARNING: This will delete all customers, estimates, and inventory. This cannot be undone. Are you sure?")) {
      await clearData();
      onSave();
      showToast('All data cleared.', 'info');
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Install App Banner for Mobile/PWA */}
      {installPrompt && onInstall && (
        <div className="bg-gradient-to-r from-brand-600 to-brand-800 p-6 rounded-xl shadow-lg text-white flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4">
           <div>
             <h3 className="text-lg font-bold flex items-center gap-2"><Laptop className="w-5 h-5"/> Install Application</h3>
             <p className="text-brand-100 text-sm">Install RFE CRM on your device home screen for offline access and better performance.</p>
           </div>
           <button 
             onClick={onInstall}
             className="bg-white text-brand-700 px-6 py-2 rounded-lg font-bold hover:bg-brand-50 transition-colors shadow-sm whitespace-nowrap"
           >
             Install Now
           </button>
        </div>
      )}

      <h2 className="text-2xl font-bold text-slate-900">System Settings</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Profile */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Company Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input type="text" className="w-full p-2 border rounded" value={formData.companyName} onChange={e => handleChange('companyName', e.target.value)} />
            </div>
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
               <input type="text" className="w-full p-2 border rounded" value={formData.companyPhone} onChange={e => handleChange('companyPhone', e.target.value)} />
            </div>
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
               <input type="text" className="w-full p-2 border rounded" value={formData.companyEmail} onChange={e => handleChange('companyEmail', e.target.value)} />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
               <input type="text" className="w-full p-2 border rounded" value={formData.companyAddress} onChange={e => handleChange('companyAddress', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Material & Yields */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Material Defaults</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-brand-600">Open Cell</h4>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Yield (Bd Ft per Set)</label>
                <input type="number" className="w-full p-2 border rounded" value={formData.openCellYield} onChange={e => handleChange('openCellYield', Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Cost per Set ($)</label>
                <input type="number" className="w-full p-2 border rounded" value={formData.openCellCost} onChange={e => handleChange('openCellCost', Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium text-blue-600">Closed Cell</h4>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Yield (Bd Ft per Set)</label>
                <input type="number" className="w-full p-2 border rounded" value={formData.closedCellYield} onChange={e => handleChange('closedCellYield', Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Cost per Set ($)</label>
                <input type="number" className="w-full p-2 border rounded" value={formData.closedCellCost} onChange={e => handleChange('closedCellCost', Number(e.target.value))} />
              </div>
            </div>
          </div>
        </div>

        {/* Financials */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Financial Defaults</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Default Labor Rate ($/hr)</label>
               <input type="number" className="w-full p-2 border rounded" value={formData.laborRate} onChange={e => handleChange('laborRate', Number(e.target.value))} />
            </div>
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
               <input type="number" step="0.1" className="w-full p-2 border rounded" value={formData.taxRate} onChange={e => handleChange('taxRate', Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="bg-brand-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-700 shadow-lg">
            <Save className="w-5 h-5" /> Save Configuration
          </button>
        </div>
      </form>

      {/* Data Management Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Data Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <button onClick={exportData} className="flex items-center justify-center gap-2 p-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
             <Download className="w-4 h-4" /> Export Data (JSON)
           </button>
           <label className="flex items-center justify-center gap-2 p-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
             <Upload className="w-4 h-4" /> Import Data
             <input type="file" accept=".json" className="hidden" onChange={handleImport} />
           </label>
           <button onClick={handleClear} className="flex items-center justify-center gap-2 p-3 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
             <Trash2 className="w-4 h-4" /> Clear Local Data
           </button>
        </div>
      </div>
      
      <div className="flex justify-center pt-8">
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-red-600">
           <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );
};

export default Settings;