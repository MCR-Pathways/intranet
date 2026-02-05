"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Home,
  Building2,
  Globe,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Location = "home" | "glasgow_office" | "stevenage_office" | "other";

const locations = [
  { id: "home", name: "Home", icon: Home },
  { id: "glasgow_office", name: "Glasgow Office", icon: Building2 },
  { id: "stevenage_office", name: "Stevenage Office", icon: Building2 },
  { id: "other", name: "Other", icon: Globe },
] as const;

export default function SignInPage() {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [otherLocation, setOtherLocation] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);

  const handleSignIn = () => {
    if (!selectedLocation) return;
    if (selectedLocation === "other" && !otherLocation.trim()) return;

    // TODO: Submit to API
    setIsSignedIn(true);
  };

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sign In</h1>
        <p className="text-muted-foreground mt-1">
          Record your working location for today
        </p>
      </div>

      {/* Date display */}
      <Card>
        <CardContent className="py-4">
          <p className="text-lg font-medium">{today}</p>
        </CardContent>
      </Card>

      {/* Already signed in state */}
      {isSignedIn ? (
        <Card className="border-status-active bg-status-active/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-status-active" />
              <CardTitle className="text-lg">Signed In</CardTitle>
            </div>
            <CardDescription>
              You&apos;ve recorded your working location for today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="success">
                {selectedLocation === "other"
                  ? otherLocation
                  : locations.find((l) => l.id === selectedLocation)?.name}
              </Badge>
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsSignedIn(false)}
            >
              Change Location
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Sign in form */
        <Card>
          <CardHeader>
            <CardTitle>Where are you working from today?</CardTitle>
            <CardDescription>
              Select your working location
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Location options */}
            <div className="grid gap-3 sm:grid-cols-2">
              {locations.map((location) => {
                const Icon = location.icon;
                const isSelected = selectedLocation === location.id;

                return (
                  <button
                    key={location.id}
                    onClick={() => setSelectedLocation(location.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{location.name}</p>
                    </div>
                    {isSelected && (
                      <Check className="ml-auto h-5 w-5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Other location input */}
            {selectedLocation === "other" && (
              <div className="space-y-2">
                <Label htmlFor="other-location">Specify location</Label>
                <Input
                  id="other-location"
                  placeholder="Enter your location"
                  value={otherLocation}
                  onChange={(e) => setOtherLocation(e.target.value)}
                />
              </div>
            )}

            {/* Submit button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleSignIn}
              disabled={
                !selectedLocation ||
                (selectedLocation === "other" && !otherLocation.trim())
              }
            >
              <MapPin className="mr-2 h-5 w-5" />
              Sign In
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sign in history */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sign-ins</CardTitle>
          <CardDescription>Your working location history</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recent sign-ins to display
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
