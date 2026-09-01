export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
export const ARGENTINA_COUNTRY_CODE = "54";

export const businessDayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export type BusinessDayKey = (typeof businessDayKeys)[number];

export type BusinessHoursRange = {
  open: string;
  close: string;
};

export type BusinessHours = {
  timezone: typeof ARGENTINA_TIME_ZONE;
  days: Record<BusinessDayKey, BusinessHoursRange[]>;
};

export const businessDayLabels: Record<BusinessDayKey, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo"
};

const weekdayToBusinessDay: Record<string, BusinessDayKey> = {
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
  sunday: "sunday"
};

export function emptyBusinessHours(): BusinessHours {
  return {
    timezone: ARGENTINA_TIME_ZONE,
    days: {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: []
    }
  };
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function getArgentineLocalPhone(value: string) {
  let digits = digitsOnly(value);
  if (digits.startsWith(ARGENTINA_COUNTRY_CODE)) {
    digits = digits.slice(ARGENTINA_COUNTRY_CODE.length);
  }
  if (digits.length === 11 && digits.startsWith("9")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function formatArgentineLocalPhone(value: string) {
  const digits = getArgentineLocalPhone(value);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export function normalizeArgentineWhatsAppPhone(value: string) {
  const local = getArgentineLocalPhone(value);
  return local ? `${ARGENTINA_COUNTRY_CODE}${local}` : "";
}

export function isCompleteArgentineLocalPhone(value: string) {
  return getArgentineLocalPhone(value).length === 10;
}

const customerNamePattern = /^[\p{L}]+(?:[ '\u2019-][\p{L}]+)*$/u;

export function isValidCustomerName(value: string) {
  const name = value.trim();
  return name.length >= 3 && customerNamePattern.test(name);
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isOvernightRange(range: BusinessHoursRange) {
  return minutesFromTime(range.close) < minutesFromTime(range.open);
}

function rangeEndMinutes(range: BusinessHoursRange) {
  const open = minutesFromTime(range.open);
  const close = minutesFromTime(range.close);
  return close < open ? close + 24 * 60 : close;
}

export function normalizeBusinessHours(value: unknown): BusinessHours {
  if (!value || typeof value !== "object") {
    return emptyBusinessHours();
  }

  const input = value as { days?: unknown };
  const output = emptyBusinessHours();
  const days = input.days && typeof input.days === "object" ? (input.days as Record<string, unknown>) : {};

  for (const day of businessDayKeys) {
    const ranges = Array.isArray(days[day]) ? days[day] : [];
    const normalizedRanges = ranges.map((range) => {
      const item = range && typeof range === "object" ? (range as Record<string, unknown>) : {};
      if (!isValidTime(item.open) || !isValidTime(item.close)) {
        throw new Error("Los horarios deben tener formato HH:mm.");
      }
      const openMinutes = minutesFromTime(item.open);
      const closeMinutes = minutesFromTime(item.close);
      if (openMinutes === closeMinutes) {
        throw new Error("La apertura y el cierre no pueden ser iguales.");
      }
      return { open: item.open, close: item.close };
    });

    normalizedRanges.sort((a, b) => minutesFromTime(a.open) - minutesFromTime(b.open));
    for (let index = 1; index < normalizedRanges.length; index += 1) {
      if (minutesFromTime(normalizedRanges[index].open) < rangeEndMinutes(normalizedRanges[index - 1])) {
        throw new Error("Los rangos horarios no pueden superponerse.");
      }
    }
    output.days[day] = normalizedRanges;
  }

  return output;
}

function getZonedDayAndMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value.toLowerCase() ?? "monday";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return {
    day: weekdayToBusinessDay[weekday] ?? "monday",
    minutes: hour * 60 + minute
  };
}

export function getStoreAvailability(input: { restrictBySchedule: boolean; businessHours: unknown; now?: Date }) {
  if (!input.restrictBySchedule) {
    return { isOpen: true, label: "Tienda abierta" };
  }

  let hours: BusinessHours;
  try {
    hours = normalizeBusinessHours(input.businessHours);
  } catch {
    return { isOpen: false, label: "Tienda cerrada por horario" };
  }

  const { day, minutes } = getZonedDayAndMinutes(input.now ?? new Date(), hours.timezone);
  const currentDayIndex = businessDayKeys.indexOf(day);
  const previousDay = businessDayKeys[(currentDayIndex + businessDayKeys.length - 1) % businessDayKeys.length];
  const previousOvernightRange = hours.days[previousDay].find((range) => {
    return isOvernightRange(range) && minutes < minutesFromTime(range.close);
  });

  if (previousOvernightRange) {
    return { isOpen: true, label: `Abierto hasta las ${previousOvernightRange.close}` };
  }

  const todayRanges = hours.days[day];
  const activeRange = todayRanges.find((range) => {
    const open = minutesFromTime(range.open);
    const close = minutesFromTime(range.close);
    if (close < open) {
      return minutes >= open;
    }
    return minutes >= open && minutes < close;
  });

  if (activeRange) {
    return { isOpen: true, label: `Abierto hasta las ${activeRange.close}${isOvernightRange(activeRange) ? " del día siguiente" : ""}` };
  }

  for (let offset = 0; offset < businessDayKeys.length; offset += 1) {
    const candidateDay = businessDayKeys[(currentDayIndex + offset) % businessDayKeys.length];
    const candidateRanges = hours.days[candidateDay];
    const nextRange = candidateRanges.find((range) => offset > 0 || minutesFromTime(range.open) > minutes);
    if (nextRange) {
      const dayLabel = offset === 0 ? "hoy" : offset === 1 ? "mañana" : businessDayLabels[candidateDay];
      return {
        isOpen: false,
        label: `Tienda cerrada. Vuelve a abrir ${dayLabel} a las ${nextRange.open}.`
      };
    }
  }

  return { isOpen: false, label: "Tienda cerrada por horario." };
}
