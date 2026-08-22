export interface TransactionPort {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export const TRANSACTION_PORT = 'TransactionPort';
