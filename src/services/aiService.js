const Groq = require('groq-sdk');

let groq;
function getGroq() {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}

/**
 * Takes a natural-language description like
 * "customers who spent over 5000 and haven't bought in 30 days"
 * and returns a rules array ready to save as a Segment.
 */
async function suggestSegmentRules(description) {
  const systemPrompt = `You are a CRM segment rule generator. Convert natural language into a JSON rules array.

Available fields: totalSpend (number), orderCount (number), lastOrderAt (date), city (string), tags (array of strings)
Available operators: gt, gte, lt, lte, eq, ne, in, not_in, contains, days_ago_gt, days_ago_lt

days_ago_gt: "hasn't ordered in more than N days" → { field: "lastOrderAt", operator: "days_ago_gt", value: N }
days_ago_lt: "ordered within last N days" → { field: "lastOrderAt", operator: "days_ago_lt", value: N }

Respond ONLY with a valid JSON object. No markdown, no explanation.
Format: { "name": "Segment name", "description": "short description", "rules": [...], "logic": "AND" }`;

  const chat = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description }
    ]
  });

  const raw = chat.choices[0].message.content.trim();
  // Strip markdown fences if model adds them
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/**
 * Drafts a personalised campaign message given segment context.
 */
async function draftCampaignMessage({ segmentName, segmentDescription, channel, brandName = 'Zara Collective' }) {
  const systemPrompt = `You are a marketing copywriter for a D2C fashion brand called "${brandName}".
Write a short, warm, personalised campaign message for a messaging channel.
Keep it under 160 characters for SMS, under 300 for WhatsApp/Email/RCS.
Use {{name}} as a placeholder for the customer's name.
Respond with ONLY the message text. No quotes, no explanation.`;

  const userPrompt = `Channel: ${channel}
Target audience: ${segmentName} — ${segmentDescription || 'loyal shoppers'}
Write a campaign message.`;

  const chat = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.8,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });

  return chat.choices[0].message.content.trim();
}

module.exports = { suggestSegmentRules, draftCampaignMessage };
