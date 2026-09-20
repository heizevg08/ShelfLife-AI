import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet, redirect, Link } from '@tanstack/react-router';
import Login from '../pages/Login';
import { ApplicationWorkspace } from '../components/application/ApplicationWorkspace';
import { AuthRequestError, currentUser } from '../services/auth';
import { canOpenWorkspacePath } from '../components/application/workspace';

const root = createRootRoute({ component: Outlet,
  notFoundComponent: () => <main className="sl-app sl-session-state"><h1>Page not found</h1><Link to="/">Return to login</Link></main>,
  errorComponent: ({ reset }) => <main className="sl-app sl-session-state"><h1>Unable to open this page</h1><p>Check your connection and try again.</p><button onClick={reset}>Retry</button><Link to="/">Return to login</Link></main>,
});
const login = createRoute({ getParentRoute: () => root, path: '/ShelfLifeAILogin', component: Login });
const home = createRoute({ getParentRoute: () => root, path: '/', beforeLoad: ({ location }) => { throw redirect({ to: '/ShelfLifeAILogin', hash: location.hash, replace: true }); } });
const forgot = createRoute({ getParentRoute: () => root, path: '/forgot-password', component: () => <Login recovery /> });
const reset = createRoute({ getParentRoute: () => root, path: '/reset-password', component: () => <Login recovery /> });
const forbidden = createRoute({ getParentRoute: () => root, path: '/forbidden', component: () => <main className="sl-app sl-session-state"><h1>This page is restricted</h1><p>Your account cannot access this page.</p><Link to="/">Return to login</Link></main> });
const workspace = createRoute({ getParentRoute: () => root, id: '_workspace', component: () => <ApplicationWorkspace><Outlet /></ApplicationWorkspace> });
async function guard(path: string) {
  let user;
  try { user = await currentUser(); }
  catch (error) { if (error instanceof AuthRequestError && error.status === 401) throw redirect({ to: '/ShelfLifeAILogin', replace: true }); throw error; }
  if (!canOpenWorkspacePath(user.role, path)) throw redirect({ to: '/forbidden', replace: true });
}
const protectedRoutes = [
  createRoute({ getParentRoute: () => workspace, path: '/AdminAccounts', beforeLoad: () => guard('/AdminAccounts'), component: lazyRouteComponent(() => import('../pages/workspace/AdminAccounts')) }),
  createRoute({ getParentRoute: () => workspace, path: '/AdminDashboard', beforeLoad: () => guard('/AdminDashboard'), component: lazyRouteComponent(() => import('../pages/workspace/AdminDashboard')) }),
  createRoute({ getParentRoute: () => workspace, path: '/AdministrativeAudit', beforeLoad: () => guard('/AdministrativeAudit'), component: lazyRouteComponent(() => import('../pages/workspace/AdministrativeAudit')) }),
  createRoute({ getParentRoute: () => workspace, path: '/Alerts', beforeLoad: () => guard('/Alerts'), component: lazyRouteComponent(() => import('../pages/workspace/Alerts')) }),
  createRoute({ getParentRoute: () => workspace, path: '/ChangeRequests', beforeLoad: () => guard('/ChangeRequests'), component: lazyRouteComponent(() => import('../pages/workspace/ChangeRequests')) }),
  createRoute({ getParentRoute: () => workspace, path: '/ExpirationMonitoring', beforeLoad: () => guard('/ExpirationMonitoring'), component: lazyRouteComponent(() => import('../pages/workspace/ExpirationMonitoring')) }),
  createRoute({ getParentRoute: () => workspace, path: '/Forecasting', beforeLoad: () => guard('/Forecasting'), component: lazyRouteComponent(() => import('../pages/workspace/Forecasting')) }),
  createRoute({ getParentRoute: () => workspace, path: '/Ingredients', beforeLoad: () => guard('/Ingredients'), component: lazyRouteComponent(() => import('../pages/workspace/Ingredients')) }),
  createRoute({ getParentRoute: () => workspace, path: '/Inventory', beforeLoad: () => guard('/Inventory'), component: lazyRouteComponent(() => import('../pages/workspace/Inventory')) }),
  createRoute({ getParentRoute: () => workspace, path: '/InventoryBatches', beforeLoad: () => guard('/InventoryBatches'), component: lazyRouteComponent(() => import('../pages/workspace/InventoryBatches')) }),
  createRoute({ getParentRoute: () => workspace, path: '/InventoryStaffDashboard', beforeLoad: () => guard('/InventoryStaffDashboard'), component: lazyRouteComponent(() => import('../pages/workspace/InventoryStaffDashboard')) }),
  createRoute({ getParentRoute: () => workspace, path: '/ManagerDashboard', beforeLoad: () => guard('/ManagerDashboard'), component: lazyRouteComponent(() => import('../pages/workspace/ManagerDashboard')) }),
  createRoute({ getParentRoute: () => workspace, path: '/Reports', beforeLoad: () => guard('/Reports'), component: lazyRouteComponent(() => import('../pages/workspace/Reports')) }),
  createRoute({ getParentRoute: () => workspace, path: '/Roles', beforeLoad: () => guard('/Roles'), component: lazyRouteComponent(() => import('../pages/workspace/Roles')) }),
  createRoute({ getParentRoute: () => workspace, path: '/SecurityActivity', beforeLoad: () => guard('/SecurityActivity'), component: lazyRouteComponent(() => import('../pages/workspace/SecurityActivity')) }),
  createRoute({ getParentRoute: () => workspace, path: '/StockIn', beforeLoad: () => guard('/StockIn'), component: lazyRouteComponent(() => import('../pages/workspace/StockIn')) }),
  createRoute({ getParentRoute: () => workspace, path: '/SuperAdminDashboard', beforeLoad: () => guard('/SuperAdminDashboard'), component: lazyRouteComponent(() => import('../pages/workspace/SuperAdminDashboard')) }),
  createRoute({ getParentRoute: () => workspace, path: '/SystemSettings', beforeLoad: () => guard('/SystemSettings'), component: lazyRouteComponent(() => import('../pages/workspace/SystemSettings')) }),
  createRoute({ getParentRoute: () => workspace, path: '/Usage', beforeLoad: () => guard('/Usage'), component: lazyRouteComponent(() => import('../pages/workspace/Usage')) }),
  createRoute({ getParentRoute: () => workspace, path: '/UsageWaste', beforeLoad: () => guard('/UsageWaste'), component: lazyRouteComponent(() => import('../pages/workspace/UsageWaste')) }),
  createRoute({ getParentRoute: () => workspace, path: '/UserManagement', beforeLoad: () => guard('/UserManagement'), component: lazyRouteComponent(() => import('../pages/workspace/UserManagement')) }),
  createRoute({ getParentRoute: () => workspace, path: '/Waste', beforeLoad: () => guard('/Waste'), component: lazyRouteComponent(() => import('../pages/workspace/Waste')) }),
];
const aliases: Record<string, string> = {
  "/ShelfLifeLogin": "/ShelfLifeAILogin",
  "/login": "/ShelfLifeAILogin",
  "/pages/AdminDash": "/AdminDashboard",
  "/pages/InManager": "/ManagerDashboard",
  "/pages/InStaff": "/InventoryStaffDashboard",
  "/pages/SuperAdminDash": "/SuperAdminDashboard",
  "/pages/recommendation": "/Forecasting",
  "/pages/reports": "/Reports",
  "/pages/subpages/RolesDash": "/Roles",
  "/pages/subpages/RequestDash": "/ChangeRequests",
  "/pages/subpages/ActiveUser": "/UserManagement",
  "/pages/SuperAdminpages/InventoryPage": "/InventoryBatches",
  "/pages/SuperAdminpages/ForecastingPage": "/Forecasting",
  "/pages/SuperAdminpages/ConsumptionPage": "/Usage",
  "/pages/SuperAdminpages/ExpirationTracPage": "/ExpirationMonitoring"
};
const redirects = Object.entries(aliases).map(([path, to]) => createRoute({ getParentRoute: () => root, path, beforeLoad: ({ location }) => { throw redirect({ to, hash: location.hash, replace: true }); } }));
export const router = createRouter({ routeTree: root.addChildren([home, login, forgot, reset, forbidden, workspace.addChildren(protectedRoutes), ...redirects]), defaultPreload: false });
