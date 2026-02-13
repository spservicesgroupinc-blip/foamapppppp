import React, { useEffect, useState } from 'react';
import { Customer, Estimate, JobStatus } from '../types';
import { Search, Plus, User, MapPin, Phone, Mail, ArrowLeft, Calendar, FileText, Pencil, Check, ChevronRight, ClipboardList, FileCheck, DollarSign, Archive } from 'lucide-react';
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
  openAddOnLoad?: boolean;
  autoSelectCustomerId?: string;
}

const CRM: React.FC<CRMProps> = ({ customers, estimates: allEstimates, onRefresh, onNavigate, onDeleteCustomer, onDeleteEstimate, onStatusChange, openAddOnLoad, autoSelectCustomerId }) => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({});

  useEffect(() => {
    if (openAddOnLoad) {
      setSelectedCustomer(null);
      setIsAdding(true);
    }
  }, [openAddOnLoad]);

  // Auto-select customer when navigating from estimate save
  useEffect(() => {
    if (autoSelectCustomerId) {
      const customer = customers.find(c => c.id === autoSelectCustomerId);
      if (customer) {
        setSelectedCustomer(customer);
        setIsAdding(false);
      }
    }
  }, [autoSelectCustomerId, customers]);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const customerEstimates = selectedCustomer 
    ? allEstimates.filter(e => e.customerId === selectedCustomer.id) 
    : [];

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
    // Optimistically set the new customer as selected so the page opens to their profile
    setSelectedCustomer({ ...customer, id: saved.id });
    onRefresh();
  };

  // Determine the "most advanced" estimate stage for this customer
  const getCustomerWorkflowStage = () => {
    if (customerEstimates.length === 0) return null;
    const statusOrder = [JobStatus.DRAFT, JobStatus.WORK_ORDER, JobStatus.INVOICED, JobStatus.PAID, JobStatus.ARCHIVED];
    // Find the latest active (non-archived) estimate by most recent status
    const activeEstimates = customerEstimates.filter(e => e.status !== JobStatus.ARCHIVED);
    if (activeEstimates.length === 0) return null;
    // Sort by status precedence (latest first) then by date
    activeEstimates.sort((a, b) => {
      const aIdx = statusOrder.indexOf(a.status);
      const bIdx = statusOrder.indexOf(b.status);
      if (aIdx !== bIdx) return aIdx - bIdx; // earliest stage first (needs action)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return activeEstimates[0]; // The estimate that needs the most immediate action
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
          <ArrowLeft className="w-4 h-4" /> Back to List
        </button>

        {/* Workflow Stage Tracker */}
        {actionableEstimate && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Workflow Progress</h3>
                <span className="text-xs text-slate-500 font-mono">{actionableEstimate.number} &mdash; {actionableEstimate.jobName}</span>
              </div>
              {/* Progress Steps */}
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
            {/* Large Next Action Button */}
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
               <h3 className="font-semibold text-slate-800 border-b pb-2">Contact Info</h3>
               <div className="space-y-3 text-sm text-slate-600">
                 <div className="flex items-center gap-3">
                   <Mail className="w-4 h-4 text-slate-400" /> {selectedCustomer.email || 'N/A'}
                 </div>
                 <div className="flex items-center gap-3">
                   <Phone className="w-4 h-4 text-slate-400" /> {selectedCustomer.phone || 'N/A'}
                 </div>
                 <div className="flex items-center gap-3">
                   <MapPin className="w-4 h-4 text-slate-400" /> 
                   {selectedCustomer.address}, {selectedCustomer.city}, {selectedCustomer.state} {selectedCustomer.zip}
                 </div>
                 <div className="flex items-center gap-3">
                   <Calendar className="w-4 h-4 text-slate-400" /> Added {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                 </div>
               </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              <h3 className="font-semibold text-slate-800 border-b pb-2">Job History</h3>
              {customerEstimates.length === 0 ? (
                <p className="text-slate-500 text-sm">No jobs found for this customer.</p>
              ) : (
                <div className="space-y-3">
                  {customerEstimates.map(est => (
                    <div key={est.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-brand-200 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <FileText className="w-5 h-5 text-brand-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{est.jobName}</p>
                          <p className="text-xs text-slate-500">{est.number} • {new Date(est.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                         <p className="font-bold text-slate-900">${est.total.toLocaleString()}</p>
                         <span className="text-xs px-2 py-0.5 bg-slate-200 rounded-full text-slate-600">{est.status}</span>
                         <div className="flex items-center justify-end gap-2 mt-1">
                           {onNavigate && (
                            <button
                              onClick={() => onNavigate('calculator', { editEstimateId: est.id })}
                              className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                           )}
                           {onNavigate && (
                            <button
                              onClick={() => onNavigate('jobDetail', { jobId: est.id })}
                              className="text-xs text-slate-600 hover:text-slate-700 font-medium"
                            >
                              View
                            </button>
                           )}
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
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Customers</h2>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-grow md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search customers..." 
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-brand-500 focus:border-brand-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" /> Add New
          </button>
        </div>
      </div>

      {isAdding && (
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
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
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="truncate">{c.address}, {c.city}</span>
              </div>
              {c.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{c.phone}</span>
                </div>
              )}
              {c.email && (
                 <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{c.email}</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
              <span>Added: {new Date(c.createdAt).toLocaleDateString()}</span>
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
                <span className="text-brand-600 font-medium group-hover:underline">View Profile →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CRM;