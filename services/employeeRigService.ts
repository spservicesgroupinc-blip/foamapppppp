import { Employee, Rig, WorkOrderAssignment, UserProfile } from '../types';
import { supabase } from './supabaseClient';

// --- Helper: get current user id ---
const getUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  return session.user.id;
};

// --- Helper: get effective company id (admin's id) ---
const getCompanyId = async (): Promise<string> => {
  const uid = await getUserId();
  const { data } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', uid)
    .single();
  return data?.company_id || uid;
};

// =============================================
// --- Profiles ---
// =============================================
export const getProfile = async (): Promise<UserProfile | null> => {
  const uid = await getUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    role: data.role,
    companyId: data.company_id,
    displayName: data.display_name,
    phone: data.phone,
  };
};

export const ensureProfile = async (): Promise<UserProfile> => {
  const uid = await getUserId();
  let profile = await getProfile();
  if (!profile) {
    // Create a default admin profile
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: uid,
        role: 'admin',
        company_id: uid,
        display_name: session?.user?.email || 'Admin',
      })
      .select()
      .single();
    if (error) {
      console.error('ensureProfile insert error:', error);
      // Return fallback
      return { id: uid, role: 'admin', companyId: uid, displayName: session?.user?.email };
    }
    profile = {
      id: data.id,
      role: data.role,
      companyId: data.company_id,
      displayName: data.display_name,
      phone: data.phone,
    };
  }
  return profile;
};

// =============================================
// --- Employees (CRUD) ---
// =============================================
const mapEmployeeFromDb = (row: any): Employee => ({
  id: row.id,
  userId: row.user_id,
  authUserId: row.auth_user_id || undefined,
  name: row.name,
  email: row.email || '',
  phone: row.phone || '',
  role: row.role || 'Crew Member',
  hourlyRate: Number(row.hourly_rate) || 0,
  isActive: row.is_active !== false,
  notes: row.notes || undefined,
  createdAt: row.created_at || new Date().toISOString(),
});

export const getEmployees = async (): Promise<Employee[]> => {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true });
  if (error) { console.error('getEmployees error:', error); return []; }
  return (data || []).map(mapEmployeeFromDb);
};

export const saveEmployee = async (employee: Partial<Employee> & { name: string }): Promise<Employee | null> => {
  const userId = await getUserId();
  const isUuid = employee.id && /^[0-9a-f]{8}-/i.test(employee.id);

  if (isUuid) {
    const { data, error } = await supabase
      .from('employees')
      .update({
        name: employee.name,
        email: employee.email || '',
        phone: employee.phone || '',
        role: employee.role || 'Crew Member',
        hourly_rate: employee.hourlyRate || 0,
        is_active: employee.isActive !== false,
        notes: employee.notes || null,
      })
      .eq('id', employee.id)
      .select()
      .single();
    if (!error && data) return mapEmployeeFromDb(data);
  }

  // Insert new
  const { data, error } = await supabase
    .from('employees')
    .insert({
      user_id: userId,
      name: employee.name,
      email: employee.email || '',
      phone: employee.phone || '',
      role: employee.role || 'Crew Member',
      hourly_rate: employee.hourlyRate || 0,
      is_active: employee.isActive !== false,
      notes: employee.notes || null,
    })
    .select()
    .single();
  if (error) { console.error('saveEmployee error:', error); return null; }
  return mapEmployeeFromDb(data);
};

export const deleteEmployee = async (id: string): Promise<void> => {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) console.error('deleteEmployee error:', error);
};

// Generate invite link for employee to sign up
export const generateEmployeeInviteLink = async (employeeEmail: string): Promise<string> => {
  const userId = await getUserId();
  // The invite link includes the admin's user_id as the invite_code
  // Employee signs up normally and passes invite_code in metadata
  const baseUrl = window.location.origin;
  return `${baseUrl}?invite=${userId}&email=${encodeURIComponent(employeeEmail)}`;
};

// =============================================
// --- Rigs (CRUD) ---
// =============================================
const mapRigFromDb = (row: any): Rig => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  description: row.description || undefined,
  vin: row.vin || undefined,
  licensePlate: row.license_plate || undefined,
  year: row.year || undefined,
  make: row.make || undefined,
  model: row.model || undefined,
  status: row.status || 'active',
  notes: row.notes || undefined,
  createdAt: row.created_at || new Date().toISOString(),
});

export const getRigs = async (): Promise<Rig[]> => {
  const { data, error } = await supabase
    .from('rigs')
    .select('*')
    .order('name', { ascending: true });
  if (error) { console.error('getRigs error:', error); return []; }
  return (data || []).map(mapRigFromDb);
};

export const saveRig = async (rig: Partial<Rig> & { name: string }): Promise<Rig | null> => {
  const userId = await getUserId();
  const isUuid = rig.id && /^[0-9a-f]{8}-/i.test(rig.id);

  if (isUuid) {
    const { data, error } = await supabase
      .from('rigs')
      .update({
        name: rig.name,
        description: rig.description || null,
        vin: rig.vin || null,
        license_plate: rig.licensePlate || null,
        year: rig.year || null,
        make: rig.make || null,
        model: rig.model || null,
        status: rig.status || 'active',
        notes: rig.notes || null,
      })
      .eq('id', rig.id)
      .select()
      .single();
    if (!error && data) return mapRigFromDb(data);
  }

  const { data, error } = await supabase
    .from('rigs')
    .insert({
      user_id: userId,
      name: rig.name,
      description: rig.description || null,
      vin: rig.vin || null,
      license_plate: rig.licensePlate || null,
      year: rig.year || null,
      make: rig.make || null,
      model: rig.model || null,
      status: rig.status || 'active',
      notes: rig.notes || null,
    })
    .select()
    .single();
  if (error) { console.error('saveRig error:', error); return null; }
  return mapRigFromDb(data);
};

