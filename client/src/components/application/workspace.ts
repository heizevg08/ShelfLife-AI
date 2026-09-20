import { Bell, Boxes, ChartNoAxesCombined, ClipboardList, Clock, Leaf, ListChecks, PackagePlus, ScrollText, Users, Utensils } from 'lucide-react';
import type { SessionUser } from '../../services/auth';

export type WorkspaceRole = SessionUser['role'];
export const dashboardPaths: Record<WorkspaceRole, string> = {
  'Super Admin': '/SuperAdminDashboard', Admin: '/AdminDashboard', 'Inventory Manager': '/ManagerDashboard', 'Inventory Staff': '/InventoryStaffDashboard',
};
export const modules = {
  UserManagement: { label: 'User Management', Icon: Users },
  Ingredients: { label: 'Ingredients', Icon: Leaf },
  InventoryBatches: { label: 'Inventory Batches', Icon: Boxes },
  StockIn: { label: 'Stock-In', Icon: PackagePlus },
  UsageWaste: { label: 'Usage & Waste', Icon: Utensils },
  Usage: { label: 'Usage Records', Icon: Utensils },
  Waste: { label: 'Waste Records', Icon: ClipboardList },
  ExpirationMonitoring: { label: 'Expiration Monitoring', Icon: Clock },
  ChangeRequests: { label: 'Change Requests', Icon: ListChecks },
  Forecasting: { label: 'Forecasting & Expiration Risk', Icon: ChartNoAxesCombined },
  Alerts: { label: 'Alerts', Icon: Bell },
  Reports: { label: 'Reports & Analytics', Icon: ChartNoAxesCombined },
  AdministrativeAudit: { label: 'Audit Logs', Icon: ScrollText },
  Roles: { label: 'Role responsibilities', Icon: Users },
} satisfies Record<string, { label: string; Icon: typeof Users }>;
export type ModuleId = keyof typeof modules;
// API-backed pages follow server/src/routes guards. Other pages are previews,
// not a promise of API access until their services and authorization exist.
export const canonicalWorkspaceAccess = {
  '/SuperAdminDashboard': ['Super Admin'],
  '/AdminDashboard': ['Admin'],
  '/ManagerDashboard': ['Inventory Manager'],
  '/InventoryStaffDashboard': ['Inventory Staff'],
  '/AdminAccounts': ['Super Admin'],
  '/SystemSettings': ['Super Admin'],
  '/SecurityActivity': ['Super Admin'],
  '/UserManagement': ['Super Admin', 'Admin'],
  '/Ingredients': ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'],
  '/InventoryBatches': ['Super Admin', 'Admin', 'Inventory Staff'],
  '/Inventory': ['Inventory Manager'],
  '/StockIn': ['Inventory Staff'],
  '/UsageWaste': ['Inventory Manager'],
  '/Usage': ['Super Admin', 'Inventory Manager', 'Inventory Staff'],
  '/Waste': ['Super Admin', 'Inventory Manager', 'Inventory Staff'],
  '/ExpirationMonitoring': ['Super Admin', 'Inventory Manager', 'Inventory Staff'],
  '/ChangeRequests': ['Super Admin', 'Inventory Manager', 'Inventory Staff'],
  '/Forecasting': ['Super Admin', 'Inventory Manager'],
  '/Alerts': ['Super Admin', 'Admin', 'Inventory Manager'],
  '/Reports': ['Super Admin', 'Admin', 'Inventory Manager'],
  '/AdministrativeAudit': ['Super Admin', 'Admin'],
  '/Roles': ['Super Admin', 'Admin'],
} as const satisfies Record<string, readonly WorkspaceRole[]>;
export type CanonicalWorkspacePath = keyof typeof canonicalWorkspaceAccess;
const navigation: Record<WorkspaceRole, ModuleId[]> = {
  'Super Admin': ['UserManagement', 'Alerts', 'ChangeRequests', 'AdministrativeAudit', 'Reports'],
  Admin: ['UserManagement', 'Ingredients', 'InventoryBatches', 'AdministrativeAudit', 'Reports'],
  'Inventory Manager': ['Ingredients', 'InventoryBatches', 'UsageWaste', 'ChangeRequests', 'Forecasting', 'Alerts', 'Reports'],
  'Inventory Staff': ['Ingredients', 'InventoryBatches', 'StockIn', 'Usage', 'Waste', 'ChangeRequests'],
};
export function workspaceNavigation(role: WorkspaceRole) {
  return navigation[role].map(id => ({
    ...modules[id],
    path: role === 'Inventory Manager' && id === 'InventoryBatches' ? '/Inventory' : `/${id}`,
    label: role === 'Admin' && id === 'UserManagement' ? 'Users' : (role === 'Admin' || role === 'Inventory Manager') && id === 'InventoryBatches' ? 'Inventory' : role === 'Admin' && id === 'Reports' ? 'Reports' : role === 'Inventory Staff' && id === 'ChangeRequests' ? 'My Requests' : id === 'Forecasting' ? 'Forecasting' : modules[id].label,
  })).filter(item => canOpenWorkspacePath(role, item.path));
}
export function canOpenWorkspacePath(role: WorkspaceRole, pathname: string) {
  // Visibility and page guards share the same map; APIs still authorize every request independently.
  const canonicalRoles = canonicalWorkspaceAccess[pathname as CanonicalWorkspacePath];
  if (canonicalRoles) return (canonicalRoles as readonly WorkspaceRole[]).includes(role);
  return false;
}

export const ingredientPermissions = (role: WorkspaceRole) => ({
  create: role === 'Inventory Manager' || role === 'Inventory Staff',
  update: role === 'Inventory Manager',
  remove: role === 'Inventory Manager',
});
