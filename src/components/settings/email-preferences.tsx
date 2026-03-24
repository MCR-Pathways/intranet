"use client";

import { useTransition } from "react";
import { updateEmailPreference } from "@/app/(protected)/settings/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { EMAIL_TYPES, type EmailType } from "@/lib/email-queue";

/** Optional email types that can be toggled. */
const OPTIONAL_TYPES = Object.entries(EMAIL_TYPES)
  .filter(([, config]) => !config.mandatory)
  .map(([type]) => type);

interface EmailPreferencesProps {
  /** Current user's preferences: emailType → enabled. Missing = default true. */
  preferences: Record<string, boolean>;
}

/** Group email types by module for display. */
const MODULE_ORDER = ["Learning", "HR", "Intranet", "System"] as const;

export function EmailPreferences({ preferences }: EmailPreferencesProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (emailType: string, currentValue: boolean) => {
    startTransition(async () => {
      const result = await updateEmailPreference(emailType, !currentValue);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update preference");
      }
    });
  };

  const handleBulkToggle = (enabled: boolean) => {
    startTransition(async () => {
      for (const type of OPTIONAL_TYPES) {
        await updateEmailPreference(type, enabled);
      }
    });
  };

  // Check if all optional types are currently enabled
  const allOptionalEnabled = OPTIONAL_TYPES.every(
    (type) => preferences[type] ?? true
  );

  // Group by module
  const grouped = new Map<string, { type: EmailType; config: (typeof EMAIL_TYPES)[EmailType] }[]>();
  for (const [type, config] of Object.entries(EMAIL_TYPES)) {
    const module = config.module;
    if (!grouped.has(module)) grouped.set(module, []);
    grouped.get(module)!.push({ type: type as EmailType, config });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Notifications
            </CardTitle>
            <CardDescription className="mt-1.5">
              Choose which email notifications you receive. Some notifications are
              mandatory and cannot be disabled.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={isPending}
            onClick={() => handleBulkToggle(!allOptionalEnabled)}
          >
            {allOptionalEnabled ? "Turn off optional" : "Turn on all"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {MODULE_ORDER.map((module) => {
          const items = grouped.get(module);
          if (!items || items.length === 0) return null;

          return (
            <div key={module}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                {module}
              </h4>
              <div className="space-y-3">
                {items.map(({ type, config }) => {
                  const isEnabled = preferences[type] ?? true;
                  const isMandatory = config.mandatory;

                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`email-pref-${type}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {config.label}
                        </Label>
                        {isMandatory && (
                          <Badge variant="secondary" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                      <Switch
                        id={`email-pref-${type}`}
                        checked={isMandatory ? true : isEnabled}
                        disabled={isMandatory || isPending}
                        onCheckedChange={() => {
                          if (!isMandatory) {
                            handleToggle(type, isEnabled);
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
