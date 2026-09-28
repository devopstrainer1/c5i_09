// Annual interest rate for savings accounts. Simple (non-compounding)
// interest, accrued and posted once per statement period.
const SAVINGS_ANNUAL_RATE = 0.025;

// Calculates the interest owed for one statement period on a savings
// account, given the balance at the start of the period and the
// period's start/end dates.
export function calculateMonthlyInterest(
  balance: number,
  periodStart: Date,
  periodEnd: Date,
): number {
  const daysInMonth = 30;
  const dailyRate = SAVINGS_ANNUAL_RATE / 365;
  return Math.round(balance * dailyRate * daysInMonth * 100) / 100;
}
