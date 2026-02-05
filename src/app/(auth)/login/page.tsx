"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Track mount status for hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const validateEmail = (email: string) => {
    return email.toLowerCase().endsWith("@mcrpathways.org");
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const redirectTo = new URL(
        "/auth/callback",
        window.location.origin
      ).toString();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            hd: "mcrpathways.org",
          },
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
        setIsGoogleLoading(false);
      } else if (!data?.url) {
        setMessage({
          type: "error",
          text: "Failed to start Google sign in. Please try again.",
        });
        setIsGoogleLoading(false);
      } else {
        window.location.assign(data.url);
      }
    } catch (err) {
      console.error("Google sign in error:", err);
      setMessage({ type: "error", text: "Failed to sign in with Google" });
      setIsGoogleLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (!validateEmail(email)) {
      setMessage({
        type: "error",
        text: "Only @mcrpathways.org email addresses are allowed",
      });
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({
          type: "success",
          text: "Check your email for the magic link!",
        });
        setEmail("");
      }
    } catch {
      setMessage({ type: "error", text: "Failed to send magic link" });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state until client-side hydration is complete
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image
              src="/MCR_LOGO-1.svg"
              alt="MCR Pathways"
              width={168}
              height={50}
              priority
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
            <CardDescription className="mt-2">
              Sign in to the MCR Pathways Intranet
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Google Sign In */}
          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            variant="outline"
            className="w-full h-12 text-base"
          >
            {isGoogleLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Magic Link Form */}
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@mcrpathways.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !email}
              className="w-full h-12 text-base"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Mail className="mr-2 h-5 w-5" />
              )}
              Send Magic Link
            </Button>
          </form>

          {/* Message Display */}
          {message && (
            <div
              className={`p-4 rounded-lg text-sm ${
                message.type === "success"
                  ? "bg-status-active/10 text-status-active"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {message.text}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 text-center text-sm text-muted-foreground">
          <p>
            You must use your <strong>@mcrpathways.org</strong> email address to
            sign in.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
