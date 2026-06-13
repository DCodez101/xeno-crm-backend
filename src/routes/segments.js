const router = require('express').Router();
const Segment = require('../models/Segment');
const Customer = require('../models/Customer');
const { buildMongoFilter } = require('../services/segmentEngine');

// GET /api/segments
router.get('/', async (req, res) => {
  try {
    const segments = await Segment.find().sort({ createdAt: -1 });
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/segments — create
router.post('/', async (req, res) => {
  try {
    const { name, description, rules, logic } = req.body;
    const filter = buildMongoFilter(rules, logic);
    const audienceCount = await Customer.countDocuments(filter);
    const segment = await Segment.create({ name, description, rules, logic, audienceCount });
    res.status(201).json(segment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/segments/:id/preview — count + sample 5 customers
router.get('/:id/preview', async (req, res) => {
  try {
    const segment = await Segment.findById(req.params.id);
    if (!segment) return res.status(404).json({ error: 'Not found' });

    const filter = buildMongoFilter(segment.rules, segment.logic);
    const [count, sample] = await Promise.all([
      Customer.countDocuments(filter),
      Customer.find(filter).limit(5).select('name email totalSpend lastOrderAt city')
    ]);
    res.json({ count, sample });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/segments/preview — preview rules before saving
router.post('/preview', async (req, res) => {
  try {
    const { rules, logic } = req.body;
    const filter = buildMongoFilter(rules, logic);
    const [count, sample] = await Promise.all([
      Customer.countDocuments(filter),
      Customer.find(filter).limit(5).select('name email totalSpend lastOrderAt city')
    ]);
    res.json({ count, sample });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/segments/:id
router.delete('/:id', async (req, res) => {
  try {
    await Segment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
