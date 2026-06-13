const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const Campaign = require('../models/Campaign');
const Segment = require('../models/Segment');
const Message = require('../models/Message');
const Customer = require('../models/Customer');
const { buildMongoFilter } = require('../services/segmentEngine');

/**
 * getLiveStats — aggregates from Message collection.
 *
 * "sent" = total messages that were ever dispatched (all messages created for campaign)
 * "delivered" = messages currently in delivered state
 * "opened" = messages currently in opened state
 * "clicked" = messages currently in clicked state
 * "failed/bounced" = messages in failed or bounced state
 *
 * NOTE: status is overwritten as lifecycle progresses (sent→delivered→opened→clicked)
 * so we can't count "sent" by status='sent'. Instead: sent = total message docs created.
 */
async function getLiveStats(campaignId) {
  const breakdown = await Message.aggregate([
    { $match: { campaignId: campaignId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const byStatus = {};
  breakdown.forEach(b => { byStatus[b._id] = b.count; });

  // Total = all message docs for this campaign (sent count = total dispatched)
  const total = await Message.countDocuments({ campaignId });

  // "delivered" means currently in delivered state OR has progressed past it (opened/clicked)
  // Because status gets overwritten: delivered→opened→clicked
  // So actual delivered = delivered + opened + clicked (they all passed through delivered)
  const rawDelivered = byStatus['delivered'] ?? 0;
  const rawOpened    = byStatus['opened']    ?? 0;
  const rawClicked   = byStatus['clicked']   ?? 0;
  const rawFailed    = (byStatus['failed']   ?? 0) + (byStatus['bounced'] ?? 0);

  // Cumulative counts (each includes the stages after it too)
  const delivered = rawDelivered + rawOpened + rawClicked;
  const opened    = rawOpened + rawClicked;  // clicked messages were also opened
  const clicked   = rawClicked;

  return {
    total,
    sent:      total,          // all dispatched = "sent"
    delivered,
    failed:    rawFailed,
    opened,
    clicked,
  };
}

// GET /api/campaigns
router.get('/', async (req, res) => {
  try {
    const campaigns = await Campaign.find()
      .populate('segmentId', 'name audienceCount')
      .sort({ createdAt: -1 });

    const withStats = await Promise.all(campaigns.map(async (c) => {
      const obj = c.toObject();
      if (c.status !== 'draft') {
        obj.stats = await getLiveStats(c._id);
      }
      return obj;
    }));

    res.json(withStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns — create draft
router.post('/', async (req, res) => {
  try {
    const { name, segmentId, message, channel } = req.body;
    const campaign = await Campaign.create({ name, segmentId, message, channel });
    res.status(201).json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/campaigns/:id
router.get('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate('segmentId');
    if (!campaign) return res.status(404).json({ error: 'Not found' });

    const obj = campaign.toObject();

    if (campaign.status !== 'draft') {
      obj.stats = await getLiveStats(campaign._id);

      // Auto-mark as sent when no messages remain in queued state
      const pending = await Message.countDocuments({
        campaignId: campaign._id,
        status: { $in: ['queued', 'sent'] }
      });
      if (pending === 0 && campaign.status === 'sending') {
        await Campaign.findByIdAndUpdate(campaign._id, { status: 'sent' });
        obj.status = 'sent';
      }
    }

    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/send
router.post('/:id/send', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate('segmentId');
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status !== 'draft') {
      return res.status(400).json({ error: `Campaign already ${campaign.status}` });
    }

    const segment = campaign.segmentId;
    const filter = buildMongoFilter(segment.rules, segment.logic);
    const customers = await Customer.find(filter).select('_id name email phone');

    if (!customers.length) {
      return res.status(400).json({ error: 'Segment has no matching customers' });
    }

    const messageDocs = customers.map(c => {
      const personalised = campaign.message.replace(/\{\{name\}\}/gi, c.name.split(' ')[0]);
      return {
        messageId: uuidv4(),
        campaignId: campaign._id,
        customerId: c._id,
        body: personalised,
        channel: campaign.channel,
        status: 'queued'
      };
    });

    await Message.insertMany(messageDocs);

    campaign.status = 'sending';
    campaign.sentAt = new Date();
    campaign.stats = { total: customers.length, sent: customers.length, delivered: 0, failed: 0, opened: 0, clicked: 0 };
    await campaign.save();

    const channelPayload = {
      campaignId: campaign._id.toString(),
      channel: campaign.channel,
      messages: messageDocs.map((m, i) => ({
        messageId: m.messageId,
        recipientId: customers[i]._id.toString(),
        recipientPhone: customers[i].phone || '+919999999999',
        body: m.body
      }))
    };

    const channelUrl = process.env.CHANNEL_SERVICE_URL || 'http://localhost:4000';
    axios.post(`${channelUrl}/send`, channelPayload).catch(err => {
      console.error('[campaign/send] Channel service error:', err.message);
    });

    res.json({ message: 'Campaign sending', total: customers.length, campaignId: campaign._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Not found' });

    const stats = await getLiveStats(campaign._id);

    res.json({
      campaign: {
        ...campaign.toObject(),
        stats
      },
      stats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;