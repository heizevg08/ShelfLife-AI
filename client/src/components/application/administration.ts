import { Bell, ChartNoAxesCombined, ListChecks, ScrollText, Settings2, ShieldCheck, UsersRound } from 'lucide-react';

// Product responsibilities only; these definitions do not grant API permissions.
export const administrationAreas = [
  { id: 'accounts', path: '/UserManagement', label: 'User Management', Icon: UsersRound,
    summary: 'Manage Admin, Manager and Inventory Staff accounts' },
  { id: 'alerts', path: '/Alerts', label: 'Alerts', Icon: Bell,
    summary: 'Inventory and expiration attention queue' },
  { id: 'requests', path: '/ChangeRequests', label: 'Change Requests', Icon: ListChecks,
    summary: 'Operational change-review workspace' },
  { id: 'audit', path: '/AdministrativeAudit', label: 'Audit Logs', Icon: ScrollText,
    summary: 'Protected administrative audit records' },
  { id: 'reports', path: '/Reports', label: 'Reports', Icon: ChartNoAxesCombined,
    summary: 'Waste and forecasting reporting workspace' },
  { id: 'settings', path: '/SystemSettings', label: 'System Settings', Icon: Settings2,
    summary: 'Application configuration' },
  // Compatibility route retained for bookmarks; it is intentionally not duplicated in the sidebar.
  { id: 'security', path: '/SecurityActivity', label: 'Security & Activity', Icon: ShieldCheck,
    summary: 'Protected administrative audit records', hidden: true },
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
    actor: ['All actors', 'Super Admin', 'Admin', 'Manager', 'Inventory Staff'],
    action: ['All actions', 'Account created', 'Account updated', 'Account deactivated', 'Account reactivated'],
    period: ['Any date', 'Last 7 days', 'Last 30 days', 'Last 90 days'],
  },
} as const;