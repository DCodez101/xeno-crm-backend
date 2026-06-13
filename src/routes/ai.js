const router = require('express').Router();
const { suggestSegmentRules, draftCampaignMessage } = require('../services/aiService');

// POST /api/ai/suggest-segment
// Body: { description: "customers who spent over 5000 and haven't bought in 30 days" }
router.post('/suggest-segment', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });
    const result = await suggestSegmentRules(description);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/draft-message
// Body: { segmentName, segmentDescription, channel }
router.post('/draft-message', async (req, res) => {
  try {
    const { segmentName, segmentDescription, channel } = req.body;
    if (!segmentName || !channel) return res.status(400).json({ error: 'segmentName and channel are required' });
    const message = await draftCampaignMessage({ segmentName, segmentDescription, channel });
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
