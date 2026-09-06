    import React, { useState, useEffect } from 'react';
    import {
    LayoutDashboard,
    Package,
    Users,
    ChevronsUpDown,
    ChevronRight,
    ChevronDown,
    BadgeCheck,
    Bell,
    LogOut,
    PanelLeft,
    UserPlus,
    X,
    TrendingUp,
    } from 'lucide-react';

    interface SidebarLayoutProps {
    children?: React.ReactNode;
    }

    interface Role {
    id: string | number;
    name: string;
    }

    interface UserProfile {
    role: string;
    email: string;
    }

    export default function SidebarLayout({ children }: SidebarLayoutProps) {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // States for fetching roles
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState<boolean>(true);

    // States for fetching user profile data
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [isLoadingUser, setIsLoadingUser] = useState<boolean>(true);
    const [userFetchError, setUserFetchError] = useState<string | null>(null);

    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        role: '',
    });

    useEffect(() => {
        const fetchData = async () => {
        try {
            setIsLoadingUser(true);
            setIsLoadingRoles(true);
            setUserFetchError(null);

            const [userResponse, rolesResponse] = await Promise.all([
            fetch('/api/user/profile'),
            fetch('/api/roles'),
            ]);

            if (!userResponse.ok) {
            throw new Error(`User fetch failed: ${userResponse.statusText}`);
            }
            if (!rolesResponse.ok) {
            throw new Error(`Roles fetch failed: ${rolesResponse.statusText}`);
            }

            const [userDataRaw, rolesDataRaw] = await Promise.all([
            userResponse.json(),
            rolesResponse.json(),
            ]);

            setUserData(userDataRaw as UserProfile);
            setRoles(rolesDataRaw as Role[]);

            if ((rolesDataRaw as Role[]).length > 0) {
            setFormData((prev) => ({
                ...prev,
                role: (rolesDataRaw as Role[])[0].name,
            }));
            }
        } catch (error) {
            console.error('Data fetching error:', error);
            setUserFetchError('Failed to load user profile.');
        } finally {
            setIsLoadingUser(false);
            setIsLoadingRoles(false);
        }
        };

        fetchData();
    }, []);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleCreateAccount = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Account Created:', formData);
        setFormData({
        email: '',
        firstName: '',
        lastName: '',
        role: roles[0]?.name || '',
        });
        setIsCreateAccountOpen(false);
    };

    return (
        <div className="flex h-screen w-screen bg-white text-gray-900 font-sans overflow-hidden">
        {/* SIDEBAR */}
        <aside
            className={`${
            isSidebarOpen ? 'w-64' : 'w-16'
            } border-r border-gray-200 bg-gray-50/50 flex flex-col justify-between relative transition-all duration-300 ease-in-out shrink-0 z-30`}
        >
            <div className={`p-3 space-y-6 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
            {/* Header Section */}
            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-200/50 cursor-pointer transition-colors min-h-[44px]">
                {isSidebarOpen && (
                <div>
                    <h1 className="text-lg font-bold tracking-tight whitespace-nowrap leading-tight">
                    ShelfLife <span className="text-emerald-600">AI</span>
                    </h1>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    Manager Portal
                    </p>
                </div>
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

            {/* Management Navigation */}
            <div className="space-y-1">
                {isSidebarOpen && (
                <p className="px-2 text-[11px] font-semibold text-gray-400 tracking-wider">
                    Management & Overview
                </p>
                )}

                <CollapsibleNavItem
                storageKey="nav_mgr_dashboard_open"
                icon={<LayoutDashboard className="h-4 w-4" />}
                label="Manager Dashboard"
                subItems={['Analytics', 'Stock Overview', 'Waste Metrics']}
                defaultOpen={true}
                isSidebarOpen={isSidebarOpen}
                />
                <CollapsibleNavItem
                storageKey="nav_mgr_inventory_open"
                icon={<Package className="h-4 w-4" />}
                label="Inventory & Stocks"
                isSidebarOpen={isSidebarOpen}
                />
                <CollapsibleNavItem
                storageKey="nav_mgr_reports_open"
                icon={<TrendingUp className="h-4 w-4" />}
                label="Reports & Logs"
                isSidebarOpen={isSidebarOpen}
                />
            </div>

            {/* Staff & Operations Section */}
            <div className="space-y-1">
                {isSidebarOpen && (
                <p className="px-2 text-[11px] font-semibold text-gray-400 tracking-wider">
                    Staff & Operations
                </p>
                )}

                <button
                onClick={() => setIsCreateAccountOpen(true)}
                className={`flex w-full items-center ${
                    isSidebarOpen ? 'justify-between px-2' : 'justify-center px-0'
                } py-1.5 rounded-md text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left`}
                title={!isSidebarOpen ? 'Add Staff Member' : undefined}
                >
                <div className="flex items-center gap-2.5">
                    <UserPlus className="h-4 w-4 shrink-0 text-emerald-600" />
                    {isSidebarOpen && (
                    <span className="whitespace-nowrap">Add Staff Member</span>
                    )}
                </div>
                </button>

                <CollapsibleNavItem
                storageKey="nav_mgr_staff_open"
                icon={<Users className="h-4 w-4" />}
                label="Staff Management"
                subItems={['Active Staff', 'Shift Logs', 'Roles & Permissions']}
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
                {/* Profile Card Header */}
                {isLoadingUser ? (
                    <div className="p-2 text-gray-500 border-b border-gray-100 mb-1">
                    Loading profile...
                    </div>
                ) : userFetchError ? (
                    <div className="flex flex-col gap-1 p-2 border-b border-gray-100 mb-1 text-red-600">
                    <span className="font-semibold">Error!</span>
                    <span className="text-[11px] text-gray-500">
                        {userFetchError}
                    </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-2 border-b border-gray-100 mb-1">
                    <img
                        src="https://api.dicebear.com/7.x/avataaars/svg?seed=manager"
                        alt="Avatar"
                        className="h-9 w-9 rounded-full bg-emerald-100 shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-gray-900 truncate">
                        {userData?.role}
                        </span>
                        <span className="text-gray-500 text-[11px] truncate">
                        {userData?.email}
                        </span>
                    </div>
                    </div>
                )}

                {/* Menu Actions (Always rendered regardless of fetch errors) */}
                <div className="space-y-0.5 border-b border-gray-100 pb-1 mb-1">
                    <MenuItem
                    icon={<BadgeCheck className="h-4 w-4" />}
                    label="Account Settings"
                    />
                    <MenuItem
                    icon={<Bell className="h-4 w-4" />}
                    label="Notifications"
                    />
                </div>

                <MenuItem
                    icon={<LogOut className="h-4 w-4" />}
                    label="Log out"
                    onClick={() => {
                    window.location.href = '/ShelfLifeLogin';
                    }}
                />
                </div>
            )}

            {/* User Profile Button in Sidebar Footer */}
            <button
                title="Manager Profile"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-lg p-2 hover:bg-gray-200/60 transition-colors text-left"
            >
                <div className="flex items-center gap-3 min-w-0">
                <img
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=manager"
                    alt="Avatar"
                    className="h-8 w-8 rounded-full bg-emerald-100 shrink-0"
                />
                {isSidebarOpen && (
                    <div className="flex flex-col text-xs leading-tight min-w-0">
                    {isLoadingUser ? (
                        <span className="text-gray-500">Loading...</span>
                    ) : userFetchError ? (
                        <span className="font-medium text-red-600">Error!</span>
                    ) : (
                        <>
                        <span className="font-semibold text-gray-900 truncate">
                            {userData?.role}
                        </span>
                        <span className="text-gray-500 text-[11px] truncate">
                            {userData?.email}
                        </span>
                        </>
                    )}
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

        {/* CREATE ACCOUNT MODAL POPUP */}
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
                        Add Staff Member
                    </h3>
                    <p className="text-xs text-gray-500">
                        Create a new account for kitchen staff or floor managers
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

                <form onSubmit={handleCreateAccount} className="space-y-5 pt-6">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Email Address
                    </label>
                    <input
                    type="email"
                    name="email"
                    required
                    placeholder="staff@shelflife.ai"
                    value={formData.email}
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
                        <option key={r.id} value={r.name}>
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
                    className="px-4 py-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                    >
                    Create Account
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
    subItems = [],
    defaultOpen = false,
    isSidebarOpen = true,
    storageKey,
    }: {
    icon: React.ReactNode;
    label: string;
    subItems?: string[];
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
            onClick={toggleOpen}
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
            {subItems.map((subItem) => (
                <a
                key={subItem}
                href="#"
                className="block rounded-md px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 transition-colors font-medium whitespace-nowrap"
                >
                {subItem}
                </a>
            ))}
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