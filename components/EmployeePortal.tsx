import React, { useState, useEffect, useMemo } from 'react';
import { WorkOrderAssignment, AssignmentStatus, Employee, Rig, Estimate, Customer } from '../types';
import { getMyAssignments, getAssignments, updateAssignmentStatus, getEmployees, getRigs, saveAssignment, deleteAssignment } from '../services/employeeRigService';
import {
  ClipboardList, MapPin, Phone, Calendar, Clock, Play, CheckCircle, Truck,
  Users, ChevronRight, ArrowLeft, Package, AlertTriangle, X, Plus, Search, Filter
} from 'lucide-react';

// ============================================================
// EMPLOYEE PORTAL — what employees see when they log in
// ============================================================
interface EmployeePortalProps {
  userRole: 'admin' | 'employee';
}

const EmployeePortal: React.FC<EmployeePortalProps> = ({ userRole }) => {
  const [assignments, setAssignments] = useState<WorkOrderAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadAssignments = async () => {
    setLoading(true);
    // Use joined view for rich data
    const data = await getMyAssignments();
    setAssignments(data);
    setLoading(false);
  };

  useEffect(() => { loadAssignments(); }, []);

  const filteredAssignments = useMemo(() => {
    if (statusFilter === 'all') return assignments;
    return assignments.filter(a => a.status === statusFilter);
  }, [assignments, statusFilter]);

  const selectedAssignment = selectedId ? assignments.find(a => a.id === selectedId) : null;

  const handleStatusUpdate = async (id: string, newStatus: AssignmentStatus, notes?: string) => {
    setUpdatingStatus(true);
    await updateAssignmentStatus(id, newStatus, notes);
    await loadAssignments();
    setUpdatingStatus(false);
  };

  const statusColors: Record<AssignmentStatus, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-500',
  };

  const statusLabels: Record<AssignmentStatus, string> = {
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  // --- Detail View ---
  if (selectedAssignment) {
    const a = selectedAssignment;
    const fullAddress = [a.customerAddress, a.customerCity, a.customerState, a.customerZip].filter(Boolean).join(', ');

    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-slate-500 hover:text-brand-600 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </button>

        {/* Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-sm text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{a.estimateNumber}</span>
                <h2 className="text-xl font-bold text-slate-900 mt-2">{a.jobName || 'Work Order'}</h2>
                <p className="text-slate-500 text-sm mt-1">{a.customerName}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColors[a.status]}`}>
                {statusLabels[a.status]}
              </span>
            </div>
          </div>

          {/* Job Info */}
          <div className="p-6 space-y-4">
            {/* Location */}
            {(a.jobAddress || fullAddress) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-brand-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{a.jobAddress || fullAddress}</p>
                  {a.jobAddress && fullAddress && a.jobAddress !== fullAddress && (
                    <p className="text-xs text-slate-500 mt-0.5">{fullAddress}</p>
                  )}
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(a.jobAddress || fullAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-600 hover:underline mt-1 inline-block"
                  >
                    Open in Maps
                  </a>
                </div>
              </div>
            )}

            {/* Customer phone */}
            {a.customerPhone && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-brand-500 shrink-0" />
                <a href={`tel:${a.customerPhone}`} className="text-sm text-brand-600 hover:underline">{a.customerPhone}</a>
              </div>
            )}

            {/* Schedule */}
            {a.scheduledDate && (
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-brand-500 shrink-0" />
                <p className="text-sm text-slate-800">
                  {new Date(a.scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  {a.scheduledTime && ` at ${a.scheduledTime}`}
                </p>
              </div>
            )}

            {/* Rig */}
            {a.rigName && (
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-brand-500 shrink-0" />
                <p className="text-sm text-slate-800">{a.rigName}</p>
              </div>
            )}

            {/* Material Summary */}
            {(a.setsRequiredOpen || a.setsRequiredClosed) && (
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Materials Needed
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {(a.setsRequiredOpen ?? 0) > 0 && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-slate-500 text-xs">Open Cell</p>
                      <p className="font-bold text-blue-700">{a.setsRequiredOpen?.toFixed(2)} sets</p>
                    </div>
                  )}
                  {(a.setsRequiredClosed ?? 0) > 0 && (
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-slate-500 text-xs">Closed Cell</p>
                      <p className="font-bold text-orange-700">{a.setsRequiredClosed?.toFixed(2)} sets</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Admin Notes */}
            {a.adminNotes && (
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Notes from Admin</h4>
                <p className="text-sm text-slate-600 bg-yellow-50 p-3 rounded-lg border border-yellow-100">{a.adminNotes}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-6 border-t border-slate-100 flex flex-col gap-3">
            {a.status === 'scheduled' && (
              <button
                onClick={() => handleStatusUpdate(a.id, 'in_progress')}
                disabled={updatingStatus}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50"
              >
                <Play className="w-5 h-5" /> Start Job
              </button>
            )}
            {a.status === 'in_progress' && (
              <button
                onClick={() => handleStatusUpdate(a.id, 'completed')}
                disabled={updatingStatus}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" /> Mark Completed
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- List View ---
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Jobs</h2>
        <p className="text-slate-500 text-sm">Your assigned work orders and job schedule</p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
        {(['all', 'scheduled', 'in_progress', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${statusFilter === f ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {f === 'all' ? 'All' : statusLabels[f]}
            {f !== 'all' && (
              <span className="ml-1.5 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                {assignments.filter(a => a.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Assignment Cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading your assignments...</div>
      ) : filteredAssignments.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No jobs assigned yet</p>
          <p className="text-slate-400 text-sm mt-1">
            {statusFilter !== 'all' ? 'Try switching to "All" to see all assignments' : 'Your admin will assign work orders to you'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-left hover:shadow-md hover:border-brand-200 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[a.status]}`}>
                      {statusLabels[a.status]}
                    </span>
                    {a.estimateNumber && (
                      <span className="font-mono text-xs text-slate-400">{a.estimateNumber}</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-slate-900 truncate">{a.jobName || 'Work Order'}</h4>
                  <p className="text-sm text-slate-500 truncate">{a.customerName}</p>
                  {a.scheduledDate && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {new Date(a.scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {a.scheduledTime && <><Clock className="w-3 h-3 ml-1" /> {a.scheduledTime}</>}
                    </div>
                  )}
                  {a.rigName && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                      <Truck className="w-3 h-3" /> {a.rigName}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition-colors mt-2 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// ADMIN ASSIGNMENT PANEL — Admin assigns work orders to rigs/crews
// ============================================================
interface AssignmentPanelProps {
  estimates: Estimate[];
  customers: Customer[];
  onRefresh: () => void;
}

export const AssignmentPanel: React.FC<AssignmentPanelProps> = ({ estimates, customers, onRefresh }) => {
  const [assignments, setAssignments] = useState<WorkOrderAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rigs, setRigs] = useState<Rig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [formEstimateId, setFormEstimateId] = useState('');
  const [formRigId, setFormRigId] = useState('');
  const [formEmployeeIds, setFormEmployeeIds] = useState<string[]>([]);
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [a, e, r] = await Promise.all([
      getAssignments(),
      getEmployees(),
      getRigs(),
    ]);
    setAssignments(a);
    setEmployees(e);
    setRigs(r.filter(r => r.status === 'active'));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Work orders that can be assigned (status = Work Order and not already assigned)
  const assignableEstimates = estimates.filter(e =>
    (e.status === 'Work Order' || e.status === 'Invoiced') &&
    !assignments.some(a => a.estimateId === e.id)
  );

  const resetForm = () => {
    setFormEstimateId(''); setFormRigId(''); setFormEmployeeIds([]);
    setFormDate(''); setFormTime(''); setFormNotes('');
    setEditingId(null); setShowForm(false);
  };

  const openEdit = (a: WorkOrderAssignment) => {
    setFormEstimateId(a.estimateId);
    setFormRigId(a.rigId || '');
    setFormEmployeeIds(a.assignedEmployeeIds);
    setFormDate(a.scheduledDate || '');
    setFormTime(a.scheduledTime || '');
    setFormNotes(a.adminNotes || '');
    setEditingId(a.id);
    setShowForm(true);
  };

  const toggleEmployee = (id: string) => {
    setFormEmployeeIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!formEstimateId) return;
    setSaving(true);
    await saveAssignment({
      id: editingId || undefined,
      estimateId: formEstimateId,
      rigId: formRigId || undefined,
      assignedEmployeeIds: formEmployeeIds,
      scheduledDate: formDate || undefined,
      scheduledTime: formTime || undefined,
      adminNotes: formNotes || undefined,
      status: editingId ? undefined : 'scheduled',
    });
    await loadData();
    resetForm();
    setSaving(false);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this work order assignment?')) return;
    await deleteAssignment(id);
    await loadData();
    onRefresh();
  };

  const statusColors: Record<AssignmentStatus, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-500',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Work Order Assignments</h2>
          <p className="text-slate-500 text-sm">Assign work orders to rigs and crew members</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          disabled={assignableEstimates.length === 0 && !editingId}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Assign Work Order
        </button>
      </div>

      {assignableEstimates.length === 0 && assignments.length === 0 && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          No work orders available to assign. Create estimates and move them to "Work Order" status first.
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Assignment' : 'Assign Work Order'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Select Work Order */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Work Order *</label>
                <select
                  value={formEstimateId}
                  onChange={e => setFormEstimateId(e.target.value)}
                  disabled={!!editingId}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white disabled:bg-slate-50"
                >
                  <option value="">Select a work order...</option>
                  {(editingId
                    ? estimates.filter(e => e.id === formEstimateId || assignableEstimates.some(ae => ae.id === e.id))
                    : assignableEstimates
                  ).map(e => {
                    const cust = customers.find(c => c.id === e.customerId);
                    return (
                      <option key={e.id} value={e.id}>
                        {e.number} — {e.jobName} ({cust?.name || 'Unknown'}) — ${e.total.toLocaleString()}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Select Rig */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign Rig</label>
                <select
                  value={formRigId}
                  onChange={e => setFormRigId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
                >
                  <option value="">No rig assigned</option>
                  {rigs.map(r => <option key={r.id} value={r.id}>{r.name}{r.licensePlate ? ` (${r.licensePlate})` : ''}</option>)}
                </select>
              </div>

              {/* Select Crew */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign Crew</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                  {employees.filter(e => e.isActive).length === 0 ? (
                    <p className="text-sm text-slate-400">No employees yet. Add employees in the Employees tab.</p>
                  ) : employees.filter(e => e.isActive).map(emp => (
                    <label key={emp.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-lg p-1.5 -m-1.5">
                      <input
                        type="checkbox"
                        checked={formEmployeeIds.includes(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{emp.name}</p>
                        <p className="text-xs text-slate-500">{emp.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                  <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes for Crew</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Gate code, special instructions..." />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={resetForm} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={!formEstimateId || saving}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : editingId ? 'Update' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No assignments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const est = estimates.find(e => e.id === a.estimateId);
            const cust = est ? customers.find(c => c.id === est.customerId) : null;
            const rig = rigs.find(r => r.id === a.rigId);
            const crewNames = a.assignedEmployeeIds
              .map(id => employees.find(e => e.id === id)?.name)
              .filter(Boolean);

            return (
              <div key={a.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[a.status]}`}>
                        {a.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="font-mono text-xs text-slate-400">{est?.number}</span>
                    </div>
                    <h4 className="font-semibold text-slate-900">{est?.jobName || 'Work Order'}</h4>
                    <p className="text-sm text-slate-500">{cust?.name || 'Unknown customer'}</p>

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                      {a.scheduledDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(a.scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {a.scheduledTime && ` @ ${a.scheduledTime}`}
                        </span>
                      )}
                      {rig && (
                        <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {rig.name}</span>
                      )}
                      {crewNames.length > 0 && (
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {crewNames.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(a)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-600 text-xs">Edit</button>
                    <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeePortal;
