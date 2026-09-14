export type UserRole = 'insti_team' | 'warehouse_officer' | 'admin' | 'approving_officer';

export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'preparing'
  | 'prepared'
  | 'released'
  | 'completed'
  | 'cancelled';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  department: string | null;
  warehouse_id: string | null;
  warehouse_ids: string[];
  active: boolean;
  created_at: string;
}

export function hasRole(profile: Pick<AppUser, 'roles'> | null | undefined, role: UserRole): boolean {
  return !!profile?.roles?.includes(role);
}

export function hasAnyRole(profile: Pick<AppUser, 'roles'> | null | undefined, roles: UserRole[]): boolean {
  return !!profile && roles.some((r) => profile.roles?.includes(r));
}

export interface Warehouse {
  id: string;
  warehouse_code: string;
  warehouse_name: string;
  location: string | null;
  assigned_officer_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreCustomer {
  id: string;
  customer_code: string;
  customer_name: string;
  address: string | null;
  contact_person: string | null;
  contact_number: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DispenserItem {
  id: string;
  item_code: string;
  item_description: string;
  category: string | null;
  uom: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DispenserRequestItem {
  id: string;
  request_id: string;
  item_id: string;
  quantity_requested: number;
  quantity_prepared: number | null;
  quantity_released: number | null;
  variance_reason: string | null;
  release_variance_reason: string | null;
  preparation_remarks: string | null;
  release_remarks: string | null;
  prepared_by: string | null;
  prepared_at: string | null;
  released_by: string | null;
  released_at: string | null;
  received_by_customer: string | null;
  dispenser_items?: DispenserItem;
}

export interface DispenserRequest {
  id: string;
  request_no: string;
  requested_by: string;
  department: string | null;
  store_customer_id: string | null;
  customer_code_snapshot: string | null;
  customer_name_snapshot: string | null;
  customer_address_snapshot: string | null;
  customer_contact_person_snapshot: string | null;
  customer_contact_number_snapshot: string | null;
  warehouse_id: string;
  required_date: string;
  status: RequestStatus;
  remarks: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  warehouses?: Warehouse;
  users?: AppUser;
  dispenser_request_items?: DispenserRequestItem[];
}

export interface RequestHistoryEntry {
  id: string;
  request_id: string;
  action: string;
  previous_status: RequestStatus | null;
  new_status: RequestStatus | null;
  performed_by: string | null;
  remarks: string | null;
  created_at: string;
  users?: AppUser;
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  preparing: 'Preparing',
  prepared: 'Prepared',
  released: 'Released',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  insti_team: 'Sales Agent',
  warehouse_officer: 'Warehouse Officer',
  admin: 'Admin / Inventory Analyst',
  approving_officer: 'Approving Officer',
};
