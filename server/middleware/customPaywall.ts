import { paymentMiddleware, type Resource, type SolanaAddress } from "x402-hono";
import { getPaywallHtml } from "../paywall/index.js";

/**
 * Custom paywall middleware wrapper that uses our getPaywallHtml function
 * to inject custom paywall HTML when x402 payment is required
 */
export function customPaywallMiddleware(
  address: `0x${string}` | SolanaAddress,
  routes: any,
  facilitatorConfig: any
) {
  const baseMiddleware = paymentMiddleware(address, routes, facilitatorConfig);
  
  return async (c: any, next: any) => {
    // Intercept the response by wrapping next()
    let paymentRequired = false;
    let x402ConfigData: any = null;
    
    // Override c.html to capture 402 responses from x402 middleware
    const originalHtml = c.html;
    c.html = (content: any, status?: number) => {
      if (status === 402 && typeof content === 'string' && content.includes('window.x402')) {
        paymentRequired = true;
        // Extract x402 config from the HTML
        try {
          const configMatch = content.match(/window\.x402\s*=\s*({[\s\S]*?});/);
          if (configMatch) {
            const configStr = configMatch[1];
            x402ConfigData = eval(`(${configStr})`);
          }
        } catch (error) {
          console.error('Failed to parse x402 config:', error);
        }
        // Don't return yet, we'll handle it after
        return originalHtml.call(c, content, status);
      }
      return originalHtml.call(c, content, status);
    };
    
    // Call the x402-hono middleware
    await baseMiddleware(c, next);
    
    // If payment was required and we captured the config, return custom HTML
    if (paymentRequired && x402ConfigData) {
      const customHtml = getPaywallHtml({
        amount: x402ConfigData.amount,
        paymentRequirements: x402ConfigData.paymentRequirements,
        currentUrl: x402ConfigData.currentUrl,
        testnet: x402ConfigData.testnet,
        appName: x402ConfigData.appName || "Amiko x402 Server",
        appLogo: x402ConfigData.appLogo,
        cdpClientKey: x402ConfigData.cdpClientKey || process.env.CDP_CLIENT_KEY,
        sessionTokenEndpoint: x402ConfigData.sessionTokenEndpoint,
      });
      return originalHtml.call(c, customHtml, 402);
    }
  };
}
