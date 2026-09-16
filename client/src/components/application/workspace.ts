import { Bell, Boxes, ChartNoAxesCombined, ClipboardList, Clock, Leaf, ListChecks, PackagePlus, ScrollText, Users, Utensils } from 'lucide-react';
import type { SessionUser } from '../../services/auth';

export type WorkspaceRole = SessionUser['role'];
export const dashboardPaths: Record<WorkspaceRole, string> = {
  'Super Admin': '/SuperAdminDashboard', Admin: '/AdminDashboard', Manager: '/ManagerDashboard', 'Inventory Staff': '/InventoryStaffDashboard',
};
const operational: WorkspaceRole[] = ['Admin', 'Manager', 'Inventory Staff'];
export const modules = {
  UserManagement: { label: 'User Management', Icon: Users, roles: ['Super Admin', 'Admin'] },
  Ingredients: { label: 'Ingredients', Icon: Leaf, roles: operational },
  InventoryBatches: { label: 'Inventory Batches', Icon: Boxes, roles: operational },
  StockIn: { label: 'Stock-In', Icon: PackagePlus, roles: ['Inventory Staff'] },
  UsageWaste: { label: 'Usage & Waste', Icon: Utensils, roles: ['Manager'] },
  Usage: { label: 'Usage Records', Icon: Utensils, roles: ['Manager', 'Inventory Staff'] },
  Waste: { label: 'Waste Records', Icon: ClipboardList, roles: ['Manager', 'Inventory Staff'] },
  ExpirationMonitoring: { label: 'Expiration Monitoring', Icon: Clock, roles: ['Manager', 'Inventory Staff'] },
  ChangeRequests: { label: 'Change Requests', Icon: ListChecks, roles: ['Super Admin', 'Manager', 'Inventory Staff'] },
  Forecasting: { label: 'Forecasting & Expiration Risk', Icon: ChartNoAxesCombined, roles: ['Manager'] },
  Alerts: { label: 'Alerts', Icon: Bell, roles: ['Super Admin', 'Admin', 'Manager', 'Inventory Staff'] },
  Reports: { label: 'Reports & Analytics', Icon: ChartNoAxesCombined, roles: ['Super Admin', 'Admin', 'Manager'] },
  AdministrativeAudit: { label: 'Audit Logs', Icon: ScrollText, roles: ['Super Admin', 'Admin'] },
  Roles: { label: 'Role responsibilities', Icon: Users, roles: ['Super Admin', 'Admin'] },
} satisfies Record<string, { label: string; Icon: typeof Users; roles: WorkspaceRole[] }>;
export type ModuleId = keyof typeof modules;
export const canonicalWorkspaceAccess = {
  '/SuperAdminDashboard': ['Super Admin'],
  '/AdminDashboard': ['Admin'],
  '/ManagerDashboard': ['Manager'],
  '/InventoryStaffDashboard': ['Inventory Staff'],
  '/AdminAccounts': ['Super Admin'],
  '/SystemSettings': ['Super Admin'],
  '/SecurityActivity': ['Super Admin'],
  '/UserManagement': ['Super Admin', 'Admin'],
  '/Ingredients': ['Admin'],
  '/InventoryBatches': ['Admin', 'Manager', 'Inventory Staff'],
  '/StockIn': ['Inventory Staff'],
  '/UsageWaste': ['Manager'],
  '/Usage': ['Manager', 'Inventory Staff'],
  '/Waste': ['Manager', 'Inventory Staff'],
  '/ExpirationMonitoring': ['Manager', 'Inventory Staff'],
  '/ChangeRequests': ['Manager', 'Inventory Staff'],
  '/Forecasting': ['Manager'],
  '/Alerts': ['Admin', 'Manager'],
  '/Reports': ['Admin', 'Manager'],
  '/AdministrativeAudit': ['Super Admin', 'Admin'],
  '/Roles': ['Super Admin', 'Admin'],
} as const satisfies Record<string, readonly WorkspaceRole[]>;
export type CanonicalWorkspacePath = keyof typeof canonicalWorkspaceAccess;
const navigation: Record<WorkspaceRole, ModuleId[]> = {
  'Super Admin': ['UserManagement', 'Alerts', 'ChangeRequests', 'AdministrativeAudit', 'Reports'],
  Admin: ['UserManagement', 'Ingredients', 'InventoryBatches', 'AdministrativeAudit', 'Reports'],
  Manager: ['InventoryBatches', 'UsageWaste', 'ChangeRequests', 'Forecasting', 'Alerts', 'Reports'],
  'Inventory Staff': ['InventoryBatches', 'StockIn', 'Usage', 'Waste', 'ChangeRequests', 'Alerts'],
};
export function workspaceNavigation(role: WorkspaceRole) {
  return navigation[role].map(id => ({
    ...modules[id],
    path: `/${id}`,
    label: role === 'Admin' && id === 'UserManagement' ? 'Users' : role === 'Admin' && id === 'InventoryBatches' ? 'Inventory' : role === 'Admin' && id === 'Reports' ? 'Reports' : role === 'Inventory Staff' && id === 'ChangeRequests' ? 'My Requests' : id === 'Forecasting' ? 'Forecasting' : modules[id].label,
  }));
}
export function canOpenWorkspacePath(role: WorkspaceRole, pathname: string) {
  // Visibility and page guards share the same map; APIs still authorize every request independently.
  const canonicalRoles = canonicalWorkspaceAccess[pathname as CanonicalWorkspacePath];
  if (canonicalRoles) return (canonicalRoles as readonly WorkspaceRole[]).includes(role);
  const module = modules[pathname.slice(1) as ModuleId];
  if (module) return (module.roles as WorkspaceRole[]).includes(role);
  // Old URLs only render compatibility redirects, never legacy data or controls.
  return pathname.startsWith('/pages/') && !Object.values(dashboardPaths).includes(pathname);
}
