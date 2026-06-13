const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  amount: { type: Number, required: true },
  items: [{
    name: String,
    category: String,
    quantity: Number,
    price: Number
  }],
  channel: { type: String, enum: ['online', 'store', 'app'], default: 'online' },
  status: { type: String, enum: ['completed', 'returned', 'cancelled'], default: 'completed' },
  createdAt: { type: Date, default: Date.now }
});

orderSchema.index({ customerId: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ amount: 1 });

module.exports = mongoose.model('Order', orderSchema);
