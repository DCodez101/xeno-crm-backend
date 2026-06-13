const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  messageId:   { type: String, required: true, unique: true }, // uuid sent to channel svc
  campaignId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  customerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  body:        { type: String },
  channel:     { type: String },
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked'],
    default: 'queued'
  },
  sentAt:      { type: Date },
  deliveredAt: { type: Date },
  openedAt:    { type: Date },
  clickedAt:   { type: Date },
  failedAt:    { type: Date },
  failReason:  { type: String }
});

messageSchema.index({ campaignId: 1 });
messageSchema.index({ messageId: 1 });
messageSchema.index({ customerId: 1 });

module.exports = mongoose.model('Message', messageSchema);
