import { RawTimeRange, TimeRange, TimeZone, IntervalValues, RelativeTimeRange, TimeOption } from '../types/time';

import * as dateMath from './datemath';
import { timeZoneAbbrevation, dateTimeFormat, dateTimeFormatTimeAgo } from './formatter';
import { isDateTime, DateTime, dateTime } from './moment_wrapper';
import { dateTimeParse } from './parser';

const spans: { [key: string]: { display: string; section?: number } } = {
  s: { display: 'seconde' },
  m: { display: 'minuut' },
  h: { display: 'uur' },
  d: { display: 'dag' },
  w: { display: 'week' },
  M: { display: 'maand' },
  y: { display: 'jaar' },
};

const BASE_RANGE_OPTIONS: TimeOption[] = [
  { from: 'now/d', to: 'now/d', display: 'Vandaag' },
  { from: 'now/d', to: 'now', display: 'Vandaag tot zo ver' },
  { from: 'now/w', to: 'now/w', display: 'Deze week' },
  { from: 'now/w', to: 'now', display: 'Deze week tot zo ver' },
  { from: 'now/M', to: 'now/M', display: 'Deze maand' },
  { from: 'now/M', to: 'now', display: 'Deze maand tot zo ver' },
  { from: 'now/y', to: 'now/y', display: 'Dit jaar' },
  { from: 'now/y', to: 'now', display: 'Dit jaar tot zo ver' },

  { from: 'now-1d/d', to: 'now-1d/d', display: 'Gisteren' },
  {
    from: 'now-2d/d',
    to: 'now-2d/d',
    display: 'Eergisteren',
  },
  {
    from: 'now-7d/d',
    to: 'now-7d/d',
    display: 'Vandaag van vorige week',
  },
  { from: 'now-1w/w', to: 'now-1w/w', display: 'Vorige week' },
  { from: 'now-1M/M', to: 'now-1M/M', display: 'Vorige maand' },
  { from: 'now-1Q/fQ', to: 'now-1Q/fQ', display: 'Vorig belastingsjaar kwartaal' },
  { from: 'now-1y/y', to: 'now-1y/y', display: 'Vorig jaar' },
  { from: 'now-1y/fy', to: 'now-1y/fy', display: 'Vorig belastingsjaar' },

  { from: 'now-5m', to: 'now', display: 'Laatste 5 minuten' },
  { from: 'now-15m', to: 'now', display: 'Laatste 15 minuten' },
  { from: 'now-30m', to: 'now', display: 'Laatste 30 minuten' },
  { from: 'now-1h', to: 'now', display: 'Laatste 1 uur' },
  { from: 'now-3h', to: 'now', display: 'Laatste 3 uren' },
  { from: 'now-6h', to: 'now', display: 'Laatste 6 uren' },
  { from: 'now-12h', to: 'now', display: 'Laatste 12 uren' },
  { from: 'now-24h', to: 'now', display: 'Laatste 24 uren' },
  { from: 'now-2d', to: 'now', display: 'Laatste 2 dagen' },
  { from: 'now-7d', to: 'now', display: 'Laatste 7 dagen' },
  { from: 'now-30d', to: 'now', display: 'Laatste 30 dagen' },
  { from: 'now-90d', to: 'now', display: 'Laatste 90 dagen' },
  { from: 'now-6M', to: 'now', display: 'Laatste 6 maanden' },
  { from: 'now-1y', to: 'now', display: 'Laatste 1 jaar' },
  { from: 'now-2y', to: 'now', display: 'Laatste 2 jaren' },
  { from: 'now-5y', to: 'now', display: 'Laatste 5 jaren' },
  { from: 'now/fQ', to: 'now', display: 'Dit belastingsjaar kwartaal tot nu toe' },
  { from: 'now/fQ', to: 'now/fQ', display: 'Dit belastingsjaar kwartaal' },
  { from: 'now/fy', to: 'now', display: 'Dit belastingsjaar tot nu toe' },
  { from: 'now/fy', to: 'now/fy', display: 'Dit belastingsjaar' },
];

