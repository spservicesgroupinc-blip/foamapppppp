import React, { useEffect, useState, useMemo } from 'react';
import { Customer, Estimate, JobStatus, DocumentType, statusToDocumentType } from '../types';
import { Search, Plus, User, MapPin, Phone, Mail, ArrowLeft, Calendar, FileText, Pencil, Check, ChevronRight, ClipboardList, FileCheck, DollarSign, Archive, FileDown, Receipt, Package } from 'lucide-react';
import { saveCustomer } from '../services/storage';
import { useToast } from './Toast';

interface CRMProps {
  customers: Customer[];
  estimates: Estimate[];
  onRefresh: () => void;
  onNavigate?: (view: string, context?: { customerId?: string; jobId?: string; editEstimateId?: string }) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onDeleteEstimate?: (estimate: Estimate) => void;
  onStatusChange?: (est: Estimate, newStatus: JobStatus) => void;
  onGeneratePDF?: (estimateId: string) => void;
  openAddOnLoad?: boolean;
  autoSelectCustomerId?: string;
  initialTab?: 'customers' | 'jobs';
  jobsFilter?: string;
  onJobsFilterChange?: (filter: string) => void;
}

const CRM: React.FC<CRMProps> = ({ customers, estimates: allEstimates, onRefresh, onNavigate, onDeleteCustomer, onDeleteEstimate, onStatusChange, onGeneratePDF, openAddOnLoad, autoSelectCustomerId, initialTab, jobsFilter = 'All', onJobsFilterChange }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'customers' | 'jobs'>(initialTab || 'customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({});

  useEffect(() => {
    if (openAddOnLoad) {
      setSelectedCustomer(null);
      setIsAdding(true);
      setActiveTab('customers');
    }
  }, [openAddOnLoad]);

  // Auto-select customer when navigating from estimate save
  useEffect(() => {
    if (autoSelectCustomerId) {
      const customer = customers.find(c => c.id === autoSelectCustomerId);
      if (customer) {
        setSelectedCustomer(customer);
        setIsAdding(false);
        setActiveTab('customers');
      }
    }
  }, [autoSelectCustomerId, customers]);

  // Switch to jobs tab if initialTab changes
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const customerEstimates = selectedCustomer 
    ? allEstimates.filter(e => e.customerId === selectedCustomer.id) 
    : [];

  // Jobs tab: filter estimates
  const filteredEstimates = useMemo(() => {
    let result = allEstimates;
    if (jobsFilter !== 'All') {
      result = result.filter(e => e.status === jobsFilter);
    }
    if (searchTerm && activeTab === 'jobs') {
      const term = searchTerm.toLowerCase();
      result = result.filter(e => {
        const customer = customers.find(c => c.id === e.customerId);
        return (
          e.jobName.toLowerCase().includes(term) ||
          e.number.toLowerCase().includes(term) ||
          customer?.name.toLowerCase().includes(term) ||
          customer?.companyName?.toLowerCase().includes(term)
        );
      });
    }
    return result;
  }, [allEstimates, jobsFilter, searchTerm, activeTab, customers]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;

    const customer: Customer = {
      id: Date.now().toString(),
      name: newCustomer.name || '',
      companyName: newCustomer.companyName || '',
      email: newCustomer.email || '',
      phone: newCustomer.phone || '',
      address: newCustomer.address || '',
      city: newCustomer.city || '',
      state: newCustomer.state || '',
      zip: newCustomer.zip || '',
      createdAt: new Date().toISOString()
    };
    
    const saved = await saveCustomer(customer);
    showToast("Customer Added", "success");
    setIsAdding(false);
    setNewCustomer({});
    setSelectedCustomer({ ...customer, id: saved.id });
    onRefresh();
  };

  // Determine the "most advanced" estimate stage for this customer
  const getCustomerWorkflowStage = () => {
    if (customerEstimates.length === 0) return null;
    const statusOrder = [JobStatus.DRAFT, JobStatus.WORK_ORDER, JobStatus.INVOICED, JobStatus.PAID, JobStatus.ARCHIVED];
    const activeEstimates = customerEstimates.filter(e => e.status !== JobStatus.ARCHIVED);
    if (activeEstimates.length === 0) return null;
    activeEstimates.sort((a, b) => {
      const aIdx = statusOrder.indexOf(a.status);
      const bIdx = statusOrder.indexOf(b.status);
      if (aIdx !== bIdx) return aIdx - bIdx;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return activeEstimates[0];
  };

  const getNextAction = (est: Estimate) => {
    switch (est.status) {
      case JobStatus.DRAFT:
        return { label: 'Mark Job Sold', sublabel: 'Generate Work Order', nextStatus: JobStatus.WORK_ORDER, color: 'bg-orange-500 hover:bg-orange-600', icon: ClipboardList };
      case JobStatus.WORK_ORDER:
        return { label: 'Create Invoice', sublabel: 'Bill the customer', nextStatus: JobStatus.INVOICED, color: 'bg-blue-600 hover:bg-blue-700', icon: FileCheck };
      case JobStatus.INVOICED:
        return { label: 'Mark as Paid', sublabel: 'Payment received', nextStatus: JobStatus.PAID, color: 'bg-green-600 hover:bg-green-700', icon: DollarSign };
      case JobStatus.PAID:
        return { label: 'Archive Job', sublabel: 'Move to archive', nextStatus: JobStatus.ARCHIVED, color: 'bg-slate-500 hover:bg-slate-600', icon: Archive };
      default:
        return null;
    }
  };

  const workflowSteps = [JobStatus.DRAFT, JobStatus.WORK_ORDER, JobStatus.INVOICED, JobStatus.PAID];
  const workflowLabels: Record<string, string> = {
    [JobStatus.DRAFT]: 'Estimate',
    [JobStatus.WORK_ORDER]: 'Work Order',
    [JobStatus.INVOICED]: 'Invoiced',
    [JobStatus.PAID]: 'Paid',
  };

  // Helper to get customer job count & total for customer cards
  const getCustomerSummary = (customerId: string) => {
    const ests = allEstimates.filter(e => e.customerId === customerId);
    const activeJobs = ests.filter(e => e.status !== JobStatus.ARCHIVED);
    const totalValue = ests.reduce((a, e) => a + e.total, 0);
    return { jobCount: ests.length, activeJobs: activeJobs.length, totalValue };
  };

  // ======================= CUSTOMER DETAIL VIEW =======================
  if (selectedCustomer) {
    const lifetimeValue = customerEstimates.reduce((acc, curr) => acc + curr.total, 0);
    const actionableEstimate = getCustomerWorkflowStage();
    const nextAction = actionableEstimate ? getNextAction(actionableEstimate) : null;

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <button 
          onClick={() => setSelectedCustomer(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-brand-600 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </button>

        {/* Customer Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div className="flex items-center gap-4">
               <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-600">
                 <User className="w-8 h-8" />
               </div>
               <div>
                 <h1 className="text-2xl font-bold text-slate-900">{selectedCustomer.name}</h1>
                 <p className="text-slate-500">{selectedCustomer.companyName}</p>
               </div>
             </div>
             <div className="text-right space-y-2">
                <p className="text-sm text-slate-500">Lifetime Value</p>
                <p className="text-2xl font-bold text-green-600">${lifetimeValue.toLocaleString()}</p>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('calculator', { customerId: selectedCustomer.id })}
                    className="mt-2 bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-1.5 ml-auto"
                  >
                    <Plus className="w-4 h-4" /> New Estimate
                  </button>
                )}
                {onDeleteCustomer && (
                  <button
                    onClick={() => {
                      onDeleteCustomer(selectedCustomer.id);
                      setSelectedCustomer(null);
                    }}
                    className="mt-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Delete Customer
                  </button>
                )}
             </div>
          </div>

          {/* Contact Info */}
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" /> {selectedCustomer.email || 'N/A'}
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" /> {selectedCustomer.phone || 'N/A'}
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" /> 
                {selectedCustomer.address ? `${selectedCustomer.address}, ${selectedCustomer.city}, ${selectedCustomer.state} ${selectedCustomer.zip}` : 'N/A'}
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" /> Added {new Date(selectedCustomer.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Stage Tracker */}
        {actionableEstimate && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Active Workflow</h3>
                <span className="text-xs text-slate-500 font-mono">{actionableEstimate.number} &mdash; {actionableEstimate.jobName}</span>
              </div>
              <div className="flex items-center gap-1">
                {workflowSteps.map((step, i) => {
                  const currentIdx = workflowSteps.indexOf(actionableEstimate.status);
                  const isComplete = i < currentIdx;
                  const isCurrent = i === currentIdx;
                  return (
                    <React.Fragment key={step}>
                      <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                        isCurrent ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-400 shadow-sm' :
                        isComplete ? 'bg-green-100 text-green-700' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {isComplete && <Check className="w-4 h-4" />}
                        {workflowLabels[step]}
                      </div>
                      {i < workflowSteps.length - 1 && (
                        <div className={`flex-1 h-1 rounded-full ${
                          isComplete ? 'bg-green-300' :
                          isCurrent ? 'bg-brand-200' :
                          'bg-slate-200'
                        }`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
            {nextAction && onStatusChange && (
              <div className="p-6">
                <button
                  onClick={() => {
                    onStatusChange(actionableEstimate, nextAction.nextStatus);
                  }}
                  className={`w-full py-5 px-8 rounded-xl text-white font-bold text-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${nextAction.color}`}
                >
                  <nextAction.icon className="w-6 h-6" />
                  <div className="text-left">
                    <div>{nextAction.label}</div>
                    <div className="text-sm font-normal opacity-80">{nextAction.sublabel}</div>
                  </div>
                  <ChevronRight className="w-6 h-6 ml-auto" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* No estimates yet - prompt to create one */}
        {customerEstimates.length === 0 && onNavigate && (
          <div className="bg-gradient-to-r from-brand-50 to-blue-50 rounded-xl border border-brand-200 p-8 text-center">
            <ClipboardList className="w-12 h-12 text-brand-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800 mb-1">Ready to get started?</h3>
            <p className="text-slate-500 text-sm mb-4">Create an estimate for this customer to begin the workflow.</p>
            <button
              onClick={() => onNavigate('calculator', { customerId: selectedCustomer.id })}
              className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Create Estimate
            </button>
          </div>
        )}

        {/* Job History */}
        {customerEstimates.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Jobs & Estimates ({customerEstimates.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {customerEstimates.map(est => (
                <div key={est.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-2 rounded border shrink-0 ${
                      est.status === JobStatus.DRAFT ? 'bg-blue-50 border-blue-200' :
                      est.status === JobStatus.WORK_ORDER ? 'bg-amber-50 border-amber-200' :
                      est.status === JobStatus.INVOICED ? 'bg-green-50 border-green-200' :
                      est.status === JobStatus.PAID ? 'bg-emerald-50 border-emerald-200' :
                      'bg-slate-50 border-slate-200'
                    }`}>
                      {est.status === JobStatus.WORK_ORDER ? <ClipboardList className="w-5 h-5 text-amber-600" /> :
                       est.status === JobStatus.INVOICED || est.status === JobStatus.PAID ? <Receipt className="w-5 h-5 text-green-600" /> :
                       <FileText className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{est.jobName}</p>
                      <p className="text-xs text-slate-500">{est.number} • {new Date(est.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-2 shrink-0 ml-4">
                     <p className="font-bold text-slate-900">${est.total.toLocaleString()}</p>
                     <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        est.status === JobStatus.DRAFT ? 'bg-blue-100 text-blue-700' :
                        est.status === JobStatus.WORK_ORDER ? 'bg-amber-100 text-amber-700' :
                        est.status === JobStatus.INVOICED ? 'bg-green-100 text-green-700' :
                        est.status === JobStatus.PAID ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-200 text-slate-600'
                     }`}>{est.status}</span>
                     <div className="flex items-center justify-end gap-2 mt-1">
                       {onNavigate && (
                        <button
                          onClick={() => onNavigate('jobDetail', { jobId: est.id, customerId: selectedCustomer.id })}
                          className="text-xs text-slate-600 hover:text-slate-700 font-medium"
                        >
                          View
                        </button>
                       )}
                       {onNavigate && (
                        <button
                          onClick={() => onNavigate('calculator', { editEstimateId: est.id })}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                       )}
                       {onGeneratePDF && (() => {
                        const docType = statusToDocumentType(est.status);
                        const pdfLabel = docType === DocumentType.INVOICE ? 'Invoice' : docType === DocumentType.WORK_ORDER ? 'Work Order' : 'Estimate';
                        const pdfColor = docType === DocumentType.INVOICE ? 'text-green-600 hover:text-green-700' : docType === DocumentType.WORK_ORDER ? 'text-amber-600 hover:text-amber-700' : 'text-blue-600 hover:text-blue-700';
                        const PdfIcon = docType === DocumentType.INVOICE ? Receipt : docType === DocumentType.WORK_ORDER ? ClipboardList : FileDown;
                        return (
                          <button
                            onClick={() => onGeneratePDF(est.id)}
                            className={`text-xs ${pdfColor} font-medium flex items-center gap-1`}
                          >
                            <PdfIcon className="w-3 h-3" /> {pdfLabel} PDF
                          </button>
                        );
                       })()}
                       {onDeleteEstimate && (
                        <button
                          onClick={() => onDeleteEstimate(est)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                       )}
                     </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ======================= MAIN TABBED VIEW =======================
  return (
    <div className="space-y-6">
      {/* Tab Switcher + Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => { setActiveTab('customers'); setSearchTerm(''); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'customers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2"><User className="w-4 h-4" /> Customers</span>
          </button>
          <button
            onClick={() => { setActiveTab('jobs'); setSearchTerm(''); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'jobs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> All Jobs</span>
          </button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {activeTab === 'jobs' && (
            <select 
              className="p-2 border rounded-lg bg-white text-sm"
              value={jobsFilter}
              onChange={(e) => onJobsFilterChange?.(e.target.value)}
            >
              <option value="All">All Jobs</option>
              <option value={JobStatus.DRAFT}>Drafts</option>
              <option value={JobStatus.WORK_ORDER}>Work Orders</option>
              <option value={JobStatus.INVOICED}>Invoices</option>
              <option value={JobStatus.PAID}>Paid</option>
              <option value={JobStatus.ARCHIVED}>Archived</option>
            </select>
          )}
          <div className="relative flex-grow sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={activeTab === 'customers' ? 'Search customers...' : 'Search jobs...'}
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-brand-500 focus:border-brand-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === 'customers' && (
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800 shrink-0"
            >
              <Plus className="w-4 h-4" /> Add New
            </button>
          )}
        </div>
      </div>

      {/* New Customer Form */}
      {isAdding && activeTab === 'customers' && (
        <div className="bg-white p-6 rounded-xl border border-brand-200 shadow-sm animate-in slide-in-from-top-4">
          <h3 className="font-bold text-lg mb-4">New Customer Profile</h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <input className="p-2 border rounded" placeholder="Full Name *" required value={newCustomer.name || ''} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
             <input className="p-2 border rounded" placeholder="Company Name" value={newCustomer.companyName || ''} onChange={e => setNewCustomer({...newCustomer, companyName: e.target.value})} />
             <input className="p-2 border rounded" placeholder="Email" type="email" value={newCustomer.email || ''} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
             <input className="p-2 border rounded" placeholder="Phone" type="tel" value={newCustomer.phone || ''} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
             <input className="p-2 border rounded md:col-span-2" placeholder="Street Address" value={newCustomer.address || ''} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} />
             <div className="grid grid-cols-3 gap-2 md:col-span-2">
               <input className="p-2 border rounded" placeholder="City" value={newCustomer.city || ''} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} />
               <input className="p-2 border rounded" placeholder="State" value={newCustomer.state || ''} onChange={e => setNewCustomer({...newCustomer, state: e.target.value})} />
               <input className="p-2 border rounded" placeholder="ZIP" value={newCustomer.zip || ''} onChange={e => setNewCustomer({...newCustomer, zip: e.target.value})} />
             </div>
             <div className="md:col-span-2 flex justify-end gap-2 mt-2">
               <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
               <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700">Save Customer</button>
             </div>
          </form>
        </div>
      )}

      {/* ===================== CUSTOMERS TAB ===================== */}
      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const summary = getCustomerSummary(c.id);
            return (
            <div 
              key={c.id} 
              onClick={() => setSelectedCustomer(c)}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 p-2 rounded-full group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
                    <User className="w-5 h-5 text-slate-600 group-hover:text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{c.name}</h3>
                    {c.companyName && <p className="text-xs text-slate-500">{c.companyName}</p>}
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                {c.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{c.address}, {c.city}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>
              {/* Summary Stats */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                <div className="flex items-center gap-3 text-slate-500">
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {summary.jobCount} job{summary.jobCount !== 1 ? 's' : ''}</span>
                  {summary.totalValue > 0 && <span className="font-medium text-green-600">${summary.totalValue.toLocaleString()}</span>}
                </div>
                <div className="flex items-center gap-3">
                  {onDeleteCustomer && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCustomer(c.id);
                      }}
                      className="text-red-600 font-medium hover:underline"
                    >
                      Delete
                    </button>
                  )}
                  <span className="text-brand-600 font-medium group-hover:underline">Open →</span>
                </div>
              </div>
            </div>
          )})}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
              {searchTerm ? 'No customers matching your search.' : 'No customers yet. Add your first customer to get started.'}
            </div>
          )}
        </div>
      )}

      {/* ===================== ALL JOBS TAB ===================== */}
      {activeTab === 'jobs' && (
        <>
          {/* Mobile View: Cards */}
          <div className="md:hidden space-y-4">
            {filteredEstimates.map(est => {
              const customer = customers.find(c => c.id === est.customerId);
              return (
                <div key={est.id}
                  onClick={() => onNavigate?.('jobDetail', { jobId: est.id, customerId: est.customerId })}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-brand-200 hover:shadow-md transition-all active:scale-[0.99]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{est.number}</span>
                      <h3 className="font-bold text-slate-900 mt-1">{est.jobName || 'Untitled Job'}</h3>
                      <p className="text-xs text-slate-500">
                        {customer?.name && <span className="text-brand-600 font-medium">{customer.name}</span>}
                        {' • '}{new Date(est.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">${est.total.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                    <span className={`text-xs rounded-full px-2.5 py-1 font-medium
                        ${est.status === JobStatus.PAID ? 'bg-green-50 text-green-700' : 
                          est.status === JobStatus.WORK_ORDER ? 'bg-orange-50 text-orange-700' :
                          est.status === JobStatus.INVOICED ? 'bg-blue-50 text-blue-700' :
                          'bg-slate-50 text-slate-700'}`}
                    >
                      {est.status}
                    </span>
                    <span className="text-xs text-brand-600 font-medium">View Details →</span>
                  </div>
                  {est.inventoryDeducted && (
                    <div className="mt-2 text-[10px] text-green-600 flex items-center gap-1 bg-green-50 p-1 rounded w-fit">
                      <Package className="w-3 h-3"/> Inventory Allocated
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigate?.('calculator', { editEstimateId: est.id }); }}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    {onGeneratePDF && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onGeneratePDF(est.id); }}
                        className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                      >
                        <FileDown className="w-3 h-3" /> PDF
                      </button>
                    )}
                    {onDeleteEstimate && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteEstimate(est); }}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredEstimates.length === 0 && (
              <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">No jobs found.</div>
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Ref #</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Job</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEstimates.map(est => {
                  const customer = customers.find(c => c.id === est.customerId);
                  return (
                  <tr key={est.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onNavigate?.('jobDetail', { jobId: est.id, customerId: est.customerId })}>
                    <td className="px-6 py-4 font-mono text-slate-600">{est.number}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const c = customers.find(cu => cu.id === est.customerId);
                          if (c) setSelectedCustomer(c);
                        }}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {customer?.name || 'Unknown'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-slate-800">{est.jobName}</td>
                    <td className="px-6 py-4 text-slate-600">{new Date(est.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      ${est.total.toLocaleString()}
                      {est.inventoryDeducted && (
                        <div className="text-[10px] text-green-600 flex items-center gap-1 mt-1">
                          <Package className="w-3 h-3"/> Allocated
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs rounded-full px-2.5 py-1 font-medium
                        ${est.status === JobStatus.PAID ? 'bg-green-50 text-green-700' :
                          est.status === JobStatus.WORK_ORDER ? 'bg-orange-50 text-orange-700' :
                          est.status === JobStatus.INVOICED ? 'bg-blue-50 text-blue-700' :
                          'bg-slate-50 text-slate-700'}`}
                      >
                        {est.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigate?.('calculator', { editEstimateId: est.id }); }}
                          className="text-sm text-brand-600 hover:underline font-medium"
                        >
                          Edit
                        </button>
                        {onGeneratePDF && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onGeneratePDF(est.id); }}
                            className="text-sm text-green-600 hover:underline font-medium"
                          >
                            PDF
                          </button>
                        )}
                        {onDeleteEstimate && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteEstimate(est); }}
                            className="text-sm text-red-600 hover:underline font-medium"
                          >
                            Delete
                          </button>
                        )}
                        <span className="text-sm text-slate-500 font-medium hover:underline">View →</span>
                      </div>
                    </td>
                  </tr>
                )})}
                {filteredEstimates.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No jobs found matching this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CRM;
