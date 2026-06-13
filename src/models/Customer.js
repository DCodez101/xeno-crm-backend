const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  city: { type: String },
  tags: [{ type: String }],
  totalSpend: { type: Number, default: 0 },
  orderCount: { type: Number, default: 0 },
  lastOrderAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

customerSchema.index({ email: 1 });
customerSchema.index({ totalSpend: 1 });
customerSchema.index({ lastOrderAt: 1 });
customerSchema.index({ orderCount: 1 });

module.exports = mongoose.model('Customer', customerSchema);