const HIDDEN_RANGE_OPTIONS: TimeOption[] = [
  { from: 'now', to: 'now+1m', display: 'Volgende minuut' },
  { from: 'now', to: 'now+5m', display: 'Volgende 5 minuten' },
  { from: 'now', to: 'now+15m', display: 'Volgende 15 minuten' },
  { from: 'now', to: 'now+30m', display: 'Volgende 30 minuten' },
  { from: 'now', to: 'now+1h', display: 'Volgende uur' },
  { from: 'now', to: 'now+3h', display: 'Volgende 3 uren' },
  { from: 'now', to: 'now+6h', display: 'Volgende 6 uren' },
  { from: 'now', to: 'now+12h', display: 'Volgende 12 uren' },
  { from: 'now', to: 'now+24h', display: 'Volgende 24 uren' },
  { from: 'now', to: 'now+2d', display: 'Volgende 2 dagen' },
  { from: 'now', to: 'now+7d', display: 'Volgende 7 dagen' },
  { from: 'now', to: 'now+30d', display: 'Volgende 30 dagen' },
  { from: 'now', to: 'now+90d', display: 'Volgende 90 dagen' },
  { from: 'now', to: 'now+6M', display: 'Volgende 6 maanden' },
  { from: 'now', to: 'now+1y', display: 'Volgende jaar' },
  { from: 'now', to: 'now+2y', display: 'Volgende 2 jaren' },
  { from: 'now', to: 'now+5y', display: 'Volgende 5 jaren' },
];

const STANDARD_RANGE_OPTIONS = BASE_RANGE_OPTIONS.concat(HIDDEN_RANGE_OPTIONS);

function findRangeInOptions(range: RawTimeRange, options: TimeOption[]) {
  return options.find((option) => option.from === range.from && option.to === range.to);
}

// handles expressions like
// 5m
// 5m to now/d
// now/d to now
// now/d
// if no to <expr> then to now is assumed
export function describeTextRange(expr: string): TimeOption {
    const isLast = expr.indexOf('+') !== 0;
    if (expr.indexOf('now') === -1) {
        expr = (isLast ? 'nu-' : 'nu') + expr;
    }

    let opt = findRangeInOptions({ from: expr, to: 'nu' }, STANDARD_RANGE_OPTIONS);
    if (opt) {
        return opt;
    }

    if (isLast) {
        opt = { from: expr, to: 'nu', display: '' };
    } else {
        opt = { from: 'nu', to: expr, display: '' };
    }

    const parts = /^now([-+])(\d+)(\w)/.exec(expr);
    if (parts) {
        const unit = parts[3];
        const amount = parseInt(parts[2], 10);
        const span = spans[unit];
        if (span) {
            opt.display = isLast ? 'Laatste ' : 'Volgende ';
            opt.display += amount + ' ' + span.display;

            // Correcte meervoudsvormen
            if (amount > 1) {
                opt.display += (span.display === 'minuut') ? 'en' :
                    (span.display === 'uur') ? 'en' :
                        (span.display === 'dag') ? 'en' :
                            (span.display === 'week') ? 'en' :
                                (span.display === 'maand') ? 'en' :
                                    (span.display === 'jaar') ? 'en' : 's';
            }

            opt.section = span.section;
        }
    } else {
        opt.display = opt.from.replace('now', 'nu') + ' tot ' + opt.to.replace('now', 'nu');
        opt.invalid = true;
    }

    return opt;
}

/**
 * Use this function to get a properly formatted string representation of a {@link @grafana/data:RawTimeRange | range}.
 *
 * @category TimeUtils
 * @param range - a time range (usually specified by the TimePicker)
 * @param timeZone - optional time zone.
 * @param quickRanges - optional dashboard's custom quick ranges to pick range names from.
 * @alpha
 */
export function describeTimeRange(range: RawTimeRange, timeZone?: TimeZone, quickRanges?: TimeOption[]): string {
    const rangeOptions = quickRanges ? quickRanges.concat(STANDARD_RANGE_OPTIONS) : STANDARD_RANGE_OPTIONS;
    const option = findRangeInOptions(range, rangeOptions);

    if (option) {
        return option.display;
    }

    const options = { timeZone };

    if (isDateTime(range.from) && isDateTime(range.to)) {
        return dateTimeFormat(range.from, options) + ' tot ' + dateTimeFormat(range.to, options);
    }

    if (isDateTime(range.from)) {
        const parsed = dateMath.parse(range.to, true, 'utc');
        return parsed ? dateTimeFormat(range.from, options) + ' tot ' + dateTimeFormatTimeAgo(parsed, options) : '';
    }

    if (isDateTime(range.to)) {
        const parsed = dateMath.parse(range.from, false, 'utc');
        return parsed ? dateTimeFormatTimeAgo(parsed, options) + ' tot ' + dateTimeFormat(range.to, options) : '';
    }

    if (range.to.toString() === 'now') {
        const res = describeTextRange(range.from);
        return res.display;
    }

    return range.from.toString().replace('now', 'nu') + ' tot ' + range.to.toString().replace('now', 'nu');
}

