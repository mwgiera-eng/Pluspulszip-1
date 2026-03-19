import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Shield, Check, Clock, Loader2, AlertCircle,
  Calendar, Wallet, Bell, Brain, ExternalLink
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import { PaypalSubscriptionButton } from "@/components/PaypalSubscriptionButton";

type Payment = {
  id: number;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  completedAt: string | null;
};

export default function Subscription() {
  const { user, isPremium, subscriptionInfo } = useAuth();
  const { toast } = useToast();
  const [paypalWaiting, setPaypalWaiting] = useState(false);
  const [paypalElapsed, setPaypalElapsed] = useState(false);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: !!user,
  });

  const { data: subData } = useQuery<{ sandbox?: boolean }>({
    queryKey: ["/api/subscription"],
    enabled: !!user,
  });

  const isSandbox = subData?.sandbox === true;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Clear URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("payment")) {
      setLocation("/subscription", { replace: true });
    }
    return () => stopPolling();
  }, []);

  // Poll PayPal status every 3 seconds after button click
  useEffect(() => {
    if (!paypalWaiting) return;

    let attempts = 0;
    const maxAttempts = 20; // ~60 seconds

    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch("/api/subscription/paypal/status", { credentials: "include" });
        const data = await res.json();

        if (data.subscriptionStatus === "active") {
          stopPolling();
          setPaypalWaiting(false);
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
          queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
          toast({ title: "Payment successful", description: "Your premium subscription is now active." });
        } else if (attempts >= maxAttempts) {
          stopPolling();
          setPaypalWaiting(false);
          setPaypalElapsed(true);
          queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
        }
      } catch {
        if (attempts >= maxAttempts) {
          stopPolling();
          setPaypalWaiting(false);
          setPaypalElapsed(true);
        }
      }
    }, 3000);

    return () => stopPolling();
  }, [paypalWaiting]);

  const handlePayPalClick = () => {
    setPaypalWaiting(true);
    setPaypalElapsed(false);
  };

  const status = subscriptionInfo?.status || "expired";
  const trialDaysLeft = subscriptionInfo?.trialDaysLeft ?? 0;
  const trialProgress = status === "trial" ? ((21 - trialDaysLeft) / 21) * 100 : 0;
  const price = subscriptionInfo?.price ?? "9.99";
  const currency = subscriptionInfo?.currency ?? "PLN";

  const features = [
    { icon: Calendar, label: "Day Planner", description: "AI-powered shift scheduling" },
    { icon: Wallet, label: "Earnings Analytics", description: "Detailed income tracking & insights" },
    { icon: Bell, label: "Smart Notifications", description: "Real-time demand alerts" },
    { icon: Brain, label: "Full Recommendations", description: "Advanced route & zone suggestions" },
  ];

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "paypal": return Wallet;
      case "card": return CreditCard;
      default: return Wallet;
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight" data-testid="text-subscription-title">Subscription</h2>
              <p className="text-muted-foreground mt-1">Manage your plan and payments</p>
            </div>
            {isSandbox && (
              <Badge className="bg-amber-500/15 text-amber-500 border-0" data-testid="badge-sandbox-mode">
                Sandbox Mode
              </Badge>
            )}
          </div>

          {/* PayPal waiting / elapsed banners */}
          {paypalWaiting && (
            <Card data-testid="card-paypal-waiting">
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Checking your payment status…</p>
                <p className="text-xs text-muted-foreground">This can take up to a minute after completing payment in PayPal</p>
              </CardContent>
            </Card>
          )}

          {paypalElapsed && !paypalWaiting && (
            <Card data-testid="card-paypal-elapsed">
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <div className="rounded-full bg-amber-500/15 p-3">
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
                <p className="text-lg font-semibold text-amber-500">Payment received</p>
                <p className="text-sm text-muted-foreground text-center">
                  Please allow a few minutes for your subscription to activate. Refresh the page to check again.
                </p>
                <Button
                  onClick={() => {
                    setPaypalElapsed(false);
                    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
                  }}
                  variant="outline"
                  data-testid="button-check-again"
                >
                  Check Again
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Current Plan */}
          <Card data-testid="card-current-plan">
            <CardHeader className="flex flex-row items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {status === "trial" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-lg font-semibold" data-testid="text-plan-name">Free Trial</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-trial-days">{trialDaysLeft} days remaining</p>
                    </div>
                    <Badge className="bg-amber-500/15 text-amber-500 border-0" data-testid="badge-plan-status">Trial</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.round(trialProgress)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary" data-testid="progress-trial">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${trialProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              {status === "active" && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-lg font-semibold" data-testid="text-plan-name">Premium Active</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-renewal-date">
                      Renews {subscriptionInfo?.subscriptionExpiresAt
                        ? new Date(subscriptionInfo.subscriptionExpiresAt).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <Badge className="bg-primary/15 text-primary border-0" data-testid="badge-plan-status">Active</Badge>
                </div>
              )}
              {(status === "expired" || status === "cancelled") && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-lg font-semibold" data-testid="text-plan-name">Trial Expired</p>
                    <p className="text-sm text-muted-foreground">Upgrade to unlock all premium features</p>
                  </div>
                  <Badge variant="destructive" data-testid="badge-plan-status">Expired</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Premium Features */}
          <Card data-testid="card-premium-features">
            <CardHeader className="flex flex-row items-center gap-3">
              <Check className="w-5 h-5 text-primary" />
              <CardTitle>Premium Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {features.map((feature) => (
                  <div key={feature.label} className="flex items-start gap-3" data-testid={`feature-${feature.label.toLowerCase().replace(/\s+/g, "-")}`}>
                    <div className="rounded-lg bg-primary/10 p-2">
                      <feature.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{feature.label}</p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* PayPal Payment Card — shown when subscription is not active and not waiting */}
          {status !== "active" && !paypalWaiting && !paypalElapsed && (
            <Card data-testid="card-payment">
              <CardHeader className="flex flex-row items-center gap-3">
                <CreditCard className="w-5 h-5 text-primary" />
                <CardTitle>Subscribe — {price} {currency}/month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    3 weeks free, then <strong>{price} {currency}/month</strong>. Cancel anytime. Supports PayPal Wallet, Apple Pay, and debit/credit cards.
                  </p>
                </div>

                <a
                  href="https://www.paypal.com/ncp/payment/7X7E3HTGNG6WL"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handlePayPalClick}
                  data-testid="button-paypal-ncp"
                >
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Pay via PayPal
                  </Button>
                </a>

                <div className="text-center space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Or use the hosted payment button below
                  </p>
                </div>

                <PaypalSubscriptionButton onButtonClick={handlePayPalClick} />

                <p className="text-xs text-muted-foreground text-center pt-2">
                  After paying, stay on this page — your subscription will activate automatically within a few minutes.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Payment History */}
          <Card data-testid="card-payment-history">
            <CardHeader className="flex flex-row items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-payments">
                  No payments yet
                </p>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => {
                    const MethodIcon = getPaymentMethodIcon(payment.paymentMethod);
                    return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                        data-testid={`payment-item-${payment.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-secondary p-2">
                            <MethodIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{payment.amount} {payment.currency}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(payment.createdAt).toLocaleDateString()} via {payment.paymentMethod}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={payment.status === "completed" ? "secondary" : "outline"}
                          data-testid={`badge-payment-status-${payment.id}`}
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
