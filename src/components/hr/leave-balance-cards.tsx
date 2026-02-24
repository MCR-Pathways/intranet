"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LEAVE_TYPE_CONFIG, formatLeaveDays } from "@/lib/hr";
import type { LeaveBalance } from "@/types/hr";

interface LeaveBalanceCardsProps {
  balances: LeaveBalance[];
}

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  if (balances.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No leave entitlements have been set up for this year.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => {
        const config = LEAVE_TYPE_CONFIG[balance.leave_type];
        const Icon = config.icon;
        const usedPercent =
          balance.entitlement > 0
            ? Math.min(100, (balance.used / balance.entitlement) * 100)
            : 0;
        const pendingPercent =
          balance.entitlement > 0
            ? Math.min(100 - usedPercent, (balance.pending / balance.entitlement) * 100)
            : 0;

        return (
          <Card key={balance.leave_type}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
              <Icon className={`h-4 w-4 ${config.colour}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatLeaveDays(balance.remaining)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                remaining of {formatLeaveDays(balance.entitlement)}
              </p>

              <div className="mt-3 space-y-1">
                <Progress value={usedPercent + pendingPercent} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatLeaveDays(balance.used)} used</span>
                  {balance.pending > 0 && (
                    <span>{formatLeaveDays(balance.pending)} pending</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
