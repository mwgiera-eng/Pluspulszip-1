import { useEffect } from "react";

declare global {
  interface Window {
    paypal?: {
      HostedButtons: (options: { hostedButtonId: string }) => {
        render: (selector: string) => void;
      };
    };
  }
}

interface PaypalSubscriptionButtonProps {
  onButtonClick?: () => void;
}

export function PaypalSubscriptionButton({ onButtonClick }: PaypalSubscriptionButtonProps) {
  useEffect(() => {
    // Check if PayPal SDK is already loaded
    const existingScript = document.querySelector("#paypal-sdk");
    
    const loadPayPalSDK = () => {
      if (existingScript) {
        // SDK already loaded, render button immediately
        if (window.paypal) {
          renderButton();
        }
        return;
      }

      // Create and load PayPal SDK script
      const script = document.createElement("script");
      script.src = "https://www.paypal.com/sdk/js?client-id=BAAa6lLV5hDPX8zM0fpl-wSTdtGE5h_cbQNXmwrpKwnCS82xmhLD3EWxUVzFXoTjYCQrelwAd6Wa-8pQCk&components=hosted-buttons&disable-funding=venmo&currency=PLN";
      script.id = "paypal-sdk";
      script.async = true;
      script.onload = () => {
        renderButton();
      };
      script.onerror = () => {
        console.error("[PayPal] Failed to load SDK");
      };
      document.head.appendChild(script);
    };

    const renderButton = () => {
      const container = document.getElementById("paypal-container-7X7E3HTGNG6WL");
      if (container && window.paypal && window.paypal.HostedButtons) {
        // Clear any previous content
        container.innerHTML = "";
        
        try {
          window.paypal.HostedButtons({
            hostedButtonId: "7X7E3HTGNG6WL"
          }).render("#paypal-container-7X7E3HTGNG6WL");
        } catch (err) {
          console.error("[PayPal] Failed to render button:", err);
        }
      }
    };

    loadPayPalSDK();
  }, []);

  return (
    <div className="space-y-4">
      <div 
        id="paypal-container-7X7E3HTGNG6WL"
        onClick={onButtonClick}
      />
    </div>
  );
}
