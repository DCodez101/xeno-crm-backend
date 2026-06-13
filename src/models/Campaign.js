const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  segmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Segment', required: true },
  message: { type: String, required: true },
  channel: { type: String, enum: ['whatsapp', 'sms', 'email', 'rcs'], default: 'whatsapp' },
  status: {
    type: String,
    enum: ['draft', 'sending', 'sent', 'failed'],
    default: 'draft'
  },
  stats: {
    total:     { type: Number, default: 0 },
    sent:      { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed:    { type: Number, default: 0 },
    opened:    { type: Number, default: 0 },
    clicked:   { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  sentAt:    { type: Date }
});

module.exports = mongoose.model('Campaign', campaignSchema);
