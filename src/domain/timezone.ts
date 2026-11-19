// src/domain/timezone.ts
// Todas as datas operam em America/Sao_Paulo. Semana: segunda a domingo.

export const TIMEZONE = "America/Sao_Paulo";

export const toSaoPauloDate = (date: Date = new Date()): Date => {
  // Retorna um Date cujos componentes (getFullYear etc.) representam o horário de SP.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return new Date(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
};

export const formatDateISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const todayISO = (now: Date = new Date()): string => formatDateISO(toSaoPauloDate(now));

// Segunda-feira da semana de uma data (ISO yyyy-mm-dd)
export const weekStartISO = (isoDate: string): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0=dom,1=seg...
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatDateISO(date);
};

export const weekDaysISO = (startISO: string): string[] => {
  const [y, m, d] = startISO.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(base);
    dt.setDate(base.getDate() + i);
    days.push(formatDateISO(dt));
  }
  return days;
};

export const isPastDate = (isoDate: string, now: Date = new Date()): boolean => {
  return isoDate < todayISO(now);
};

export const weekdayLabel = (isoDate: string): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: TIMEZONE }).toUpperCase();
};
