const router = require('express').Router();
const Message = require('../models/Message');
const Campaign = require('../models/Campaign');

/**
 * POST /api/receipts
 * Called by the channel service asynchronously.
 * Body: { messageId, status, timestamp, reason? }
 *
 * Status lifecycle: sent → delivered|failed|bounced → opened → clicked
 */
router.post('/', async (req, res) => {
  // Acknowledge immediately — channel service needs a quick 200
  res.json({ received: true });

  const { messageId, status, timestamp, reason } = req.body;
  if (!messageId || !status) return;

  try {
    const msg = await Message.findOne({ messageId });
    if (!msg) {
      console.warn(`[receipts] Unknown messageId: ${messageId}`);
      return;
    }

    const now = timestamp ? new Date(timestamp) : new Date();

    // Update message status — only advance forward, never go backward
    const STATUS_ORDER = ['queued', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked'];
    const currentIdx = STATUS_ORDER.indexOf(msg.status);
    const newIdx = STATUS_ORDER.indexOf(status);

    // Allow failed/bounced from any non-terminal state
    const isTerminalFailure = ['failed', 'bounced'].includes(status);
    if (!isTerminalFailure && newIdx <= currentIdx) return; // already at or past this state

    const update = { status };
    if (status === 'sent') update.sentAt = now;
    if (status === 'delivered') update.deliveredAt = now;
    if (status === 'opened') update.openedAt = now;
    if (status === 'clicked') update.clickedAt = now;
    if (status === 'failed' || status === 'bounced') {
      update.failedAt = now;
      if (reason) update.failReason = reason;
    }

    await Message.findByIdAndUpdate(msg._id, update);

    // Increment the matching stat on the campaign
    const statField = `stats.${status}`;
    const campaignUpdate = { $inc: { [statField]: 1 } };

    // If every message is now terminal, flip campaign to 'sent'
    await Campaign.findByIdAndUpdate(msg.campaignId, campaignUpdate);

    // Check if all messages are resolved → mark campaign sent
    const pending = await Message.countDocuments({
      campaignId: msg.campaignId,
      status: { $in: ['queued', 'sending'] }
    });
    if (pending === 0) {
      await Campaign.findByIdAndUpdate(msg.campaignId, { status: 'sent' });
    }
  } catch (err) {
    console.error('[receipts] Error processing receipt:', err.message);
  }
});

module.exports = router;
