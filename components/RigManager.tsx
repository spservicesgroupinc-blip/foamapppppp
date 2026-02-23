import React, { useState, useEffect } from 'react';
import { Rig, RigStatus } from '../types';
import { getRigs, saveRig, deleteRig } from '../services/employeeRigService';
import { Truck, Edit2, Trash2, X, Search, Wrench, CheckCircle, AlertTriangle } from 'lucide-react';

interface RigManagerProps {
  onRefresh?: () => void;
}

const STATUS_CONFIG: Record<RigStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  maintenance: { label: 'Maintenance', color: 'bg-yellow-100 text-yellow-700', icon: <Wrench className="w-3.5 h-3.5" /> },
  retired: { label: 'Retired', color: 'bg-slate-100 text-slate-500', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

const RigManager: React.FC<RigManagerProps> = ({ onRefresh }) => {
  const [rigs, setRigs] = useState<Rig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<RigStatus | 'all'>('all');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formVin, setFormVin] = useState('');
  const [formPlate, setFormPlate] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formMake, setFormMake] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formStatus, setFormStatus] = useState<RigStatus>('active');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRigs = async () => {
    setLoading(true);
    const data = await getRigs();
    setRigs(data);
    setLoading(false);
  };

  useEffect(() => { loadRigs(); }, []);

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormVin('');
    setFormPlate(''); setFormYear(''); setFormMake('');
    setFormModel(''); setFormStatus('active'); setFormNotes('');
    setEditingId(null); setShowForm(false);
  };

  const openEdit = (rig: Rig) => {
    setFormName(rig.name);
    setFormDescription(rig.description || '');
    setFormVin(rig.vin || '');
    setFormPlate(rig.licensePlate || '');
    setFormYear(rig.year ? rig.year.toString() : '');
    setFormMake(rig.make || '');
    setFormModel(rig.model || '');
    setFormStatus(rig.status);
    setFormNotes(rig.notes || '');
    setEditingId(rig.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const rigData: Partial<Rig> & { name: string } = {
      id: editingId || undefined,
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      vin: formVin.trim() || undefined,
      licensePlate: formPlate.trim() || undefined,
      year: parseInt(formYear) || undefined,
      make: formMake.trim() || undefined,
      model: formModel.trim() || undefined,
      status: formStatus,
      notes: formNotes.trim() || undefined,
    };
    await saveRig(rigData);
    await loadRigs();
    resetForm();
    setSaving(false);
    onRefresh?.();
  };

  const handleDelete = async (rig: Rig) => {
    if (!window.confirm(`Delete rig "${rig.name}"? This cannot be undone.`)) return;
    await deleteRig(rig.id);
    await loadRigs();
    onRefresh?.();
  };

  const filtered = rigs.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || (r.make || '').toLowerCase().includes(q) || (r.model || '').toLowerCase().includes(q) || (r.licensePlate || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Spray Rigs</h2>
          <p className="text-slate-500 text-sm">Manage your spray foam rigs and trucks</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-colors"
        >
          <Truck className="w-4 h-4" /> Add Rig
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search rigs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['all', 'active', 'maintenance', 'retired'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${filterStatus === f ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Rig' : 'Add Spray Rig'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rig Name *</label>
                <input value={formName} onChange={e => setFormName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="Rig #1 — Big Blue" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="E30 proportioner, 20' enclosed trailer" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                  <input value={formYear} onChange={e => setFormYear(e.target.value)} type="number"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="2022" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Make</label>
                  <input value={formMake} onChange={e => setFormMake(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="Ford" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                  <input value={formModel} onChange={e => setFormModel(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="F-350" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">License Plate</label>
                  <input value={formPlate} onChange={e => setFormPlate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="ABC-1234" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VIN</label>
                  <input value={formVin} onChange={e => setFormVin(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="1FTFW..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value as RigStatus)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white">
                  <option value="active">Active</option>
                  <option value="maintenance">In Maintenance</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" placeholder="Last service date, equipment details..." />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={resetForm} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={!formName.trim() || saving}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : editingId ? 'Update Rig' : 'Add Rig'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rig Cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading rigs...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No rigs found</p>
          <p className="text-slate-400 text-sm mt-1">Add your first spray rig to start assigning jobs</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(rig => {
            const statusCfg = STATUS_CONFIG[rig.status];
            return (
              <div key={rig.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${rig.status === 'retired' ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rig.status === 'active' ? 'bg-brand-100 text-brand-700' : rig.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{rig.name}</h4>
                        <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                          {statusCfg.icon} {statusCfg.label}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(rig)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(rig)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {rig.description && <p className="text-sm text-slate-500 mb-2">{rig.description}</p>}
                  <div className="space-y-1 text-sm text-slate-600">
                    {(rig.year || rig.make || rig.model) && (
                      <p>{[rig.year, rig.make, rig.model].filter(Boolean).join(' ')}</p>
                    )}
                    {rig.licensePlate && <p className="font-mono text-xs text-slate-500">Plate: {rig.licensePlate}</p>}
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

export default RigManager;
