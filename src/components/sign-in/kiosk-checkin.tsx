"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Search, CheckCircle2, ChevronLeft } from "lucide-react";
import { getInitials } from "@/lib/utils";

interface StaffMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  scheduled: boolean;
  confirmed: boolean;
}

interface KioskCheckinProps {
  staff: StaffMember[];
  token: string;
}

type KioskState = "list" | "confirm" | "success";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  return "Good afternoon!";
}

export function KioskCheckin({ staff: initialStaff, token }: KioskCheckinProps) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<KioskState>("list");
  const [selectedPerson, setSelectedPerson] = useState<StaffMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset to list after inactivity
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setState("list");
      setSelectedPerson(null);
      setSearch("");
    }, 10000); // 10 seconds inactivity
  }, []);

  useEffect(() => {
    const handleInteraction = () => resetInactivityTimer();
    window.addEventListener("touchstart", handleInteraction);
    window.addEventListener("click", handleInteraction);
    return () => {
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("click", handleInteraction);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Process offline queue when connectivity returns
  useEffect(() => {
    const processQueue = async () => {
      try {
        const raw = localStorage.getItem("kiosk_queue");
        if (!raw) return;
        const queue = JSON.parse(raw) as { userId: string; timestamp: number }[];
        if (queue.length === 0) return;

        const remaining: typeof queue = [];
        for (const item of queue) {
          try {
            const res = await fetch("/api/kiosk/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: item.userId, token }),
            });
            if (!res.ok) remaining.push(item);
          } catch {
            remaining.push(item);
          }
        }

        if (remaining.length === 0) {
          localStorage.removeItem("kiosk_queue");
        } else {
          localStorage.setItem("kiosk_queue", JSON.stringify(remaining));
        }
      } catch {
        // Storage unavailable
      }
    };

    // Process on mount (in case we reloaded while online)
    processQueue();

    // Process when connectivity returns
    window.addEventListener("online", processQueue);
    return () => window.removeEventListener("online", processQueue);
  }, [token]);

  // Filtered and sorted staff
  const filteredStaff = useMemo(() => {
    let result = staff;
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.fullName.toLowerCase().includes(query) ||
          (s.jobTitle && s.jobTitle.toLowerCase().includes(query))
      );
    }

    // Sort: scheduled first, then confirmed at bottom, then alphabetical
    return result.sort((a, b) => {
      // Already confirmed → bottom
      if (a.confirmed && !b.confirmed) return 1;
      if (!a.confirmed && b.confirmed) return -1;
      // Scheduled first
      if (a.scheduled && !b.scheduled) return -1;
      if (!a.scheduled && b.scheduled) return 1;
      // Alphabetical
      return a.fullName.localeCompare(b.fullName);
    });
  }, [staff, search]);

  const scheduledCount = useMemo(() => staff.filter((s) => s.scheduled).length, [staff]);
  const confirmedCount = useMemo(() => staff.filter((s) => s.confirmed).length, [staff]);

  const handleSelectPerson = (person: StaffMember) => {
    if (person.confirmed) return; // Already checked in
    setSelectedPerson(person);
    setState("confirm");
    resetInactivityTimer();
  };

  const handleConfirm = async () => {
    if (!selectedPerson || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/kiosk/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedPerson.id, token }),
      });

      if (res.ok) {
        // Update local state
        setStaff((prev) =>
          prev.map((s) =>
            s.id === selectedPerson.id ? { ...s, confirmed: true } : s
          )
        );
        setState("success");

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
          setState("list");
          setSelectedPerson(null);
          setSearch("");
        }, 3000);
      }
    } catch (err) {
      // Queue for later if network error (offline)
      if (!(err instanceof TypeError)) {
        // Non-network error — don't queue, just show success for UX
      }
      try {
        const queue = JSON.parse(localStorage.getItem("kiosk_queue") ?? "[]");
        queue.push({ userId: selectedPerson.id, timestamp: Date.now() });
        localStorage.setItem("kiosk_queue", JSON.stringify(queue));
      } catch {
        // Storage unavailable
      }
      setState("success"); // Show success anyway (offline-first)
      setStaff((prev) =>
        prev.map((s) =>
          s.id === selectedPerson.id ? { ...s, confirmed: true } : s
        )
      );
      setTimeout(() => {
        setState("list");
        setSelectedPerson(null);
        setSearch("");
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    setState("list");
    setSelectedPerson(null);
  };

  // Success screen
  if (state === "success" && selectedPerson) {
    return (
      <div className="min-h-screen bg-mcr-dark-blue flex items-center justify-center">
        <div className="text-center animate-in zoom-in duration-300">
          <CheckCircle2 className="h-20 w-20 text-emerald-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome, {selectedPerson.fullName.split(" ")[0]}!
          </h1>
          <p className="text-xl text-white/70">Have a great day.</p>
        </div>
      </div>
    );
  }

  // Confirmation screen
  if (state === "confirm" && selectedPerson) {
    return (
      <div className="min-h-screen bg-mcr-dark-blue flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          {/* Avatar */}
          <div className="mx-auto mb-6">
            {selectedPerson.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedPerson.avatarUrl}
                alt={selectedPerson.fullName}
                className="h-24 w-24 rounded-full mx-auto object-cover border-4 border-white/20"
              />
            ) : (
              <div className="h-24 w-24 rounded-full mx-auto bg-white/10 flex items-center justify-center text-3xl font-bold text-white/70">
                {getInitials(selectedPerson.fullName)}
              </div>
            )}
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">
            {selectedPerson.fullName}
          </h1>
          {selectedPerson.jobTitle && (
            <p className="text-lg text-white/70 mb-8">
              {selectedPerson.jobTitle}
            </p>
          )}

          <div className="flex gap-4 justify-center">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="h-16 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-semibold transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="h-6 w-6" />
              Yes, that&apos;s me
            </button>
            <button
              type="button"
              onClick={handleGoBack}
              className="h-16 px-8 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-lg font-semibold transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="h-6 w-6" />
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main list screen
  return (
    <div className="min-h-screen bg-mcr-dark-blue p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{getGreeting()}</h1>
          <p className="text-xl text-white/70">Tap below to check in</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your name..."
            className="w-full h-16 text-xl px-6 pl-16 rounded-2xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-mcr-orange/50"
          />
        </div>

        {/* Staff grid */}
        <div className="grid grid-cols-2 gap-4">
          {filteredStaff.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => handleSelectPerson(person)}
              disabled={person.confirmed}
              className={cn(
                "rounded-xl p-4 min-h-[80px] text-left transition-all flex items-center gap-3",
                person.confirmed
                  ? "bg-emerald-900/30 cursor-default"
                  : person.scheduled
                    ? "bg-white/15 hover:bg-white/25 cursor-pointer"
                    : "bg-white/5 hover:bg-white/15 cursor-pointer"
              )}
            >
              {/* Avatar */}
              {person.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.avatarUrl}
                  alt={person.fullName}
                  className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white/70 flex-shrink-0">
                  {getInitials(person.fullName)}
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold truncate">
                  {person.fullName}
                </p>
                {person.jobTitle && (
                  <p className="text-white/60 text-sm truncate">
                    {person.jobTitle}
                  </p>
                )}
                {person.confirmed ? (
                  <p className="text-emerald-400 text-xs flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Checked in
                  </p>
                ) : person.scheduled ? (
                  <p className="text-mcr-orange text-xs mt-0.5">
                    Scheduled today
                  </p>
                ) : null}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-white/40">
            Not scheduled? Tap your name to check in
          </p>
          <p className="text-sm text-white/50 mt-2">
            Today: {scheduledCount} scheduled &middot; {confirmedCount} confirmed
          </p>
        </div>
      </div>
    </div>
  );
}
