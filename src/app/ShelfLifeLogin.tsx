    import React, { useState } from 'react';
    import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, Platform } from 'react-native';
    import { useRouter } from 'expo-router';
    import Constants from 'expo-constants';

    // Determine backend URL based on execution environment
    const getApiUrl = (): string => {
    if (Platform.OS === 'web') {
        return 'http://127.0.0.1:5000/api/auth/login';
    }
    const debuggerHost = Constants.expoConfig?.hostUri;
    const host = debuggerHost ? debuggerHost.split(':')[0] : '10.0.2.2';
    return `http://${host}:5000/api/auth/login`;
    };

    const API_URL = getApiUrl();

    interface ValidationErrors {
    email?: string;
    password?: string;
    auth?: string;
    }

    export default function ShelfLifeLogin(): React.ReactElement {
    const router = useRouter();
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<ValidationErrors>({});

    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail) {
        newErrors.email = 'Email address is required.';
        } else if (!/^[^\s@]+@shelflife\.com$/i.test(trimmedEmail)) {
        newErrors.email = 'Try again.';
        }

        if (!password) {
        newErrors.password = 'Password is required.';
        } else if (password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (): Promise<void> => {
        if (!validateForm()) return;

        setIsLoading(true);
        setErrors({});

        try {
        // 1. Authenticate user against backend API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            setErrors({ auth: data.error || 'Invalid credentials. Please try again.' });
            return;
        }

        // 2. Role-Based Access Control (RBAC) Routing
        const userRole = data.user?.role;

        switch (userRole) {
            case 'Super Admin':
            case 'SuperAdmin':
            router.replace('/pages/SuperAdminDash');
            break;
            case 'Admin':
            router.replace('/pages/AdminDash');
            break;
            case 'Staff':
            router.replace('/pages/InStaff');
            break;
            case 'Manager':
            router.replace('/pages/InManager');
            break;
            default:
            setErrors({ auth: `Unauthorized role assignment (${userRole}). Contact system administrator.` });
            break;
        }
        } catch (error) {
        setErrors({ auth: 'Unable to connect to authentication server.' });
        } finally {
        setIsLoading(false);
        }
    };

    return (
        <View className="flex-1 flex-row w-full h-full relative">
        {/* FULL-SCREEN LOADING OVERLAY */}
        {isLoading && (
            <View className="absolute inset-0 z-50 bg-[#12231A]/90 items-center justify-center flex-col space-y-4 backdrop-blur-sm">
            <ActivityIndicator size="large" color="#E5A93B" />
            <Text className="text-[#F7F4EB] font-serif text-lg tracking-wide">
                Entering your Pantry...
            </Text>
            </View>
        )}

        {/* Left Side Panel - Light Beige */}
        <View className="hidden md:flex w-1/2 flex-col justify-center bg-[#F7F4EB] px-16 lg:px-24">
            <View className="max-w-lg space-y-8">
            <View className="flex-row items-center">
                <Image
                source={require('../../assets/expo.icon/logo.png')}
                className="h-16 w-auto object-contain"
                style={{ width: 340, height: 90 }}
                resizeMode="contain"
                />
            </View>

            <View className="space-y-6">
                <Text className="text-5xl font-serif text-[#12231A] tracking-tight leading-tight">
                Know What’s{"\n"}Fresh Before it isn’t
                </Text>

                <Text className="max-w-md text-sm text-[#12231A] opacity-90 leading-relaxed">
                Track your kitchen inventory seamlessly, reduce food waste, and automatically generate analytics based on your ingredients usage.
                </Text>
            </View>
            </View>
        </View>

        {/* Right Side Panel - Dark Green */}
        <View className="flex-1 md:w-1/2 flex-col justify-between bg-[#12231A] p-8 md:p-16">
            <Text className="text-right text-xs text-[#C89234]">
            ShelfLife AI - 2026
            </Text>

            <View className="mx-auto w-full max-w-[340px] space-y-6">
            <View>
                <Text className="text-xs text-[#C89234] mb-1">Welcome back</Text>
                <Text className="text-3xl font-serif text-white leading-tight">
                Sign in to your{"\n"}Pantry
                </Text>
            </View>

            {/* AUTHENTICATION ERROR BANNER */}
            {errors.auth && (
                <View className="bg-red-500/10 border border-red-400/50 p-3 rounded">
                <Text className="text-xs text-red-400 text-center font-medium">{errors.auth}</Text>
                </View>
            )}

            {/* Email Input */}
            <View className="space-y-1">
                <Text className="text-xs text-[#8A9B90]">Email</Text>
                <TextInput
                value={email}
                onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email || errors.auth) {
                    setErrors((prev) => ({ ...prev, email: undefined, auth: undefined }));
                    }
                }}
                placeholder="user@shelflife.com"
                placeholderTextColor="#5A6D61"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
                className={`border-b bg-transparent py-2 text-sm text-white ${
                    errors.email ? 'border-red-400' : 'border-[#3A4D41]'
                }`}
                />
                {errors.email && (
                <Text className="text-[11px] text-red-400 mt-1">{errors.email}</Text>
                )}
            </View>

            {/* Password Input */}
            <View className="space-y-1">
                <Text className="text-xs text-[#8A9B90]">Password</Text>
                <View className="relative justify-center">
                <TextInput
                    value={password}
                    onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password || errors.auth) {
                        setErrors((prev) => ({ ...prev, password: undefined, auth: undefined }));
                    }
                    }}
                    placeholder="Enter your Password"
                    placeholderTextColor="#5A6D61"
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                    className={`border-b bg-transparent py-2 pr-12 text-sm text-white ${
                    errors.password ? 'border-red-400' : 'border-[#3A4D41]'
                    }`}
                />
                <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    className="absolute right-0 py-2"
                >
                    <Text className="text-xs text-[#8A9B90] underline">
                    {showPassword ? 'hide' : 'show'}
                    </Text>
                </TouchableOpacity>
                </View>
                {errors.password && (
                <Text className="text-[11px] text-red-400 mt-1">{errors.password}</Text>
                )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.8}
                className="w-full bg-[#E5A93B] py-3 rounded items-center justify-center flex-row space-x-2 mt-4"
            >
                <Text className="text-sm font-bold text-[#12231A]">Sign in</Text>
            </TouchableOpacity>
            </View>

            <Text className="text-center text-xs text-[#5A6D61]">
            Your kitchen data stays private to your account
            </Text>
        </View>
        </View>
    );
    }