export const isValidTimeSpan = (value: string) => {
  if (value.indexOf('$') === 0 || value.indexOf('+$') === 0) {
    return true;
  }

  const info = describeTextRange(value);
  return info.invalid !== true;
};

export const describeTimeRangeAbbreviation = (range: TimeRange, timeZone?: TimeZone) => {
  if (isDateTime(range.from)) {
    return timeZoneAbbrevation(range.from, { timeZone });
  }
  const parsed = dateMath.parse(range.from, true);
  return parsed ? timeZoneAbbrevation(parsed, { timeZone }) : '';
};

export const convertRawToRange = (
  raw: RawTimeRange,
  timeZone?: TimeZone,
  fiscalYearStartMonth?: number,
  format?: string
): TimeRange => {
  const from = dateTimeParse(raw.from, { roundUp: false, timeZone, fiscalYearStartMonth, format });
  const to = dateTimeParse(raw.to, { roundUp: true, timeZone, fiscalYearStartMonth, format });

  return {
    from,
    to,
    raw: {
      from: dateMath.isMathString(raw.from) ? raw.from : from,
      to: dateMath.isMathString(raw.to) ? raw.to : to,
    },
  };
};

export function isRelativeTime(v: DateTime | string) {
  if (typeof v === 'string') {
    return v.indexOf('now') >= 0;
  }
  return false;
}

export function isFiscal(timeRange: TimeRange) {
  if (typeof timeRange.raw.from === 'string' && timeRange.raw.from.indexOf('f') > 0) {
    return true;
  } else if (typeof timeRange.raw.to === 'string' && timeRange.raw.to.indexOf('f') > 0) {
    return true;
  }
  return false;
}

export function isRelativeTimeRange(raw: RawTimeRange): boolean {
  return isRelativeTime(raw.from) || isRelativeTime(raw.to);
}

export function secondsToHms(seconds: number): string {
  const numYears = Math.floor(seconds / 31536000);
  if (numYears) {
    return numYears + 'y';
  }
  const numDays = Math.floor((seconds % 31536000) / 86400);
  if (numDays) {
    return numDays + 'd';
  }
  const numHours = Math.floor(((seconds % 31536000) % 86400) / 3600);
  if (numHours) {
    return numHours + 'h';
  }
  const numMinutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
  if (numMinutes) {
    return numMinutes + 'm';
  }
  const numSeconds = Math.floor((((seconds % 31536000) % 86400) % 3600) % 60);
  if (numSeconds) {
    return numSeconds + 's';
  }
  const numMilliseconds = Math.floor(seconds * 1000.0);
  if (numMilliseconds) {
    return numMilliseconds + 'ms';
  }

  return 'minder dan 1 ms'; //'just now' //or other string you like;
}

// Format timeSpan (in sec) to string used in log's meta info
export function msRangeToTimeString(rangeMs: number): string {
  const rangeSec = Number((rangeMs / 1000).toFixed());

  const h = Math.floor(rangeSec / 60 / 60);
  const m = Math.floor(rangeSec / 60) - h * 60;
  const s = Number((rangeSec % 60).toFixed());
  let formattedH = h ? h + 'h' : '';
  let formattedM = m ? m + 'min' : '';
  let formattedS = s ? s + 'sec' : '';

  formattedH && formattedM ? (formattedH = formattedH + ' ') : (formattedH = formattedH);
  (formattedM || formattedH) && formattedS ? (formattedM = formattedM + ' ') : (formattedM = formattedM);

  return formattedH + formattedM + formattedS || 'minder dan 1 seconde';
}

export function calculateInterval(range: TimeRange, resolution: number, lowLimitInterval?: string): IntervalValues {
  let lowLimitMs = 1; // 1 millisecond default low limit
  if (lowLimitInterval) {
    lowLimitMs = intervalToMs(lowLimitInterval);
  }

  let intervalMs = roundInterval((range.to.valueOf() - range.from.valueOf()) / resolution);
  if (lowLimitMs > intervalMs) {
    intervalMs = lowLimitMs;
  }
  return {
    intervalMs: intervalMs,
    interval: secondsToHms(intervalMs / 1000),
  };
}

