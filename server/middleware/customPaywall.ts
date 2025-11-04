import { paymentMiddleware, type Resource, type SolanaAddress } from "x402-hono";
import { getPaywallHtml } from "../paywall/index.js";

/**
 * Creates payment middleware with custom paywall HTML
 * Wraps the x402 payment middleware to intercept and replace the default paywall
 */
export function customPaywallMiddleware(
  address: `0x${string}` | SolanaAddress,
  routes: any,
  facilitatorConfig: any
) {
  const baseMiddleware = paymentMiddleware(address, routes, facilitatorConfig);
  
  return async (c: any, next: any) => {
    // Store original html method
    const originalHtml = c.html.bind(c);
    
    // Override html method to intercept 402 paywall responses
    c.html = (content: string, status?: number) => {
      // If it's a 402 response with the default x402 paywall, replace with custom
      if (status === 402 && typeof content === 'string' && content.includes('window.x402')) {
        try {
          // Extract the x402 config from the default paywall HTML
          const configMatch = content.match(/window\.x402\s*=\s*({[\s\S]*?});/);
          if (configMatch) {
            const configStr = configMatch[1];
            // Parse the config safely
            const x402Config = eval(`(${configStr})`);
            
            // Generate our custom paywall HTML with the same config
            const customHtml = getPaywallHtml({
              amount: x402Config.amount,
              paymentRequirements: x402Config.paymentRequirements,
              currentUrl: x402Config.currentUrl,
              testnet: x402Config.testnet,
              appName: x402Config.appName || "Amiko x402 Server",
              appLogo: x402Config.appLogo || "",
              cdpClientKey: x402Config.cdpClientKey || process.env.CDP_CLIENT_KEY || "",
              sessionTokenEndpoint: x402Config.sessionTokenEndpoint || "",
            });
            
            return originalHtml(customHtml, 402);
          }
        } catch (error) {
          console.error('Failed to parse x402 config from paywall HTML:', error);
        }
      }
      
      // For all other responses, use original method
      return originalHtml(content, status);
    };
    
    // Call the base x402 middleware
    return await baseMiddleware(c, next);
  };
}
