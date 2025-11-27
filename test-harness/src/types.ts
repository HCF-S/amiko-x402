export interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  outputSchema?: {
    input: {
      type: string;
      method: string;
      discoverable: boolean;
    };
  };
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: {
    feePayer?: string;
    [key: string]: unknown;
  };
}
