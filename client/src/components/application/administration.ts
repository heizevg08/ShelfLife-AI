import { Leaf, ScrollText, Settings2, ShieldCheck, UsersRound } from 'lucide-react';

// Product responsibilities only; these definitions do not grant API permissions.
export const administrationAreas = [
  { id: 'ingredients', path: '/Ingredients', label: 'Ingredients', Icon: Leaf, summary: 'Manage ingredients catalog' },
  { id: 'accounts', path: '/UserManagement', label: 'Users', Icon: UsersRound, summary: 'Manage authorized user accounts' },
  { id: 'security', path: '/SecurityActivity', label: 'Security & Activity', Icon: ShieldCheck, summary: 'Protected security and audit activity' },
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
    actor: ['All users', 'Super Admin', 'Admin', 'Manager', 'Inventory Staff'],
    action: ['All actions', 'Account created', 'Account updated', 'Account deleted', 'Account deactivated', 'Account reactivated'],
    period: ['Any date', 'Last week', 'Last month', 'Last year', 'Custom'],
    status: ['All statuses', 'Success', 'Failed', 'Warning'],
  },
} as const;
