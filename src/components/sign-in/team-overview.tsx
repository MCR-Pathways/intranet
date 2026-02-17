"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Home, Building2, Globe, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberDetail } from "./member-detail";
import type { TeamMemberSignIn } from "@/types/database.types";

const locationConfig: Record<
  string,
  { label: string; icon: typeof Home; variant: "default" | "secondary" | "outline" }
> = {
  home: { label: "Home", icon: Home, variant: "secondary" },
  glasgow_office: { label: "Glasgow", icon: Building2, variant: "default" },
  stevenage_office: { label: "Stevenage", icon: Building2, variant: "default" },
  other: { label: "Other", icon: Globe, variant: "outline" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface TeamOverviewProps {
  members: TeamMemberSignIn[];
}

export function TeamOverview({ members }: TeamOverviewProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { signedIn, notSignedIn, stats } = useMemo(() => {
    const si: TeamMemberSignIn[] = [];
    const nsi: TeamMemberSignIn[] = [];
    let homeCount = 0;
    let officeCount = 0;
    let otherCount = 0;

    for (const member of members) {
      if (member.sign_ins.length > 0) {
        si.push(member);
        // Count by latest entry
        const latest = member.sign_ins[member.sign_ins.length - 1];
        if (latest.location === "home") homeCount++;
        else if (
          latest.location === "glasgow_office" ||
          latest.location === "stevenage_office"
        )
          officeCount++;
        else otherCount++;
      } else {
        nsi.push(member);
      }
    }

    return {
      signedIn: si,
      notSignedIn: nsi,
      stats: { home: homeCount, office: officeCount, other: otherCount },
    };
  }, [members]);

  const selectedMember = selectedMemberId
    ? members.find((m) => m.id === selectedMemberId) ?? null
    : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Status
          </CardTitle>
          <CardDescription>
            {signedIn.length} of {members.length} team members signed in
            {signedIn.length > 0 && (
              <span className="ml-2">
                &middot; {stats.home} Home &middot; {stats.office} Office &middot;{" "}
                {stats.other} Other
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Signed in members first */}
              {signedIn.map((member) => {
                const displayName = member.preferred_name ?? member.full_name;
                const latestSignIn = member.sign_ins[member.sign_ins.length - 1];
                const config =
                  locationConfig[latestSignIn.location] ?? locationConfig.other;
                const locationLabel =
                  latestSignIn.location === "other" && latestSignIn.other_location
                    ? latestSignIn.other_location
                    : config.label;

                return (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMemberId(member.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.job_title}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={config.variant} className="gap-1 text-xs">
                        <config.icon className="h-3 w-3" />
                        {locationLabel}
                      </Badge>
                      {member.sign_ins.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          +{member.sign_ins.length - 1} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Not signed in members */}
              {notSignedIn.map((member) => {
                const displayName = member.preferred_name ?? member.full_name;

                return (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMemberId(member.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-dashed p-3 opacity-60 text-left transition-colors hover:bg-accent/50 hover:opacity-80",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.job_title}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      Not signed in
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member detail dialog */}
      <MemberDetail
        member={selectedMember}
        open={!!selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
      />
    </>
  );
}
