declare module 'pingpp' {
  export interface PingppError {
    message: string;
    code?: string;
    statusCode?: number;
    err?: any;
  }

  export interface Charge {
    id: string;
    object: string;
    created: number;
    livemode: boolean;
    paid: boolean;
    refunded: boolean;
    app: string;
    channel: string;
    order_no: string;
    client_ip: string;
    amount: number;
    amount_settle: number;
    currency: string;
    subject: string;
    body: string;
    extra: Record<string, any>;
    time_paid: number | null;
    time_expire: number;
    date生活费: number;
    refund_status: string;
    amount_refunded: number;
    metadata: Record<string, string>;
    credential: {
      alipay?: {};
      wx?: {};
      upacp?: {};
      cp_b2b?: {};
    };
    payment_url: string;
  }

  export interface Refund {
    id: string;
    object: string;
    amount: number;
    charge: string;
    created: number;
    currency: string;
    description: string | null;
    failure_code: string | null;
    failure_msg: string | null;
    metadata: Record<string, any>;
    reason: string | null;
    status: string;
  }

  export interface ChargeCreateParams {
    order_no: string;
    app: { id: string };
    amount: number;
    channel: string;
    currency: string;
    client_ip: string;
    subject: string;
    body: string;
    metadata?: Record<string, string>;
    extra?: Record<string, any>;
  }

  export interface Pingpp {
    apiKey: string;
    createCharge(params: ChargeCreateParams, callback: (err: PingppError | null, charge?: Charge) => void): void;
    charges: {
      create(params: ChargeCreateParams, callback: (err: PingppError | null, charge?: Charge) => void): void;
      retrieve(chargeId: string, callback: (err: PingppError | null, charge?: Charge) => void): void;
      createRefund(chargeId: string, params: { amount?: number; description?: string }, callback: (err: PingppError | null, refund?: Refund) => void): void;
    };
  }

  const pingpp: Pingpp;
  export default pingpp;
}
