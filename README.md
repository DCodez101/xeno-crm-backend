# XenoCRM — Backend Services

AI-native Mini CRM for D2C fashion brands. Built for the Xeno FDE Internship Assignment 2026.

## Live URLs
- **Frontend:** https://xeno-crm-frontend-six.vercel.app
- **CRM Backend:** https://xeno-crm-backend-ud1l.onrender.com
- **Channel Service:** https://xeno-channel-service-fque.onrender.com

---

## Architecture

```
Frontend (Vercel)
      |
      | REST API
      ↓
CRM Backend (Render) ──── POST /send ────► Channel Service (Render)
      ↑                                           |
      └──────── POST /api/receipts ───────────────┘
                    (async callbacks)
      |
      ↓
MongoDB Atlas
```

The two-service callback loop is the core system design:
- CRM calls POST /send on the channel service with all recipient messages
- Channel service returns 202 Accepted immediately
- Asynchronously fires callbacks back to POST /api/receipts with delivery outcomes
- Each message progresses: queued → sent → delivered → opened → clicked (or failed)
- Callbacks include retry logic with exponential backoff

This mirrors how real providers like Twilio and WhatsApp Business API work.

---

## Repository Structure

```
xeno-crm-backend/
├── src/
│   ├── index.js                 ← Express app, port 5000
│   ├── seed.js                  ← Seeds 200 customers + ~950 orders
│   ├── models/
│   │   ├── Customer.js
│   │   ├── Order.js
│   │   ├── Segment.js
│   │   ├── Campaign.js
│   │   └── Message.js           ← One doc per recipient, tracks full lifecycle
│   ├── services/
│   │   ├── segmentEngine.js     ← Converts rules array → MongoDB query
│   │   └── aiService.js         ← Groq: segment suggest + message draft
│   └── routes/
│       ├── customers.js         ← List, search, stats, import
│       ├── segments.js          ← CRUD + preview audience count
│       ├── campaigns.js         ← Create, send, live stats
│       ├── receipts.js          ← Webhook receiver from channel service
│       └── ai.js                ← AI suggest segment + draft message
│
channel-service/
├── src/
│   ├── index.js                 ← Express app, port 4000
│   ├── simulator.js             ← Async lifecycle + retries
│   └── routes/
│       ├── send.js              ← POST /send (receives from CRM)
│       └── health.js            ← GET /health
```

---

## API Reference

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/customers | List customers (search, pagination) |
| GET | /api/customers/stats | Dashboard stats + city distribution |
| POST | /api/customers/import | Bulk ingest customers |
| GET | /api/segments | List all segments |
| POST | /api/segments | Create segment with rules |
| POST | /api/segments/preview | Preview audience count |
| GET | /api/campaigns | List all campaigns with live stats |
| POST | /api/campaigns | Create campaign |
| POST | /api/campaigns/:id/send | Trigger send → calls channel service |
| GET | /api/campaigns/:id/stats | Live delivery breakdown |
| POST | /api/receipts | Webhook — receives callbacks from channel service |
| POST | /api/ai/suggest-segment | Natural language → segment rules (Groq) |
| POST | /api/ai/draft-message | Segment context → message copy (Groq) |

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB Atlas (Mongoose)
- **AI:** Groq API — llama-3.3-70b-versatile
- **Deploy:** Render (free tier)

---

## Environment Variables

Create a `.env` file in the `crm-backend/` directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
GROQ_API_KEY=your_groq_api_key
CHANNEL_SERVICE_URL=https://xeno-channel-service-fque.onrender.com
NODE_ENV=production
```

Create a `.env` file in the `channel-service/` directory:

```env
PORT=4000
CRM_RECEIPT_URL=https://xeno-crm-backend-ud1l.onrender.com/api/receipts
DELIVERY_DELAY_MIN_MS=1000
DELIVERY_DELAY_MAX_MS=8000
PROB_DELIVERED=0.80
PROB_FAILED=0.10
PROB_OPENED=0.45
PROB_CLICKED=0.20
RECEIPT_MAX_RETRIES=3
```

---

## Run Locally

```bash
# Terminal 1 — CRM Backend
cd crm-backend
cp .env.example .env
# fill in MONGODB_URI and GROQ_API_KEY
npm install
npm run dev          # runs on http://localhost:5000

# Terminal 2 — Channel Service
cd channel-service
cp .env.example .env
npm install
npm run dev          # runs on http://localhost:4000

# Terminal 3 — Seed the database (run once)
cd crm-backend
node src/seed.js     # inserts 200 customers + ~950 orders
```

---

## AI Features

**Segment Suggest** — describe an audience in plain English, get structured rules back:
```
Input:  "customers who spent more than 5000 and haven't ordered in 30 days"
Output: { name, description, logic: "AND", rules: [...] }
```

**Message Draft** — given a segment and channel, generates personalised copy:
```
Input:  { segmentName: "High Value Inactive", channel: "whatsapp" }
Output: "Hi {{name}}, we've missed you! ..."
```

---

## Channel Delivery Simulation

| Channel | Open rate modifier | Click rate modifier | Fail rate modifier |
|---------|-------------------|--------------------|--------------------|
| WhatsApp | +30% | +20% | -20% |
| SMS | +10% | -40% | base |
| Email | -15% | +10% | +10% |
| RCS | +20% | +30% | -10% |

---

## Design Decisions and Tradeoffs

| Decision | Reasoning |
|----------|-----------|
| Two separate services | Mirrors real provider architecture (Twilio, MSG91) |
| Async callbacks with retries | Handles CRM downtime without losing receipts |
| Groq over OpenAI | Free tier, faster inference, sufficient quality |
| Seeded data over CSV import | Faster demo, realistic Indian D2C brand data |
| No auth | Not required by the assignment brief |
| MongoDB over SQL | Flexible schema for evolving message/segment rules |

---

## Related Repository

- **Frontend:** https://github.com/DCodez101/xeno-crm-frontend
