"use client";

import { useState, useTransition } from "react";
import { updateEmployeeEmployment } from "@/app/(protected)/hr/users/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CONTRACT_TYPE_CONFIG,
  DEPARTMENT_CONFIG,
  REGION_CONFIG,
  WORK_PATTERN_CONFIG,
} from "@/lib/hr";
import type { EmployeeProfile } from "@/types/hr";

interface EmploymentEditDialogProps {
  profile: EmployeeProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmploymentEditDialog({
  profile,
  open,
  onOpenChange,
}: EmploymentEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fte, setFte] = useState(String(profile.fte ?? 1));
  const [contractType, setContractType] = useState<string>(profile.contract_type ?? "permanent");
  const [department, setDepartment] = useState<string>(profile.department ?? "");
  const [region, setRegion] = useState<string>(profile.region ?? "");
  const [workPattern, setWorkPattern] = useState<string>(profile.work_pattern ?? "standard");
  const [startDate, setStartDate] = useState(profile.start_date ?? "");
  const [probationEndDate, setProbationEndDate] = useState(profile.probation_end_date ?? "");
  const [contractEndDate, setContractEndDate] = useState(profile.contract_end_date ?? "");
  const [isExternal, setIsExternal] = useState(profile.is_external ?? false);
  const [lineManagerId, setLineManagerId] = useState(profile.line_manager_id ?? "");
  const [teamId, setTeamId] = useState(profile.team_id ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fteNum = parseFloat(fte);
    if (isNaN(fteNum) || fteNum < 0 || fteNum > 1) {
      setError("FTE must be between 0 and 1");
      return;
    }

    startTransition(async () => {
      const result = await updateEmployeeEmployment(profile.id, {
        fte: fteNum,
        contract_type: contractType,
        department: department || null,
        region: region || null,
        work_pattern: workPattern,
        start_date: startDate || null,
        probation_end_date: probationEndDate || null,
        contract_end_date: contractEndDate || null,
        is_external: isExternal,
        line_manager_id: lineManagerId || null,
        team_id: teamId || null,
      });

      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to update employment details");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employment Details</DialogTitle>
          <DialogDescription>
            Update employment information for {profile.full_name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fte">FTE</Label>
                <Input
                  id="fte"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={fte}
                  onChange={(e) => setFte(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="contract_type">Contract Type</Label>
                <Select value={contractType} onValueChange={setContractType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACT_TYPE_CONFIG).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="department">Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {Object.entries(DEPARTMENT_CONFIG).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="region">Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {Object.entries(REGION_CONFIG).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="work_pattern">Work Pattern</Label>
              <Select value={workPattern} onValueChange={setWorkPattern}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WORK_PATTERN_CONFIG).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="probation_end">Probation End Date</Label>
                <Input
                  id="probation_end"
                  type="date"
                  value={probationEndDate}
                  onChange={(e) => setProbationEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contract_end">Contract End Date</Label>
              <Input
                id="contract_end"
                type="date"
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="line_manager_id">Line Manager ID</Label>
                <Input
                  id="line_manager_id"
                  value={lineManagerId}
                  onChange={(e) => setLineManagerId(e.target.value)}
                  placeholder="UUID of line manager"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="team_id">Team ID</Label>
                <Input
                  id="team_id"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="UUID of team"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_external">External Employee</Label>
              <Switch
                id="is_external"
                checked={isExternal}
                onCheckedChange={setIsExternal}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
