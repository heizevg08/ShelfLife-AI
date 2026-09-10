import { Settings2, ShieldCheck, UsersRound } from 'lucide-react';

// Product responsibilities only; these definitions do not grant API permissions.
export const administrationAreas = [
  { id: 'accounts', path: '/AdminAccounts', label: 'Admin Accounts', Icon: UsersRound,
    summary: 'Administrator accounts and access',
    unavailable: 'Administrator account management is not available yet. Account totals and account changes cannot be viewed here.' },
  { id: 'settings', path: '/SystemSettings', label: 'System Settings', Icon: Settings2,
    summary: 'Application configuration',
    unavailable: 'System settings are not available yet. No configuration can be viewed or changed here.' },
  { id: 'security', path: '/SecurityActivity', label: 'Security & Activity', Icon: ShieldCheck,
    summary: 'Security events and protected audit records',
    unavailable: 'Security events and audit records are not available yet. No activity history can be shown here.' },
] as const;

export type AdministrationAreaId = typeof administrationAreas[number]['id'];
