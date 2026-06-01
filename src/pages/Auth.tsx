import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowRight, KeyRound, Mail, ShieldCheck } from "lucide-react";
import adLabLogo from "@/assets/ad-lab-logo.png";

const Auth = () => {
    const { session } = useAuth();
    const location = useLocation();
    const [isLogin, setIsLogin] = useState(true);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [showOtp, setShowOtp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // If already logged in AND has correct domain, redire\\ct to intended page or home
    // We skip this check if they are in the password reset flow so they can actually set their new password
    if (session && !isForgotPassword) {
        const userEmail = session.user?.email || "";
        if (userEmail.endsWith("@ad-lab.io")) {
            const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
            return <Navigate to={from} replace />;
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp) {
            toast.error("Please enter the verification code from your email.");
            return;
        }

        setIsLoading(true);
        try {
            const typeValue = isForgotPassword ? 'recovery' : 'signup';

            const { error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: typeValue
            });

            if (error) throw error;

            if (isForgotPassword) {
                toast.success("Code verified! Please enter your new password.");
            } else {
                toast.success("Email verified successfully! You are now signed in.");
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Invalid verification code";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetNewPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) {
            toast.error("Please enter a new password.");
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            toast.success("Password updated successfully! You are now signed in.");
            setIsForgotPassword(false);
            setShowOtp(false);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to update password";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.error("Please enter your email");
            return;
        }

        if (!email.toLowerCase().endsWith("@ad-lab.io")) {
            toast.error("Only @ad-lab.io email addresses are permitted.");
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);

            if (error) throw error;

            toast.success("Password reset instructions sent! Please check your email.");
            setShowOtp(true);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to send reset email";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error("Please fill in all fields");
            return;
        }

        if (!email.toLowerCase().endsWith("@ad-lab.io")) {
            toast.error("Only @ad-lab.io email addresses are permitted to access this application.");
            return;
        }

        setIsLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;
            } else {
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                });

                if (error) throw error;

                if (data.user && data.user.identities && data.user.identities.length === 0) {
                    toast.error("This email is already registered. Please sign in.");
                    setIsLogin(true);
                    return;
                }

                if (data.session === null) {
                    toast.success("Account created! Please check your email for the verification code.");
                    setShowOtp(true);
                } else {
                    toast.success("Account created successfully!");
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Authentication failed";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const getTitle = () => {
        if (showOtp) {
            return isForgotPassword && session ? "Set New Password" : "Verify Email";
        }
        if (isForgotPassword) return "Reset Password";
        return isLogin ? "Welcome back" : "Create account";
    };

    const getDescription = () => {
        if (showOtp) {
            return isForgotPassword && session
                ? "Enter your new strong password"
                : `Enter the 8-digit code sent to ${email}`;
        }
        if (isForgotPassword) return "We'll send you a verification code";
        return "Sign in with your @ad-lab.io credentials";
    };

    const getIcon = () => {
        if (showOtp) return <ShieldCheck className="w-5 h-5" />;
        if (isForgotPassword) return <KeyRound className="w-5 h-5" />;
        return <Mail className="w-5 h-5" />;
    };

    return (
        <div className="auth-page min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden">
            {/* Animated background */}
            <div className="auth-bg absolute inset-0" />
            <div className="auth-orb auth-orb-1" />
            <div className="auth-orb auth-orb-2" />
            <div className="auth-orb auth-orb-3" />

            <div className="w-full max-w-md relative z-10 animate-reveal">
                {/* Logo & branding */}
                <div className="mb-10 text-center">
                    <img
                        src={adLabLogo}
                        alt="Ad-Lab"
                        className="h-12 w-12 mx-auto mb-5 rounded-[4px] object-cover border border-border"
                    />
                    <p className="type-eyebrow text-primary">
                        Insight Engine
                    </p>
                </div>

                {/* Auth card */}
                <Card className="auth-card overflow-hidden">
                    <CardHeader className="space-y-1.5 pb-5 pt-9 px-8">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="p-2.5 rounded-[4px] border border-border text-primary">
                                {getIcon()}
                            </div>
                        </div>
                        <CardTitle className="text-xl text-center text-foreground">
                            {getTitle()}
                        </CardTitle>
                        <CardDescription className="text-center text-muted-foreground text-xs tracking-[0.04em] uppercase">
                            {getDescription()}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                        {showOtp ? (
                            isForgotPassword && session ? (
                                <form onSubmit={handleSetNewPassword} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-password" className="text-slate-700 text-sm font-medium">New Password</Label>
                                        <Input
                                            id="new-password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            disabled={isLoading}
                                            required
                                            className="auth-input h-12"
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        className="auth-btn w-full h-12 text-base font-semibold"
                                        disabled={isLoading}
                                    >
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Update Password
                                        <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </form>
                            ) : (
                                <form onSubmit={handleVerifyOtp} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="otp" className="text-slate-700 text-sm font-medium">Verification Code</Label>
                                        <Input
                                            id="otp"
                                            type="text"
                                            placeholder="12345678"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            disabled={isLoading}
                                            required
                                            className="auth-input h-12 text-center text-lg tracking-[0.3em] font-mono"
                                            maxLength={8}
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        className="auth-btn w-full h-12 text-base font-semibold"
                                        disabled={isLoading}
                                    >
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Verify {isForgotPassword ? "Code" : "& Sign In"}
                                        <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                    <div className="mt-4 text-center text-sm">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowOtp(false);
                                                if (isForgotPassword) setIsForgotPassword(false);
                                            }}
                                            className="text-brand-600 hover:text-brand-500 transition-colors"
                                            disabled={isLoading}
                                        >
                                            {isForgotPassword ? "← Back to Login" : "← Back to Sign Up"}
                                        </button>
                                    </div>
                                </form>
                            )
                        ) : isForgotPassword ? (
                            <form onSubmit={handleForgotPassword} className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-slate-700 text-sm font-medium">Work Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@ad-lab.io"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isLoading}
                                        required
                                        className="auth-input h-12"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    className="auth-btn w-full h-12 text-base font-semibold"
                                    disabled={isLoading}
                                >
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Send Reset Code
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>

                                <div className="mt-4 text-center text-sm">
                                    <button
                                        type="button"
                                        onClick={() => setIsForgotPassword(false)}
                                        className="text-brand-600 hover:text-brand-500 transition-colors"
                                        disabled={isLoading}
                                    >
                                        ← Back to Sign in
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-slate-700 text-sm font-medium">Work Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@ad-lab.io"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isLoading}
                                        required
                                        className="auth-input h-12"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password" className="text-slate-700 text-sm font-medium">Password</Label>
                                        {isLogin && (
                                            <button
                                                type="button"
                                                onClick={() => setIsForgotPassword(true)}
                                                className="text-xs text-brand-600/80 hover:text-brand-500 transition-colors"
                                                tabIndex={-1}
                                            >
                                                Forgot password?
                                            </button>
                                        )}
                                    </div>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isLoading}
                                        required
                                        className="auth-input h-12"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    className="auth-btn w-full h-12 text-base font-semibold"
                                    disabled={isLoading}
                                >
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isLogin ? "Sign In" : "Create Account"}
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>

                                <div className="mt-4 text-center text-sm">
                                    <button
                                        type="button"
                                        onClick={() => setIsLogin(!isLogin)}
                                        className="text-brand-600 hover:text-brand-500 transition-colors"
                                        disabled={isLoading}
                                    >
                                        {isLogin
                                            ? "Don't have an account? Sign up"
                                            : "Already have an account? Sign in"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>

                {/* Footer */}
                <p className="micro-label text-center mt-8">
                    © {new Date().getFullYear()} Ad-Lab · internal use only
                </p>
            </div>
        </div>
    );
};

export default Auth;
