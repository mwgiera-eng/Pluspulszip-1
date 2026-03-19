import { useState } from "react";
import { Car, Building2, ArrowRight, Check, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type AccountType = "driver" | "provider" | null;

const DRIVER_FEATURES = [
  "Real-time demand map",
  "Zone profit heat",
  "Earnings tracker",
  "AI route tips",
];

const PROVIDER_FEATURES = [
  "Fleet zone coordination",
  "Driver performance",
  "Airport intelligence",
  "Priority support",
];

export default function AccountTypeSetup() {
  const [selected, setSelected] = useState<AccountType>(null);
  const [companyName, setCompanyName] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async ({ accountType, companyName }: { accountType: string; companyName?: string }) => {
      const res = await fetch("/api/auth/account-type", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accountType, companyName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSelect = (type: AccountType) => {
    setSelected(prev => prev === type ? null : type);
    setCompanyName("");
  };

  const handleSubmit = () => {
    if (!selected) return;
    if (selected === "provider" && companyName.trim().length < 2) {
      toast({ title: "Company name required", description: "Enter your fleet or company name.", variant: "destructive" });
      return;
    }
    mutation.mutate({ accountType: selected, companyName: selected === "provider" ? companyName.trim() : undefined });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mb-4">
            <Map className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">How will you use ShiftOptima?</h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Choose your account type. This helps us tailor the experience and gives admins context when reviewing your registration.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => handleSelect("driver")}
            className={cn(
              "text-left rounded-2xl border-2 p-5 transition-all duration-200 space-y-4 focus:outline-none",
              selected === "driver"
                ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                : "border-border bg-card hover:border-primary/40 hover:bg-primary/3"
            )}
            data-testid="card-type-driver"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Car className="w-5 h-5 text-primary" />
              </div>
              {selected === "driver" && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-base">Independent Driver</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                I am an independent driver and want to maximize my earnings
              </p>
            </div>
            <ul className="space-y-1.5">
              {DRIVER_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </button>

          <button
            onClick={() => handleSelect("provider")}
            className={cn(
              "text-left rounded-2xl border-2 p-5 transition-all duration-200 space-y-4 focus:outline-none",
              selected === "provider"
                ? "border-violet-500 bg-violet-500/5 shadow-lg shadow-violet-500/10"
                : "border-border bg-card hover:border-violet-500/40 hover:bg-violet-500/3"
            )}
            data-testid="card-type-provider"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-violet-400" />
              </div>
              {selected === "provider" && (
                <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-base">Fleet Manager</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                I manage a team of drivers operating across platforms
              </p>
            </div>
            <ul className="space-y-1.5">
              {PROVIDER_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </button>
        </div>

        {selected && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {selected === "provider" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Fleet or company name</label>
                <Input
                  placeholder="e.g. Kraków Premium Fleet"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-11"
                  data-testid="input-company-name"
                />
              </div>
            )}
            <Button
              className={cn(
                "w-full h-12 text-base font-semibold",
                selected === "provider" && "bg-violet-600 hover:bg-violet-700 text-white"
              )}
              onClick={handleSubmit}
              disabled={mutation.isPending}
              data-testid="button-confirm-account-type"
            >
              {mutation.isPending
                ? "Saving..."
                : selected === "driver"
                ? "Continue as Driver"
                : "Continue as Fleet Manager"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
