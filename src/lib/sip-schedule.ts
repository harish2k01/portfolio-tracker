import type { SipFrequency, SipRow } from "@/types/portfolio";

export type SipDebit = {
  sipId: string;
  date: string;
  amount: number;
  name: string;
};

function parse(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function format(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Move an ISO date by whole steps of the SIP frequency, keeping the anchor day of month where it exists. */
export function shiftSipDate(iso: string, frequency: SipFrequency, steps: number, anchorDay = parse(iso).day) {
  const { year, month, day } = parse(iso);

  if (frequency === "WEEKLY") {
    const date = new Date(Date.UTC(year, month - 1, day + steps * 7));
    return format(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const monthIndex = year * 12 + (month - 1) + steps * (frequency === "QUARTERLY" ? 3 : 1);
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = (monthIndex % 12) + 1;

  return format(nextYear, nextMonth, Math.min(anchorDay, daysInMonth(nextYear, nextMonth)));
}

/**
 * Debit dates of active SIPs between `from` and `to` (inclusive, `YYYY-MM-DD`),
 * projected forwards and backwards from each SIP's next due date and never
 * before its start date.
 */
export function projectSipDebits(sips: SipRow[], from: string, to: string): SipDebit[] {
  const debits: SipDebit[] = [];

  for (const sip of sips) {
    if (sip.status !== "ACTIVE" || !sip.nextDueDate) {
      continue;
    }

    const anchorDay = parse(sip.nextDueDate).day;
    const push = (date: string) => debits.push({ sipId: sip.id, date, amount: sip.amount, name: sip.asset.name });

    for (let step = 0; step < 400; step += 1) {
      const date = shiftSipDate(sip.nextDueDate, sip.frequency, step, anchorDay);
      if (date > to) {
        break;
      }
      if (date >= from) {
        push(date);
      }
    }

    for (let step = -1; step > -400; step -= 1) {
      const date = shiftSipDate(sip.nextDueDate, sip.frequency, step, anchorDay);
      if (date < from || date < sip.startDate) {
        break;
      }
      if (date <= to) {
        push(date);
      }
    }
  }

  return debits.sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date)));
}
