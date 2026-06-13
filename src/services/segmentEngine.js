/**
 * Segment Engine
 * Converts a rules array + logic (AND/OR) into a MongoDB filter object.
 *
 * Supported operators:
 *   gt, gte, lt, lte, eq, ne  → direct MongoDB comparison
 *   in, not_in                 → $in / $nin on arrays
 *   contains                   → regex match (for tags / city strings)
 *   days_ago_gt                → lastOrderAt < now - N days  (inactive for N+ days)
 *   days_ago_lt                → lastOrderAt > now - N days  (active within N days)
 */

const OPERATOR_MAP = {
  gt:  '$gt',
  gte: '$gte',
  lt:  '$lt',
  lte: '$lte',
  eq:  '$eq',
  ne:  '$ne'
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - Number(n));
  return d;
}

function buildRuleFilter(rule) {
  const { field, operator, value } = rule;

  switch (operator) {
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
    case 'eq':
    case 'ne':
      return { [field]: { [OPERATOR_MAP[operator]]: Number(value) } };

    case 'in':
      return { [field]: { $in: Array.isArray(value) ? value : [value] } };

    case 'not_in':
      return { [field]: { $nin: Array.isArray(value) ? value : [value] } };

    case 'contains':
      return { [field]: { $regex: value, $options: 'i' } };

    case 'days_ago_gt':
      // "hasn't ordered in more than N days"
      return { lastOrderAt: { $lt: daysAgo(value) } };

    case 'days_ago_lt':
      // "ordered within the last N days"
      return { lastOrderAt: { $gte: daysAgo(value) } };

    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

function buildMongoFilter(rules = [], logic = 'AND') {
  if (!rules.length) return {};

  const filters = rules.map(buildRuleFilter);

  if (filters.length === 1) return filters[0];

  return logic === 'OR'
    ? { $or: filters }
    : { $and: filters };
}

module.exports = { buildMongoFilter };