export const deleteRig = async (id: string): Promise<void> => {
  const { error } = await supabase.from('rigs').delete().eq('id', id);
  if (error) console.error('deleteRig error:', error);
};

// =============================================
// --- Work Order Assignments ---
// =============================================
const mapAssignmentFromDb = (row: any): WorkOrderAssignment => ({
  id: row.id,
  userId: row.user_id,
  estimateId: row.estimate_id,
  rigId: row.rig_id || undefined,
  assignedEmployeeIds: row.assigned_employee_ids || [],
  scheduledDate: row.scheduled_date || undefined,
  scheduledTime: row.scheduled_time || undefined,
  status: row.status || 'scheduled',
  employeeNotes: row.employee_notes || undefined,
  adminNotes: row.admin_notes || undefined,
  startedAt: row.started_at || undefined,
  completedAt: row.completed_at || undefined,
  createdAt: row.created_at || new Date().toISOString(),
  // Joined fields
  estimateNumber: row.estimate_number || undefined,
  jobName: row.job_name || undefined,
  jobAddress: row.job_address || undefined,
  jobStatus: row.job_status || undefined,
  rigName: row.rig_name || undefined,
  customerName: row.customer_name || undefined,
  customerPhone: row.customer_phone || undefined,
  customerAddress: row.customer_address || undefined,
  customerCity: row.customer_city || undefined,
  customerState: row.customer_state || undefined,
  customerZip: row.customer_zip || undefined,
  calcData: row.calc_data || undefined,
  items: row.items || undefined,
  total: row.total != null ? Number(row.total) : undefined,
  totalBoardFeetOpen: row.total_board_feet_open != null ? Number(row.total_board_feet_open) : undefined,
  totalBoardFeetClosed: row.total_board_feet_closed != null ? Number(row.total_board_feet_closed) : undefined,
  setsRequiredOpen: row.sets_required_open != null ? Number(row.sets_required_open) : undefined,
  setsRequiredClosed: row.sets_required_closed != null ? Number(row.sets_required_closed) : undefined,
});

export const getAssignments = async (): Promise<WorkOrderAssignment[]> => {
  const { data, error } = await supabase
    .from('work_order_assignments')
    .select('*')
    .order('scheduled_date', { ascending: true });
  if (error) { console.error('getAssignments error:', error); return []; }
  return (data || []).map(mapAssignmentFromDb);
};

// Get assignments with joined data (using the view)
export const getMyAssignments = async (): Promise<WorkOrderAssignment[]> => {
  const { data, error } = await supabase
    .from('my_assignments')
    .select('*')
    .order('scheduled_date', { ascending: true });
  if (error) { console.error('getMyAssignments error:', error); return []; }
  return (data || []).map(mapAssignmentFromDb);
};

export const saveAssignment = async (assignment: Partial<WorkOrderAssignment> & { estimateId: string }): Promise<WorkOrderAssignment | null> => {
  const userId = await getUserId();
  const isUuid = assignment.id && /^[0-9a-f]{8}-/i.test(assignment.id);

  if (isUuid) {
    const { data, error } = await supabase
      .from('work_order_assignments')
      .update({
        estimate_id: assignment.estimateId,
        rig_id: assignment.rigId || null,
        assigned_employee_ids: assignment.assignedEmployeeIds || [],
        scheduled_date: assignment.scheduledDate || null,
        scheduled_time: assignment.scheduledTime || null,
        status: assignment.status || 'scheduled',
        employee_notes: assignment.employeeNotes || null,
        admin_notes: assignment.adminNotes || null,
        started_at: assignment.startedAt || null,
        completed_at: assignment.completedAt || null,
      })
      .eq('id', assignment.id)
      .select()
      .single();
    if (!error && data) return mapAssignmentFromDb(data);
  }

  const { data, error } = await supabase
    .from('work_order_assignments')
    .insert({
      user_id: userId,
      estimate_id: assignment.estimateId,
      rig_id: assignment.rigId || null,
      assigned_employee_ids: assignment.assignedEmployeeIds || [],
      scheduled_date: assignment.scheduledDate || null,
      scheduled_time: assignment.scheduledTime || null,
      status: assignment.status || 'scheduled',
      employee_notes: assignment.employeeNotes || null,
      admin_notes: assignment.adminNotes || null,
    })
    .select()
    .single();
  if (error) { console.error('saveAssignment error:', error); return null; }
  return mapAssignmentFromDb(data);
};

export const updateAssignmentStatus = async (
  id: string,
  status: WorkOrderAssignment['status'],
  notes?: string
): Promise<void> => {
  const updates: any = { status };
  if (status === 'in_progress') updates.started_at = new Date().toISOString();
  if (status === 'completed') updates.completed_at = new Date().toISOString();
  if (notes !== undefined) updates.employee_notes = notes;

  const { error } = await supabase
    .from('work_order_assignments')
    .update(updates)
    .eq('id', id);
  if (error) console.error('updateAssignmentStatus error:', error);
};

export const deleteAssignment = async (id: string): Promise<void> => {
  const { error } = await supabase.from('work_order_assignments').delete().eq('id', id);
  if (error) console.error('deleteAssignment error:', error);
};

// Get assignment for a specific estimate
export const getAssignmentForEstimate = async (estimateId: string): Promise<WorkOrderAssignment | null> => {
  const { data, error } = await supabase
    .from('work_order_assignments')
    .select('*')
    .eq('estimate_id', estimateId)
    .maybeSingle();
  if (error) { console.error('getAssignmentForEstimate error:', error); return null; }
  return data ? mapAssignmentFromDb(data) : null;
};
