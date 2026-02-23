import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { getEmployees, saveEmployee, deleteEmployee, generateEmployeeInviteLink } from '../services/employeeRigService';
import { UserPlus, Edit2, Trash2, X, Check, Copy, Link, Phone, Mail, DollarSign, Users, Search, ChevronDown } from 'lucide-react';

const ROLE_OPTIONS = ['Crew Lead', 'Crew Member', 'Foreman', 'Apprentice', 'Driver'];

interface EmployeeManagerProps {
  onRefresh?: () => void;
}

const EmployeeManager: React.FC<EmployeeManagerProps> = ({ onRefresh }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('Crew Member');
  const [formRate, setFormRate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadEmployees = async () => {
    setLoading(true);
    const data = await getEmployees();
    setEmployees(data);
    setLoading(false);
  };

  useEffect(() => { loadEmployees(); }, []);

  const resetForm = () => {
    setFormName(''); setFormEmail(''); setFormPhone('');
    setFormRole('Crew Member'); setFormRate(''); setFormNotes('');
    setFormActive(true); setEditingId(null); setShowForm(false);
    setInviteLink(null);
  };

  const openEdit = (emp: Employee) => {
    setFormName(emp.name);
    setFormEmail(emp.email);
    setFormPhone(emp.phone);
    setFormRole(emp.role);
    setFormRate(emp.hourlyRate ? emp.hourlyRate.toString() : '');
    setFormNotes(emp.notes || '');
    setFormActive(emp.isActive);
    setEditingId(emp.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const empData: Partial<Employee> & { name: string } = {
      id: editingId || undefined,
      name: formName.trim(),
      email: formEmail.trim(),
      phone: formPhone.trim(),
      role: formRole,
      hourlyRate: parseFloat(formRate) || 0,
      isActive: formActive,
      notes: formNotes.trim() || undefined,
    };
    await saveEmployee(empData);
    await loadEmployees();
    resetForm();
    setSaving(false);
    onRefresh?.();
  };

  const handleDelete = async (emp: Employee) => {
    if (!window.confirm(`Delete employee "${emp.name}"? This cannot be undone.`)) return;
    await deleteEmployee(emp.id);
    await loadEmployees();
    onRefresh?.();
  };

  const handleGenerateInvite = async (email: string) => {
    if (!email) return;
    const link = await generateEmployeeInviteLink(email);
    setInviteLink(link);
  };

  const copyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const filtered = employees.filter(e => {
    if (filterActive === 'active' && !e.isActive) return false;
    if (filterActive === 'inactive' && e.isActive) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.role.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Employees</h2>
          <p className="text-slate-500 text-sm">Manage your crew members and field workers</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['active', 'inactive', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${filterActive === f ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Employee' : 'Add Employee'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input value={formName} onChange={e => setFormName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="John Smith" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input value={formEmail} onChange={e => setFormEmail(e.target.value)} type="email"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input value={formPhone} onChange={e => setFormPhone(e.target.value)} type="tel"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="(555) 123-4567" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select value={formRole} onChange={e => setFormRole(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white">
                    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate ($)</label>
                  <input value={formRate} onChange={e => setFormRate(e.target.value)} type="number" step="0.50"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="25.00" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="OSHA certified, CDL license..." />
              </div>
              {editingId && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-slate-700">Active Employee</span>
                </label>
              )}

              {/* Invite Link Section */}
              {formEmail && (
                <div className="border-t border-slate-100 pt-4">
                  <button onClick={() => handleGenerateInvite(formEmail)}
                    className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
                    <Link className="w-4 h-4" /> Generate Employee Login Invite Link
                  </button>
                  {inviteLink && (
                    <div className="mt-2 flex items-center gap-2">
                      <input readOnly value={inviteLink}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-600" />
                      <button onClick={copyInviteLink}
                        className={`p-2 rounded-lg transition-colors ${copiedLink ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={resetForm} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={!formName.trim() || saving}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : editingId ? 'Update Employee' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading employees...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No employees found</p>
          <p className="text-slate-400 text-sm mt-1">Add your first crew member to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <div key={emp.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${emp.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold uppercase ${emp.isActive ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                      {emp.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{emp.name}</h4>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        emp.role === 'Crew Lead' || emp.role === 'Foreman' ? 'bg-orange-100 text-orange-700' :
                        emp.role === 'Driver' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{emp.role}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(emp)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-600">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(emp)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  {emp.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> {emp.email}
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {emp.phone}
                    </div>
                  )}
                  {emp.hourlyRate > 0 && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" /> ${emp.hourlyRate.toFixed(2)}/hr
                    </div>
                  )}
                </div>
                {!emp.isActive && (
                  <div className="mt-3 text-xs text-red-500 font-medium">Inactive</div>
                )}
                {emp.authUserId && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-green-600">
                    <Check className="w-3 h-3" /> App Login Active
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeManager;