const interval_regex = /(-?\d+(?:\.\d+)?)(ms|[Mwdhmsy])/;
// histogram & trends
const intervals_in_seconds: Record<string, number> = {
  y: 31536000,
  M: 2592000,
  w: 604800,
  d: 86400,
  h: 3600,
  m: 60,
  s: 1,
  ms: 0.001,
};

export function describeInterval(str: string) {
  // Default to seconds if no unit is provided
  if (Number(str)) {
    return {
      sec: intervals_in_seconds.s,
      type: 's',
      count: parseInt(str, 10),
    };
  }

  const matches = str.match(interval_regex);
  if (!matches) {
    throw new Error(
      `Ongeldige intervalstring, moet ofwel eenheidloos zijn of eindigen met een van de volgende eenheden: "${Object.keys(
        intervals_in_seconds
      ).join(', ')}"`
    );
  }

  const sec = intervals_in_seconds[matches[2]];
  if (sec === undefined) {
    // this can never happen, because above we
    // already made sure the key is correct,
    // but we handle it to be safe.
    throw new Error('describeInterval failed: invalid interval string');
  }

  return {
    sec,
    type: matches[2],
    count: parseInt(matches[1], 10),
  };
}

export function intervalToSeconds(str: string): number {
  const info = describeInterval(str);
  return info.sec * info.count;
}

export function intervalToMs(str: string): number {
  const info = describeInterval(str);
  return info.sec * 1000 * info.count;
}

export function roundInterval(interval: number) {
  switch (true) {
    // 0.01s
    case interval < 10:
      return 1; // 0.001s
    // 0.015s
    case interval < 15:
      return 10; // 0.01s
    // 0.035s
    case interval < 35:
      return 20; // 0.02s
    // 0.075s
    case interval < 75:
      return 50; // 0.05s
    // 0.15s
    case interval < 150:
      return 100; // 0.1s
    // 0.35s
    case interval < 350:
      return 200; // 0.2s
    // 0.75s
    case interval < 750:
      return 500; // 0.5s
    // 1.5s
    case interval < 1500:
      return 1000; // 1s
    // 3.5s
    case interval < 3500:
      return 2000; // 2s
    // 7.5s
    case interval < 7500:
      return 5000; // 5s
    // 12.5s
    case interval < 12500:
      return 10000; // 10s
    // 17.5s
    case interval < 17500:
      return 15000; // 15s
    // 25s
    case interval < 25000:
      return 20000; // 20s
    // 45s
    case interval < 45000:
      return 30000; // 30s
    // 1.5m
    case interval < 90000:
      return 60000; // 1m
    // 3.5m
    case interval < 210000:
      return 120000; // 2m
    // 7.5m
    case interval < 450000:
      return 300000; // 5m
    // 12.5m
    case interval < 750000:
      return 600000; // 10m
    // 17.5m
    case interval < 1050000:
      return 900000; // 15m
    // 25m
    case interval < 1500000:
      return 1200000; // 20m
    // 45m
    case interval < 2700000:
      return 1800000; // 30m
    // 1.5h
    case interval < 5400000:
      return 3600000; // 1h
    // 2.5h
    case interval < 9000000:
      return 7200000; // 2h
    // 4.5h
    case interval < 16200000:
      return 10800000; // 3h
    // 9h
    case interval < 32400000:
      return 21600000; // 6h
    // 1d
    case interval < 86400000:
      return 43200000; // 12h
    // 1w
    case interval < 604800000:
      return 86400000; // 1d
    // 3w
    case interval < 1814400000:
      return 604800000; // 1w
    // 6w
    case interval < 3628800000:
      return 2592000000; // 30d
    default:
      return 31536000000; // 1y
  }
}

/**
 * Converts a TimeRange to a RelativeTimeRange that can be used in
 * e.g. alerting queries/rules.
 *
 * @internal
 */
export function timeRangeToRelative(timeRange: TimeRange, now: DateTime = dateTime()): RelativeTimeRange {
  const from = now.unix() - timeRange.from.unix();
  const to = now.unix() - timeRange.to.unix();

  return {
    from,
    to,
  };
}

/**
 * Converts a RelativeTimeRange to a TimeRange
 *
 * @internal
 */
export function relativeToTimeRange(relativeTimeRange: RelativeTimeRange, now: DateTime = dateTime()): TimeRange {
  const from = dateTime(now).subtract(relativeTimeRange.from, 's');
  const to = relativeTimeRange.to === 0 ? dateTime(now) : dateTime(now).subtract(relativeTimeRange.to, 's');

  return {
    from,
    to,
    raw: { from, to },
  };
}
