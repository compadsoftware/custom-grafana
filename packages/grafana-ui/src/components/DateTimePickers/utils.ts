import { dateMath, dateTimeParse, isDateTime, TimeRange, TimeZone } from '@grafana/data';

export function isValid(value: string, roundUp?: boolean, timeZone?: TimeZone): boolean {
  if (isDateTime(value)) {
    return value.isValid();
  }

  const validateValue = typeof value === 'string' ? value.replace(/^nu/, 'now') : value;

  if (dateMath.isMathString(validateValue)) {
    return dateMath.isValid(validateValue);
  }

  const parsed = dateTimeParse(validateValue, { roundUp, timeZone });
  return parsed.isValid();
}

function isRangeInvalid(from: string, to: string, timezone?: string): boolean {
  const processedFrom = typeof from === 'string' ? from.replace(/^nu/, 'now') : from;
  const processedTo = typeof to === 'string' ? to.replace(/^nu/, 'now') : to;

  const raw: RawTimeRange = { from: processedFrom, to: processedTo };
  const timeRange = rangeUtil.convertRawToRange(raw, timezone);
  const valid = timeRange.from.isSame(timeRange.to) || timeRange.from.isBefore(timeRange.to);

  return !valid;
}
