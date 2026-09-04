    import React, { useState, useEffect } from 'react';
    import {
    Terminal,
    Bot,
    BookOpen,
    ClockAlert,
    ChevronsUpDown,
    ChevronRight,
    ChevronDown,
    BadgeCheck,
    Bell,
    LogOut,
    PanelLeft,
    UserPlus,
    Users,
    X,
    ChartNoAxesCombined,
    MessageCircleWarning,
    } from 'lucide-react';
    import { router, Link } from 'expo-router';

    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

    interface SubItem {
    label: string;
    href?: string;
    }

    interface SidebarLayoutProps {
    children?: React.ReactNode;
    }

    interface Role {
    _id?: string;
    id?: string | number;
    name: string;
    }

    interface UserProfile {
    name?: string;
    firstName?: string;
    lastName?: string;
    role: string;
    email: string;
    }

    export default function SidebarLayout({ children }: SidebarLayoutProps) {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Current logged in user state
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: '',
    });

    const handleLogout = () => {
        setIsUserMenuOpen(false);
        router.replace('/ShelfLifeLogin');
    };

    // 1. Fetch logged-in user profile (with authentication)
    useEffect(() => {
        const fetchUserProfile = async () => {
        try {
            const token = localStorage.getItem('userToken');

            if (!token) {
            console.warn('No authentication token found in localStorage.');
            return;
            }

            const response = await fetch(`${API_BASE_URL}/api/user/me`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            });

            if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch user details`);
            }

            const responseData = await response.json();
            const raw = responseData.user || responseData.data || responseData;

            setCurrentUser({
            name: raw.name || `${raw.firstName || ''} ${raw.lastName || ''}`.trim() || 'User',
            firstName: raw.firstName,
            lastName: raw.lastName,
            role: raw.role || 'User',
            email: raw.email || 'email@example.com',
            });
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
        }
        };

        fetchUserProfile();
    }, []);

    // 2. Fetch available roles
    useEffect(() => {
        const fetchRoles = async () => {
        setIsLoadingRoles(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/roles`);
            if (response.ok) {
            const data = await response.json();
            setRoles(Array.isArray(data) ? data : data.roles || []);
            }
        } catch (error) {
            console.error('Failed to fetch roles:', error);
        } finally {
            setIsLoadingRoles(false);
        }
        };

        fetchRoles();
    }, []);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');

        try {
        const response = await fetch(`${API_BASE_URL}/api/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to create account');
        }

        setFormData({
            email: '',
            password: '',
            firstName: '',
            lastName: '',
            role: roles[0]?.name || '',
        });
        setIsCreateAccountOpen(false);
        } catch (error: any) {
        setErrorMessage(error.message);
        } finally {
        setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-screen w-screen bg-white text-gray-900 font-sans overflow-hidden">
        {/* SIDEBAR */}
        <aside
            className={`${
            isSidebarOpen ? 'w-64' : 'w-16'
            } border-r border-gray-200 bg-gray-50/50 flex flex-col justify-between relative transition-all duration-300 ease-in-out shrink-0`}
        >
            <div className={`p-3 space-y-6 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-200/50 cursor-pointer transition-colors min-h-[44px]">
                {isSidebarOpen && (
                <h1 className="text-lg font-bold tracking-tight whitespace-nowrap">
                    <Link href="/pages/SuperAdminDash" className="flex flex-col text-left no-underline">
                    <span className="text-lg font-bold tracking-tight leading-none text-gray-900">
                        ShelfLife <span className="text-emerald-600">AI</span>
                    </span>
                    <span className="text-xs font-medium text-gray-500 mt-1">
                        SuperAdmin Dashboard
                    </span>
                    </Link>
                </h1>
                )}

                <button
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className={`p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-200/60 transition-colors ${
                    !isSidebarOpen ? 'mx-auto' : ''
                }`}
                title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
                >
                <PanelLeft className="h-4 w-4" />
                </button>
            </div>

            {/* Platform Navigation */}
            <div className="space-y-1">
                {isSidebarOpen && (
                <p className="px-2 text-[11px] font-semibold text-gray-400 tracking-wider">
                    Platform
                </p>
                )}
                <CollapsibleNavItem
                storageKey="nav_home_open"
                icon={<Bot className="h-4 w-4" />}
                label="Home"
                path="/pages/SuperAdminDash"
                isSidebarOpen={isSidebarOpen}
                />
                <CollapsibleNavItem
                storageKey="nav_inventory_open"
                icon={<Terminal className="h-4 w-4" />}
                label="Inventory Management"
                path="/pages/SuperAdminpages/InventoryPage"
                defaultOpen={true}
                isSidebarOpen={isSidebarOpen}
                />
                <CollapsibleNavItem
                storageKey="nav_forecasting_open"
                icon={<Bot className="h-4 w-4" />}
                label="Expiration Risk Forecasting"
                path="/pages/SuperAdminpages/ForecastingPage"
                isSidebarOpen={isSidebarOpen}
                />
                <CollapsibleNavItem
                storageKey="nav_consumption_open"
                icon={<BookOpen className="h-4 w-4" />}
                label="Consumption"
                path="/pages/SuperAdminpages/ConsumptionPage"
                isSidebarOpen={isSidebarOpen}
                />
                <CollapsibleNavItem
                storageKey="nav_expiration_open"
                icon={<ClockAlert className="h-4 w-4" />}
                label="Expiration Tracking"
                path="/pages/SuperAdminpages/ExpirationTracPage"
                isSidebarOpen={isSidebarOpen}
                />
            </div>

            {/* User Management Section */}
            <div className="space-y-1">
                {isSidebarOpen && (
                <p className="px-2 text-[11px] font-semibold text-gray-400 tracking-wider">
                    User Management
                </p>
                )}
                <button
                onClick={() => setIsCreateAccountOpen(true)}
                className={`flex w-full items-center ${
                    isSidebarOpen ? 'justify-between px-2' : 'justify-center px-0'
                } py-1.5 rounded-md text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left`}
                title={!isSidebarOpen ? 'Create Account' : undefined}
                >
                <div className="flex items-center gap-2.5">
                    <UserPlus className="h-4 w-4 shrink-0 text-emerald-600" />
                    {isSidebarOpen && (
                    <span className="whitespace-nowrap">Create Account</span>
                    )}
                </div>
                </button>

                <CollapsibleNavItem
                storageKey="nav_accounts_open"
                icon={<Users className="h-4 w-4" />}
                label="Accounts"
                subItems={[
                    { label: 'Active Users', href: '#ActiveUsers' },
                    { label: 'Pending Requests', href: '#PendingRequests' },
                    { label: 'Roles', href: '#Roles' },
                ]}
                isSidebarOpen={isSidebarOpen}
                />
            </div>

            {/* Projects Navigation */}
            <div className="space-y-1">
                {isSidebarOpen && (
                <p className="px-2 text-[11px] font-semibold text-gray-400 tracking-wider">
                    Projects
                </p>
                )}

                <CollapsibleNavItem
                storageKey="nav_analytics_open"
                icon={<ChartNoAxesCombined className="h-4 w-4" />}
                label="Recommendation Analytics"
                isSidebarOpen={isSidebarOpen}
                />

                <CollapsibleNavItem
                storageKey="nav_reports_open"
                icon={<MessageCircleWarning className="h-4 w-4" />}
                label="Report & Analytics"
                isSidebarOpen={isSidebarOpen}
                />
            </div>
            </div>

            {/* User Profile Section */}
            <div className={`p-3 relative ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
            {isUserMenuOpen && (
                <div
                className={`absolute bottom-full mb-2 ${
                    isSidebarOpen ? 'left-3 right-3 w-auto' : 'left-2 w-52'
                } rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl z-50 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150`}
                >
                <div className="flex items-center gap-3 p-2 border-b border-gray-100 mb-1">
                    <img
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=shadcn"
                    alt="Avatar"
                    className="h-9 w-9 rounded-full bg-purple-100 shrink-0"
                    />
                    <div className="flex flex-col truncate">
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-900 truncate">
                        {currentUser?.name || currentUser?.firstName || 'User'}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 shrink-0">
                        {currentUser?.role || 'User'}
                        </span>
                    </div>
                    <span className="text-gray-500 text-[11px] truncate">
                        {currentUser?.email || 'email@example.com'}
                    </span>
                    </div>
                </div>

                <MenuItem
                    icon={<LogOut className="h-4 w-4" />}
                    label="Log out"
                    onClick={handleLogout}
                />
                </div>
            )}

            <button
                title={currentUser?.name || currentUser?.firstName || 'User'}
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-lg p-2 hover:bg-gray-200/60 transition-colors text-left"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                <img
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=shadcn"
                    alt="Avatar"
                    className="h-8 w-8 rounded-full bg-purple-100 shrink-0"
                />
                {isSidebarOpen && (
                    <div className="flex flex-col text-xs leading-tight whitespace-nowrap overflow-hidden">
                    <span className="font-semibold text-gray-900 truncate">
                        {currentUser?.name || currentUser?.firstName || 'User'}
                    </span>
                    <span className="text-gray-500 text-[11px] truncate">
                        {currentUser?.email || 'email@example.com'}
                    </span>
                    </div>
                )}
                </div>
                {isSidebarOpen && (
                <ChevronsUpDown className="h-4 w-4 text-gray-400 shrink-0" />
                )}
            </button>
            </div>
        </aside>

        {/* DYNAMIC CONTENT AREA */}
        <main className="flex-1 h-full overflow-y-auto bg-white p-6">
            {children}
        </main>

        {/* CREATE ACCOUNT POPUP */}
        {isCreateAccountOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                    <UserPlus className="h-6 w-6" />
                    </div>
                    <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        Create New Account
                    </h3>
                    <p className="text-xs text-gray-500">
                        Add a new user to your organization
                    </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsCreateAccountOpen(false)}
                    className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
                </div>

                {errorMessage !== '' && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                    {errorMessage}
                </div>
                )}

                <form onSubmit={handleCreateAccount} className="space-y-5 pt-6">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Email Address
                    </label>
                    <input
                    type="email"
                    name="email"
                    required
                    placeholder="jane.doe@company.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Initial Password
                    </label>
                    <input
                    type="password"
                    name="password"
                    required
                    placeholder="Enter initial password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        First Name
                    </label>
                    <input
                        type="text"
                        name="firstName"
                        required
                        placeholder="Jane"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    </div>

                    <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Last Name
                    </label>
                    <input
                        type="text"
                        name="lastName"
                        required
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Role
                    </label>
                    <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    disabled={isLoadingRoles}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white disabled:bg-gray-50"
                    >
                    {isLoadingRoles ? (
                        <option value="">Loading roles...</option>
                    ) : (
                        roles.map((r) => (
                        <option key={r._id || r.id || r.name} value={r.name}>
                            {r.name}
                        </option>
                        ))
                    )}
                    </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                    type="button"
                    onClick={() => setIsCreateAccountOpen(false)}
                    className="px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                    Cancel
                    </button>
                    <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                    >
                    {isSubmitting ? 'Creating...' : 'Create Account'}
                    </button>
                </div>
                </form>
            </div>
            </div>
        )}
        </div>
    );
    }

    function CollapsibleNavItem({
    icon,
    label,
    path,
    subItems = [],
    defaultOpen = false,
    isSidebarOpen = true,
    storageKey,
    }: {
    icon: React.ReactNode;
    label: string;
    path?: string;
    subItems?: (string | SubItem)[];
    defaultOpen?: boolean;
    isSidebarOpen?: boolean;
    storageKey: string;
    }) {
    const [isOpen, setIsOpen] = useState(() => {
        if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) {
            return JSON.parse(saved);
        }
        }
        return defaultOpen;
    });

    const hasSubItems = subItems.length > 0;

    const toggleOpen = () => {
        if (!hasSubItems) return;
        setIsOpen((prev: boolean) => {
        const nextState = !prev;
        localStorage.setItem(storageKey, JSON.stringify(nextState));
        return nextState;
        });
    };

    return (
        <div className="space-y-1">
        <button
            title={!isSidebarOpen ? label : undefined}
            onClick={() => {
            if (path) {
                router.push(path as any);
                return;
            }
            toggleOpen();
            }}
            className={`flex w-full items-center ${
            isSidebarOpen ? 'justify-between px-2' : 'justify-center px-0'
            } py-1.5 rounded-md text-xs text-gray-700 hover:bg-gray-200/50 transition-colors font-medium text-left`}
        >
            <div className="flex items-center gap-2.5">
            <span className="text-gray-500 shrink-0">{icon}</span>
            {isSidebarOpen && <span className="whitespace-nowrap">{label}</span>}
            </div>
            {isSidebarOpen &&
            hasSubItems &&
            (isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            ) : (
                <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            ))}
        </button>

        {isSidebarOpen && hasSubItems && isOpen && (
            <div className="ml-4 pl-3 border-l border-gray-200 space-y-1 my-1">
            {subItems.map((subItem) => {
                const item =
                typeof subItem === 'string'
                    ? { label: subItem, href: '#' }
                    : subItem;

                return (
                <Link
                    key={item.label}
                    href={(item.href as any) || '#'}
                    className="block rounded-md px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 transition-colors font-medium whitespace-nowrap"
                >
                    {item.label}
                </Link>
                );
            })}
            </div>
        )}
        </div>
    );
    }

    function MenuItem({
    icon,
    label,
    onClick,
    }: {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    }) {
    return (
        <button
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 transition-colors"
        >
        <span className="text-gray-500 shrink-0">{icon}</span>
        <span>{label}</span>
        </button>
    );
    }