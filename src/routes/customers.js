const router = require('express').Router();
const Customer = require('../models/Customer');
const Order = require('../models/Order');

// GET /api/customers — list with optional filters
router.get('/', async (req, res) => {
  try {
    const { search, city, minSpend, maxSpend, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    if (city) filter.city = city;
    if (minSpend) filter.totalSpend = { ...filter.totalSpend, $gte: Number(minSpend) };
    if (maxSpend) filter.totalSpend = { ...filter.totalSpend, $lte: Number(maxSpend) };

    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ customers, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/stats — summary numbers for dashboard
router.get('/stats', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, topSpender, active30d, avgResult, cityResult] = await Promise.all([
      Customer.countDocuments(),
      Customer.findOne().sort({ totalSpend: -1 }).select('totalSpend'),
      Customer.countDocuments({ lastOrderAt: { $gte: thirtyDaysAgo } }),
      Customer.aggregate([{ $group: { _id: null, avg: { $avg: '$totalSpend' } } }]),
      Customer.aggregate([
        { $match: { city: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 }
      ])
    ]);

    // Convert city array to { CityName: count } object
    const byCity = {};
    cityResult.forEach(c => { if (c._id) byCity[c._id] = c.count; });

    res.json({
      total,
      avgSpend:   avgResult[0]?.avg?.toFixed(2) || 0,
      topSpend:   topSpender?.totalSpend || 0,
      active30d,
      byCity,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id — single customer with orders
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    const orders = await Order.find({ customerId: req.params.id }).sort({ createdAt: -1 }).limit(20);
    res.json({ customer, orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/import — bulk ingest array of customers
router.post('/import', async (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers)) return res.status(400).json({ error: 'customers must be an array' });

    const results = await Promise.allSettled(
      customers.map(c => Customer.findOneAndUpdate(
        { email: c.email },
        { $setOnInsert: c },
        { upsert: true, new: true }
      ))
    );
    const inserted = results.filter(r => r.status === 'fulfilled').length;
    res.json({ inserted, total: customers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;