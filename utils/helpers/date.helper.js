import moment from 'moment-timezone';
import env from '../../config/env.js';

const TIMEZONE = 'Asia/Jakarta';

export const now = () => {
  return moment().tz(TIMEZONE);
};

export const isWeekend = (date) => {
  const day = moment(date).day();
  return day === 0 || day === 6;
};

export const isBusinessDay = (date) => {
  return !isWeekend(date);
};

export const addBusinessDays = (startDate, days) => {
  if (!env.businessDays.excludeWeekends) {
    return moment(startDate).add(days, 'days').toDate();
  }

  let current = moment(startDate).tz(TIMEZONE);
  let businessDaysAdded = 0;

  while (businessDaysAdded < days) {
    current.add(1, 'days');
    if (isBusinessDay(current)) {
      businessDaysAdded++;
    }
  }

  return current.toDate();
};

export const subtractBusinessDays = (endDate, days) => {
  if (!env.businessDays.excludeWeekends) {
    return moment(endDate).subtract(days, 'days').toDate();
  }

  let current = moment(endDate).tz(TIMEZONE);
  let businessDaysSubtracted = 0;

  while (businessDaysSubtracted < days) {
    current.subtract(1, 'days');
    if (isBusinessDay(current)) {
      businessDaysSubtracted++;
    }
  }

  return current.toDate();
};

export const calculateBusinessDays = (startDate, endDate) => {
  if (!env.businessDays.excludeWeekends) {
    return moment(endDate).diff(moment(startDate), 'days');
  }

  let start = moment(startDate).tz(TIMEZONE).startOf('day');
  let end = moment(endDate).tz(TIMEZONE).startOf('day');
  let businessDays = 0;

  if (start.isAfter(end)) {
    [start, end] = [end, start];
  }

  while (start.isSameOrBefore(end)) {
    if (isBusinessDay(start)) {
      businessDays++;
    }
    start.add(1, 'days');
  }

  return businessDays;
};

export const getNextBusinessDay = (date) => {
  let next = moment(date).tz(TIMEZONE).add(1, 'days');

  while (isWeekend(next)) {
    next.add(1, 'days');
  }

  return next.toDate();
};

export const getPreviousBusinessDay = (date) => {
  let previous = moment(date).tz(TIMEZONE).subtract(1, 'days');

  while (isWeekend(previous)) {
    previous.subtract(1, 'days');
  }

  return previous.toDate();
};

export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  return moment(date).tz(TIMEZONE).format(format);
};

export const formatDateISO = (date) => {
  return moment(date).tz(TIMEZONE).toISOString();
};

export const formatDateSQL = (date) => {
  return moment(date).tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
};

export const parseDate = (dateString, format = null) => {
  if (format) {
    return moment.tz(dateString, format, TIMEZONE).toDate();
  }
  return moment.tz(dateString, TIMEZONE).toDate();
};

export const isExpired = (expiryDate) => {
  return moment(expiryDate).tz(TIMEZONE).isBefore(now());
};

export const isTokenExpired = (expiryDate) => {
  return isExpired(expiryDate);
};

export const getDaysUntil = (targetDate) => {
  return moment(targetDate).diff(now(), 'days');
};

export const getBusinessDaysUntil = (targetDate) => {
  return calculateBusinessDays(now().toDate(), targetDate);
};

export const addDays = (startDate, days) => {
  return moment(startDate).add(days, 'days').toDate();
};

export const subtractDays = (endDate, days) => {
  return moment(endDate).subtract(days, 'days').toDate();
};

export const startOfDay = (date) => {
  return moment(date).tz(TIMEZONE).startOf('day').toDate();
};

export const endOfDay = (date) => {
  return moment(date).tz(TIMEZONE).endOf('day').toDate();
};

export const isSameDay = (date1, date2) => {
  return moment(date1).tz(TIMEZONE).isSame(moment(date2).tz(TIMEZONE), 'day');
};

export const isAfter = (date1, date2) => {
  return moment(date1).isAfter(moment(date2));
};

export const isBefore = (date1, date2) => {
  return moment(date1).isBefore(moment(date2));
};

export default {
  now,
  isWeekend,
  isBusinessDay,
  addBusinessDays,
  subtractBusinessDays,
  calculateBusinessDays,
  getNextBusinessDay,
  getPreviousBusinessDay,
  formatDate,
  formatDateISO,
  formatDateSQL,
  parseDate,
  isExpired,
  isTokenExpired,
  getDaysUntil,
  getBusinessDaysUntil,
  addDays,
  subtractDays,
  startOfDay,
  endOfDay,
  isSameDay,
  isAfter,
  isBefore,
};
