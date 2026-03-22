export function assertIntegerMoney(value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error("Money value must be an integer");
  }
}
