import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet, redirect, Link } from '@tanstack/react-router';
import Login from '../app/ShelfLifeAILogin';
import { ApplicationWorkspace } from '../components/application/ApplicationWorkspace';
import { AuthRequestError, currentUser } from '../services/auth';
import { canOpenWorkspacePath } from '../components/application/workspace';

const root = createRootRoute({
  component: Outlet,
  notFoundComponent: () => <main className="sl-app sl-session-state"><h1>Page not found</h1><Link to="/">Return to login</Link></main>,
  errorComponent: ({ reset }) => <main className="sl-app sl-session-state"><h1>Unable to open this page</h1><p>Check your connection and try again.</p><button onClick={reset}>Retry</button><Link to="/">Return to login</Link></main>,
});
const login = createRoute({ getParentRoute: () => root, path: '/ShelfLifeAILogin', component: Login });
const home = createRoute({ getParentRoute: () => root, path: '/', beforeLoad: ({ location }) => { throw redirect({ to: '/ShelfLifeAILogin', hash: location.hash, replace: true }); } });
const workspace = createRoute({ getParentRoute: () => root, id: '_workspace', component: () => <ApplicationWorkspace><Outlet /></ApplicationWorkspace> });

async function guard(path: string) {
  try {
    const user = await currentUser();
    if (!canOpenWorkspacePath(user.role, path)) throw redirect({ to: '/', replace: true });
  } catch (error) {
    if (error instanceof AuthRequestError && error.status === 401) throw redirect({ to: '/ShelfLifeAILogin', replace: true });
    throw error;
  }
}

const pages = {
  AdminDashboard: () => import('../app/(administration)/AdminDashboard'), AdministrativeAudit: () => import('../app/(administration)/AdministrativeAudit'), AdminProfile: () => import('../app/(administration)/AdminProfile'),
  Alerts: () => import('../app/(administration)/Alerts'), ChangeRequests: () => import('../app/(administration)/ChangeRequests'), ExpirationMonitoring: () => import('../app/(administration)/ExpirationMonitoring'),
  Forecasting: () => import('../app/(administration)/Forecasting'), Ingredients: () => import('../app/(administration)/Ingredients'), Inventory: () => import('../app/(administration)/Inventory'),
  InventoryBatches: () => import('../app/(administration)/InventoryBatches'), InventoryStaffDashboard: () => import('../app/(administration)/InventoryStaffDashboard'), InventoryStaffProfile: () => import('../app/(administration)/InventoryStaffProfile'),
  ManagerDashboard: () => import('../app/(administration)/ManagerDashboard'), ManagerProfile: () => import('../app/(administration)/ManagerProfile'), MyRequests: () => import('../app/(administration)/MyRequests'),
  Reports: () => import('../app/(administration)/Reports'), ReportsAnalytics: () => import('../app/(administration)/ReportsAnalytics'), Roles: () => import('../app/(administration)/Roles'),
  SecurityActivity: () => import('../app/(administration)/SecurityActivity'), StockIn: () => import('../app/(administration)/StockIn'), SuperAdminDashboard: () => import('../app/(administration)/SuperAdminDashboard'),
  SuperAdminProfile: () => import('../app/(administration)/SuperAdminProfile'), SystemSettings: () => import('../app/(administration)/SystemSettings'), Usage: () => import('../app/(administration)/Usage'),
  UsageRecording: () => import('../app/(administration)/UsageRecording'), UsageWaste: () => import('../app/(administration)/UsageWaste'), UserManagement: () => import('../app/(administration)/UserManagement'),
  Waste: () => import('../app/(administration)/Waste'), WasteRecording: () => import('../app/(administration)/WasteRecording'),
} as const;
const protectedRoutes = Object.entries(pages).map(([path, load]) => createRoute({
  getParentRoute: () => workspace,
  path: `/${path}`,
  beforeLoad: () => guard(`/${path}`),
  component: lazyRouteComponent(load),
}));
const aliases: Record<string, string> = {
  '/ShelfLifeLogin': '/ShelfLifeAILogin', '/login': '/ShelfLifeAILogin', '/AdminAccounts': '/UserManagement',
  '/pages/AdminDash': '/AdminDashboard', '/pages/InManager': '/ManagerDashboard', '/pages/InStaff': '/InventoryStaffDashboard',
  '/pages/SuperAdminDash': '/SuperAdminDashboard', '/pages/recommendation': '/Forecasting', '/pages/reports': '/Reports',
  '/pages/subpages/RolesDash': '/Roles', '/pages/subpages/RequestDash': '/ChangeRequests', '/pages/subpages/ActiveUser': '/UserManagement',
  '/pages/SuperAdminpages/InventoryPage': '/InventoryBatches', '/pages/SuperAdminpages/ForecastingPage': '/Forecasting',
  '/pages/SuperAdminpages/ConsumptionPage': '/Usage', '/pages/SuperAdminpages/ExpirationTracPage': '/ExpirationMonitoring',
};
const redirects = Object.entries(aliases).map(([path, to]) => createRoute({ getParentRoute: () => root, path, beforeLoad: ({ location }) => { throw redirect({ to, hash: location.hash, replace: true }); } }));
export const router = createRouter({ routeTree: root.addChildren([home, login, workspace.addChildren(protectedRoutes), ...redirects]), defaultPreload: false });
