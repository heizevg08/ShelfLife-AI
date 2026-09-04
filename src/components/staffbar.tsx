    // src/components/sidebar.tsx
    import React, { useState, useEffect } from 'react';
    import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
    import { useRouter, usePathname } from 'expo-router';
    import { 
    Package, 
    QrCode, 
    LogOut, 
    ChevronRight,
    ChevronDown,
    AlertTriangle,
    ChevronsUpDown,
    PanelLeft,
    Bell,
    BadgeCheck,
    LucideIcon
    } from 'lucide-react-native';

    interface SidebarLayoutProps {
    children?: React.ReactNode;
    }

    interface UserProfile {
    name: string;
    role: string;
    email: string;
    avatarSeed?: string;
    }

    interface NavSubItem {
    name: string;
    path: string;
    }

    interface NavItemConfig {
    label: string;
    icon: LucideIcon;
    storageKey: string;
    subItems?: NavSubItem[];
    defaultOpen?: boolean;
    }

    export default function SidebarLayout({ children }: SidebarLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [isLoadingUser, setIsLoadingUser] = useState(true);
    const [userFetchError, setUserFetchError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserProfile = async () => {
        try {
            setIsLoadingUser(true);
            setUserFetchError(null);

            const response = await fetch('/api/user/profile');

            if (!response.ok) {
            throw new Error(`Failed to fetch profile: ${response.status} ${response.statusText}`);
            }

            const data: UserProfile = await response.json();
            setUserData(data);
        } catch (error) {
            console.error('Error fetching user profile:', error);
            setUserFetchError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setIsLoadingUser(false);
        }
        };

        fetchUserProfile();
    }, []);

    const handleLogout = () => {
        setIsUserMenuOpen(false);
        router.replace('/ShelfLifeLogin' as any);
    };

    const avatarSeed = userData?.avatarSeed || userData?.email || 'pantry';

    const platformItems: NavItemConfig[] = [
        {
        label: 'Inventory Dashboard',
        icon: Package,
        storageKey: 'nav_staff_pantry_open',
        defaultOpen: true,
        },
        {
        label: 'Expiration tracking',
        icon: Package,
        storageKey: 'nav_staff_pantry_open',
        defaultOpen: true,
        },
        {
        label: 'Stock',
        icon: Package,
        storageKey: 'nav_staff_pantry_open',
        defaultOpen: true,
        },
    ];

    return (
        <View className="flex-1 flex-row bg-white">
        {/* Sidebar Container */}
        <View 
            className={`${
            isSidebarOpen ? 'w-64' : 'w-16'
            } bg-slate-50/50 flex-col justify-between p-3 border-r border-slate-200 relative transition-all duration-300 shrink-0`}
        >
            <View className="flex-1 space-y-6">
            {/* Header & Toggle */}
            <View className={`flex-row items-center ${
                isSidebarOpen ? 'justify-between px-1' : 'justify-center'
            } min-h-[44px]`}>
                {isSidebarOpen && (
                <Text className="text-lg font-bold tracking-tight text-slate-900">
                    ShelfLife <Text className="text-emerald-600">AI</Text>
                </Text>
                )}
                
                <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => setIsSidebarOpen((prev) => !prev)}
                className="p-1.5 rounded-md hover:bg-slate-200/60 active:bg-slate-200 transition-colors"
                >
                <PanelLeft size={18} color="#64748b" />
                </TouchableOpacity>
            </View>

            {/* Navigation Items */}
            <ScrollView className="flex-1 space-y-4" showsVerticalScrollIndicator={false}>
                <View className="space-y-1">
                {isSidebarOpen && (
                    <Text className="px-2 text-[11px] font-semibold text-slate-400 tracking-wider mb-1">
                    Platform
                    </Text>
                )}

                {platformItems.map((item) => (
                    <CollapsibleNavItem
                    key={item.storageKey}
                    icon={item.icon}
                    label={item.label}
                    subItems={item.subItems}
                    defaultOpen={item.defaultOpen}
                    isSidebarOpen={isSidebarOpen}
                    storageKey={item.storageKey}
                    pathname={pathname}
                    router={router}
                    />
                ))}
                </View>
            </ScrollView>
            </View>

            {/* Profile Popover Container */}
            <View className="relative">
            {isUserMenuOpen && (
                <View className={`absolute bottom-full mb-2 ${
                isSidebarOpen ? 'left-0 right-0' : 'left-0 w-52'
                } bg-white rounded-xl p-2 border border-slate-200 shadow-xl z-50`}>
                {isLoadingUser ? (
                    <View className="flex-row items-center space-x-3 p-3">
                    <ActivityIndicator size="small" color="#059669" />
                    <Text className="text-xs text-slate-500">Loading profile...</Text>
                    </View>
                ) : userFetchError ? (
                    <View className="flex-row items-center space-x-3 p-3 border-b border-slate-100 mb-1">
                    <AlertTriangle size={20} color="#ef4444" />
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-red-600">Error!</Text>
                        <Text className="text-[10px] text-slate-500" numberOfLines={1}>Fetch failed.</Text>
                    </View>
                    </View>
                ) : (
                    <View className="flex-row items-center space-x-3 p-2 border-b border-slate-100 mb-1">
                    <Image
                        source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}` }}
                        className="w-9 h-9 rounded-full bg-pink-100 shrink-0"
                    />
                    <View className="flex-1">
                        <View className="flex-row items-center space-x-1.5">
                        <Text className="text-xs font-bold text-slate-900" numberOfLines={1}>{userData?.name || 'User'}</Text>
                        <View className="bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                            <Text className="text-[10px] font-medium text-emerald-700">{userData?.role || 'Staff'}</Text>
                        </View>
                        </View>
                        <Text className="text-[11px] text-slate-400" numberOfLines={1}>{userData?.email}</Text>
                    </View>
                    </View>
                )}

                <TouchableOpacity className="flex-row items-center space-x-2.5 px-2 py-1.5 rounded-lg active:bg-slate-100">
                    <BadgeCheck size={16} color="#64748b" />
                    <Text className="text-xs font-medium text-slate-700">Account</Text>
                </TouchableOpacity>

                <TouchableOpacity className="flex-row items-center space-x-2.5 px-2 py-1.5 rounded-lg active:bg-slate-100">
                    <Bell size={16} color="#64748b" />
                    <Text className="text-xs font-medium text-slate-700">Notifications</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={handleLogout}
                    className="flex-row items-center space-x-2.5 px-2 py-1.5 rounded-lg active:bg-slate-100"
                >
                    <LogOut size={16} color="#64748b" />
                    <Text className="text-xs font-medium text-slate-700">Log out</Text>
                </TouchableOpacity>
                </View>
            )}

            {/* User Menu Trigger */}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsUserMenuOpen((prev) => !prev)}
                className={`flex-row items-center ${
                isSidebarOpen ? 'justify-between px-2' : 'justify-center px-0'
                } py-2 rounded-lg active:bg-slate-200/60`}
            >
                <View className="flex-row items-center space-x-3 flex-1">
                <Image
                    source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}` }}
                    className="w-8 h-8 rounded-full bg-pink-100 shrink-0"
                />
                {isSidebarOpen && (
                    <View className="flex-1">
                    <Text className="text-xs font-semibold text-slate-900" numberOfLines={1}>{userData?.name || 'User'}</Text>
                    <Text className="text-[11px] text-slate-400" numberOfLines={1}>{userData?.email}</Text>
                    </View>
                )}
                </View>
                {isSidebarOpen && <ChevronsUpDown size={16} color="#94a3b8" className="shrink-0" />}
            </TouchableOpacity>
            </View>
        </View>

        {/* Main Content Area */}
        <View className="flex-1 bg-white">
            {children}
        </View>
        </View>
    );
    }

    function CollapsibleNavItem({
    icon: Icon,
    label,
    subItems = [],
    defaultOpen = false,
    isSidebarOpen = true,
    storageKey,
    pathname,
    router,
    }: {
    icon: LucideIcon;
    label: string;
    subItems?: NavSubItem[];
    defaultOpen?: boolean;
    isSidebarOpen?: boolean;
    storageKey: string;
    pathname: string;
    router: any;
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
    const isAnySubItemActive = subItems.some((sub) => pathname === sub.path);

    const toggleOpen = () => {
        if (!hasSubItems) return;
        setIsOpen((prev: boolean) => {
        const nextState = !prev;
        if (typeof window !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify(nextState));
        }
        return nextState;
        });
    };

    return (
        <View className="space-y-1">
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={toggleOpen}
            className={`flex-row items-center ${
            isSidebarOpen ? 'justify-between px-2' : 'justify-center px-0'
            } py-1.5 rounded-md transition-colors ${
            isAnySubItemActive ? 'bg-emerald-50/80' : 'active:bg-slate-200/50'
            }`}
        >
            <View className="flex-row items-center space-x-2.5">
            <Icon size={16} color={isAnySubItemActive ? '#059669' : '#64748b'} />
            {isSidebarOpen && (
                <Text className={`text-xs font-medium ${isAnySubItemActive ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`}>
                {label}
                </Text>
            )}
            </View>

            {isSidebarOpen && hasSubItems && (
            isOpen ? (
                <ChevronDown size={14} color="#94a3b8" />
            ) : (
                <ChevronRight size={14} color="#94a3b8" />
            )
            )}
        </TouchableOpacity>

        {isSidebarOpen && hasSubItems && isOpen && (
            <View className="ml-4 pl-3 border-l border-slate-200 space-y-1 my-1">
            {subItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                <TouchableOpacity
                    key={item.path}
                    onPress={() => router.push(item.path as any)}
                    activeOpacity={0.7}
                    className={`rounded-md px-2 py-1.5 ${
                    isActive ? 'bg-emerald-100/60' : 'active:bg-slate-100'
                    }`}
                >
                    <Text
                    className={`text-xs font-medium ${
                        isActive ? 'text-emerald-800 font-semibold' : 'text-slate-600'
                    }`}
                    >
                    {item.name}
                    </Text>
                </TouchableOpacity>
                );
            })}
            </View>
        )}
        </View>
    );
    }