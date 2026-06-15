export const formatScore = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  const normalized = value <= 1 ? value * 100 : value;
  return normalized.toFixed(2);
};

export const formatPercent = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
};

export const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
};

export const formatNumber = (value, decimals = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return Number(value).toFixed(decimals);
};
