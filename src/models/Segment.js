const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  field: { type: String, required: true },   // e.g. totalSpend, orderCount, lastOrderAt, city, tags
  operator: { type: String, required: true }, // gt, lt, gte, lte, eq, in, not_in, days_ago_gt, days_ago_lt
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { _id: false });

const segmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  rules: [ruleSchema],
  logic: { type: String, enum: ['AND', 'OR'], default: 'AND' },
  audienceCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Segment', segmentSchema);
