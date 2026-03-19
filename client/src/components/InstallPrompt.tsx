import { useState, useEffect } from "react";
import { X, Download, Share, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "shiftoptima_install_dismissed_at";
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export type Platform =
  | "ios-safari"
  | "android-chrome"
  | "android-samsung"
  | "android-firefox"
  | "other";

export function detectPlatform(hasPrompt: boolean): Platform {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
  if (isIOS) return "ios-safari";
  if (/SamsungBrowser/i.test(ua)) return "android-samsung";
  if (/Firefox/i.test(ua) && /Android/i.test(ua)) return "android-firefox";
  if (hasPrompt || /Chrome/i.test(ua)) return "android-chrome";
  return "other";
}

export function getPlatformLabel(platform: Platform): string {
  switch (platform) {
    case "ios-safari": return "iPhone / iPad (Safari)";
    case "android-chrome": return "Android (Chrome)";
    case "android-samsung": return "Android (Samsung Internet)";
    case "android-firefox": return "Android (Firefox)";
    default: return "Your browser";
  }
}

interface GuideStep {
  text?: string;
  bold?: string;
  text2?: string;
  bold2?: string;
}

function getGuideSteps(platform: Platform): { title: string; steps: GuideStep[]; note?: string } {
  switch (platform) {
    case "ios-safari":
      return {
        title: "Add to Home Screen on iPhone / iPad",
        steps: [
          { text: "Open this page in ", bold: "Safari" },
          { text: "Tap the ", bold: "Share button (", text2: " the box with an arrow pointing up) at the bottom of the screen" },
          { text: "Scroll down and tap ", bold: '"Add to Home Screen"' },
          { text: "Tap ", bold: '"Add"', text2: " in the top-right corner" },
        ],
        note: "This only works in Safari. Chrome and Firefox on iPhone do not support Add to Home Screen.",
      };
    case "android-chrome":
      return {
        title: "Install on Android (Chrome)",
        steps: [
          { text: "Tap the ", bold: "⋮ menu", text2: " in the top-right corner of Chrome" },
          { text: "Tap ", bold: '"Add to Home screen"' },
          { text: "Tap ", bold: '"Add"', text2: " to confirm" },
        ],
      };
    case "android-samsung":
      return {
        title: "Install on Android (Samsung Internet)",
        steps: [
          { text: "Tap the ", bold: "☰ menu", text2: " at the bottom of the screen" },
          { text: "Tap ", bold: '"Add page to"' },
          { text: "Tap ", bold: '"Home screen"' },
        ],
      };
    case "android-firefox":
      return {
        title: "Install on Android (Firefox)",
        steps: [
          { text: "Tap the ", bold: "⋮ menu", text2: " in the top-right corner" },
          { text: "Tap ", bold: '"Install"' },
          { text: "Tap ", bold: '"Add"', text2: " to confirm" },
        ],
      };
    default:
      return {
        title: "Install ShiftOptima",
        steps: [
          { text: "Open this page in ", bold: "Chrome (Android)", text2: " or ", bold2: "Safari (iPhone)" },
          { text: "Follow the browser's menu to ", bold: '"Add to Home Screen"' },
        ],
        note: "For the best experience, use Chrome on Android or Safari on iPhone.",
      };
  }
}

interface StepItem {
  text?: string;
  bold?: string;
  text2?: string;
  bold2?: string;
}

function GuideStep({ step, index }: { step: StepItem; index: number }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center mt-0.5">
        <span className="text-xs font-bold text-primary">{index + 1}</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">
        {step.text}
        {step.bold && <strong className="text-foreground">{step.bold}</strong>}
        {step.text2}
        {step.bold2 && <strong className="text-foreground">{step.bold2}</strong>}
      </p>
    </div>
  );
}

interface InstallGuideDialogProps {
  open: boolean;
  onClose: () => void;
  platform?: Platform;
}

export function InstallGuideDialog({ open, onClose, platform }: InstallGuideDialogProps) {
  const detectedPlatform = platform ?? detectPlatform(false);
  const guide = getGuideSteps(detectedPlatform);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm mx-auto" data-testid="dialog-install-guide">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Smartphone className="w-4 h-4 text-primary" />
            {guide.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {guide.steps.map((step, i) => (
            <GuideStep key={i} step={step} index={i} />
          ))}
          {guide.note && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed">
              {guide.note}
            </p>
          )}
          <Button className="w-full" onClick={onClose} data-testid="button-guide-close">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isDismissed(): boolean {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (!stored) return false;
    return Date.now() - Number(stored) < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("other");
  const [visible, setVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    const detectedPlatform = detectPlatform(false);
    setPlatform(detectedPlatform);

    if (detectedPlatform === "ios-safari") {
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform(detectPlatform(true));
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (result.outcome === "accepted") {
          setVisible(false);
          return;
        }
      } catch {
        // Fall through to guide
      }
    }
    setGuideOpen(true);
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed bottom-16 left-3 right-3 md:left-auto md:right-4 md:bottom-4 md:w-80 z-50 bg-card border border-border rounded-2xl shadow-xl p-4 flex items-start gap-3"
        data-testid="install-prompt"
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          {platform === "ios-safari" ? (
            <Share className="w-4 h-4 text-primary" />
          ) : (
            <Download className="w-4 h-4 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            Install ShiftOptima
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {platform === "ios-safari"
              ? "Tap Share then \"Add to Home Screen\""
              : "Works offline — get the full app experience"}
          </p>
          <button
            onClick={handleInstall}
            className="mt-2 text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            data-testid="button-install"
          >
            {platform === "ios-safari" ? "Show me how" : "Install"}
          </button>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
          data-testid="button-install-dismiss"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <InstallGuideDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        platform={platform}
      />
    </>
  );
}
