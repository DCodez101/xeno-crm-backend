require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api/customers', require('./routes/customers'));
app.use('/api/segments',  require('./routes/segments'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/receipts',  require('./routes/receipts'));
app.use('/api/ai',        require('./routes/ai'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'xeno-crm-backend' }));

// Connect to MongoDB then start server
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('ERROR: MONGODB_URI not set in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('[crm-backend] MongoDB connected');
    app.listen(PORT, () => console.log(`[crm-backend] Running on port ${PORT}`));
  })
  .catch(err => {
    console.error('[crm-backend] MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
