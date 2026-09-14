import { supabase } from './supabase';

export const REQUEST_SELECT = `
  *,
  warehouses ( id, warehouse_code, warehouse_name, location, assigned_officer_id ),
  users!dispenser_requests_requested_by_fkey ( id, name, email, department ),
  dispenser_request_items ( *, dispenser_items ( * ) )
`;

export async function fetchRequests(filters: {
  requestedBy?: string;
  warehouseId?: string;
  warehouseIds?: string[];
  status?: string;
  orderBy?: string;
} = {}) {
  let q = supabase.from('dispenser_requests').select(REQUEST_SELECT).order(filters.orderBy || 'created_at', { ascending: false });
  if (filters.requestedBy) q = q.eq('requested_by', filters.requestedBy);
  if (filters.warehouseId) q = q.eq('warehouse_id', filters.warehouseId);
  if (filters.warehouseIds && filters.warehouseIds.length > 0) q = q.in('warehouse_id', filters.warehouseIds);
  if (filters.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchRequestById(id: string) {
  const { data, error } = await supabase.from('dispenser_requests').select(REQUEST_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchHistory(requestId: string) {
  const { data, error } = await supabase
    .from('request_history')
    .select('*, users ( id, name )')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}
