"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface PersonOption {
  id: string;
  full_name: string;
  job_title: string | null;
}

interface PersonComboboxProps {
  people: PersonOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Exclude this person from the list (e.g. the employee being edited) */
  excludeId?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function PersonCombobox({
  people,
  value,
  onChange,
  excludeId,
  placeholder = "Select person...",
  disabled = false,
}: PersonComboboxProps) {
  const [open, setOpen] = useState(false);

  const filteredPeople = excludeId
    ? people.filter((p) => p.id !== excludeId)
    : people;

  const selectedPerson = filteredPeople.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedPerson ? selectedPerson.full_name : placeholder}
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value && (
              <X
                className="h-3.5 w-3.5 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name..." />
          <CommandList>
            <CommandEmpty>No person found.</CommandEmpty>
            <CommandGroup>
              {filteredPeople.map((person) => (
                <CommandItem
                  key={person.id}
                  value={person.full_name}
                  onSelect={() => {
                    onChange(person.id === value ? null : person.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === person.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{person.full_name}</p>
                    {person.job_title && (
                      <p className="text-xs text-muted-foreground truncate">
                        {person.job_title}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
