import { Hono } from "hono";
import { paymentMiddleware, type Resource, type SolanaAddress, type Network } from "x402-hono";

type PaymentConfig = {
  address: `0x${string}` | SolanaAddress;
  facilitatorUrl: Resource;
  network: string;
  svmRpcUrl?: string;
};

type WeatherConfig = {
  solanaMainnet?: PaymentConfig;
  solanaDevnet?: PaymentConfig;
  baseMainnet?: PaymentConfig;
  baseSepolia?: PaymentConfig;
};

// Helper to generate demo weather response
const getWeatherResponse = (location?: string) => {
  const locations = ['New York', 'London', 'Tokyo', 'Paris', 'Sydney'];
  const conditions = ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy', 'Clear'];
  const selectedLocation = location || locations[Math.floor(Math.random() * locations.length)];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  const temperature = Math.floor(Math.random() * 10) + 5; // 5-15°C
  const humidity = Math.floor(Math.random() * 40) + 40; // 40-80%
  
  return {
    location: selectedLocation,
    temperature: {
      celsius: temperature,
      fahrenheit: Math.round(temperature * 9/5 + 32),
    },
    condition,
    humidity: `${humidity}%`,
    wind_speed: `${Math.floor(Math.random() * 20) + 5} km/h`,
    timestamp: new Date().toISOString(),
    note: "This is demo data for testing purposes",
  };
};

export function createWeatherRoutes(config: WeatherConfig) {
  const app = new Hono();

  // Solana Mainnet weather endpoint - costs $0.02
  if (config.solanaMainnet) {
    app.get(
      "/weather",
      paymentMiddleware(
        config.solanaMainnet.address,
        {
          "GET /weather": {
            price: "$0.02",
            network: config.solanaMainnet.network as Network,
          },
        },
        {
          url: config.solanaMainnet.facilitatorUrl,
        },
        {
          svmRpcUrl: config.solanaMainnet.svmRpcUrl,
        }
      ),
      (c) => {
        const location = c.req.query('location');
        return c.json(getWeatherResponse(location));
      }
    );
  }

  // Solana Devnet weather endpoint - costs $0.02
  if (config.solanaDevnet) {
    app.get(
      "/solana-devnet/weather",
      paymentMiddleware(
        config.solanaDevnet.address,
        {
          "GET /solana-devnet/weather": {
            price: "$0.02",
            network: config.solanaDevnet.network as Network,
          },
        },
        {
          url: config.solanaDevnet.facilitatorUrl,
        },
        {
          svmRpcUrl: config.solanaDevnet.svmRpcUrl,
          enableTrustless: true,
        }
      ),
      (c) => {
        const location = c.req.query('location');
        return c.json(getWeatherResponse(location));
      }
    );
  }

  // Base Mainnet weather endpoint - costs $0.02
  if (config.baseMainnet) {
    app.get(
      "/base/weather",
      paymentMiddleware(
        config.baseMainnet.address,
        {
          "GET /base/weather": {
            price: "$0.02",
            network: config.baseMainnet.network as Network,
          },
        },
        { url: config.baseMainnet.facilitatorUrl }
      ),
      (c) => {
        const location = c.req.query('location');
        return c.json(getWeatherResponse(location));
      }
    );
  }

  // Base Sepolia weather endpoint - costs $0.02
  if (config.baseSepolia) {
    app.get(
      "/base-sepolia/weather",
      paymentMiddleware(
        config.baseSepolia.address,
        {
          "GET /base-sepolia/weather": {
            price: "$0.02",
            network: config.baseSepolia.network as Network,
          },
        },
        { url: config.baseSepolia.facilitatorUrl }
      ),
      (c) => {
        const location = c.req.query('location');
        return c.json(getWeatherResponse(location));
      }
    );
  }

  return app;
}
