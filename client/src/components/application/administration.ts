import { Bell, Boxes, ChartNoAxesCombined, ClipboardList, Clock, Leaf, ListChecks, ScrollText, Settings2, ShieldCheck, UsersRound, Utensils } from 'lucide-react';

// Product responsibilities only; these definitions do not grant API permissions.
export const administrationAreas = [
  { id: 'accounts', path: '/AdminAccounts', label: 'Users', Icon: UsersRound, summary: 'Manage authorized user accounts' },
  { id: 'settings', path: '/SystemSettings', label: 'System Settings', Icon: Settings2, summary: 'Application configuration' },
  { id: 'security', path: '/SecurityActivity', label: 'Security & Activity', Icon: ShieldCheck, summary: 'Protected security and audit activity' },

  { id: 'ingredients', path: '/Ingredients', label: 'Ingredients', Icon: Leaf, summary: 'Ingredient master-data oversight' },
  { id: 'batches', path: '/InventoryBatches', label: 'Inventory Batches', Icon: Boxes, summary: 'Inventory batch oversight' },
  { id: 'usage', path: '/Usage', label: 'Usage', Icon: Utensils, summary: 'Ingredient usage oversight' },
  { id: 'waste', path: '/Waste', label: 'Waste', Icon: ClipboardList, summary: 'Waste record oversight' },
  { id: 'requests', path: '/ChangeRequests', label: 'Change Requests', Icon: ListChecks, summary: 'Operational change-review oversight' },
  { id: 'expiration', path: '/ExpirationMonitoring', label: 'Expiration / FEFO', Icon: Clock, summary: 'Expiration and FEFO oversight' },
  { id: 'forecasting', path: '/Forecasting', label: 'Forecasting', Icon: ChartNoAxesCombined, summary: 'Forecasting oversight' },
  { id: 'alerts', path: '/Alerts', label: 'Alerts', Icon: Bell, summary: 'Inventory and expiration attention queue' },
  { id: 'reports', path: '/Reports', label: 'Reports & Analytics', Icon: ChartNoAxesCombined, summary: 'Reporting and analytics oversight' },
  { id: 'audit', path: '/AdministrativeAudit', label: 'Audit Logs', Icon: ScrollText, summary: 'Protected administrative audit records', hidden: true },
] as const;

export type AdministrationAreaId = typeof administrationAreas[number]['id'];

// Presentation vocabulary for filter panels. Keep route components free of inline option arrays.
// Backend services may replace/augment these values when their canonical filter metadata endpoints exist.
export const administrationFilterCatalog = {
  alerts: {
    type: ['All types', 'Expiration', 'Stock level', 'Waste risk'],
    severity: ['All severities', 'Critical', 'High', 'Medium', 'Low'],
    status: ['All statuses', 'Open', 'Investigating', 'Pending action', 'Acknowledged', 'Resolved'],
  },
  changeRequests: {
    status: ['All statuses', 'Pending', 'Approved', 'Rejected'],
    requestType: ['All request types', 'Threshold override', 'Discard batch', 'Reorder level'],
    period: ['Any date', 'Last 7 days', 'Last 30 days', 'Last 90 days'],
  },
  audit: {
    actor: ['All users', 'Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'],
    action: ['All actions', 'Account created', 'Account updated', 'Account deactivated', 'Account reactivated'],
    period: ['Any date', 'Last week', 'Last month', 'Last year', 'Custom'],
    status: ['All statuses', 'Success', 'Failed', 'Warning'],
  },
} as const;