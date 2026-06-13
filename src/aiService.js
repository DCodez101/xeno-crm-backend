const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * suggestSegmentRules
 * Takes a plain English description and returns { name, description, rules, logic }
 */
async function suggestSegmentRules(description) {
  const prompt = `You are a CRM assistant. Convert this customer segment description into structured rules.

Description: "${description}"

Valid fields: totalSpend, orderCount, lastOrderAt, city, tags
Valid operators for totalSpend/orderCount: gt, gte, lt, lte
Valid operators for lastOrderAt: days_ago_gt (inactive > N days), days_ago_lt (active within N days)
Valid operators for city: eq, contains
Valid operators for tags: in, not_in

Respond with ONLY a JSON object, no markdown, no explanation:
{
  "name": "short segment name",
  "description": "one line description",
  "logic": "AND",
  "rules": [
    { "field": "totalSpend", "operator": "gt", "value": "5000" }
  ]
}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 400,
  });

  const text = response.choices[0]?.message?.content?.trim() || '';

  // Strip markdown fences if present
  const clean = text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(clean);
    // Ensure values are strings (frontend expects string values in rule inputs)
    if (parsed.rules) {
      parsed.rules = parsed.rules.map(r => ({ ...r, value: String(r.value) }));
    }
    return parsed;
  } catch {
    throw new Error('AI returned invalid JSON. Try rephrasing your description.');
  }
}

/**
 * draftCampaignMessage
 * Takes segment context and channel, returns a personalised message string
 */
async function draftCampaignMessage({ segmentName, segmentDescription, channel }) {
  const channelTips = {
    whatsapp: 'Keep it under 160 chars, conversational, warm tone.',
    sms:      'Keep it under 120 chars, very concise, include a clear CTA.',
    email:    'Can be 2-3 sentences, professional but friendly.',
    rcs:      'Rich and engaging, can include an emoji or two.',
  };

  const tip = channelTips[channel] || 'Keep it concise and personalised.';

  const prompt = `You are a marketing copywriter for a D2C fashion brand.

Write a ${channel} message for this customer segment:
- Segment: ${segmentName}
- Description: ${segmentDescription || 'No additional description'}
- Channel guideline: ${tip}

Rules:
- Use {{name}} exactly once as a personalisation token (it gets replaced with the customer's first name)
- Do NOT include subject lines, headers, or any prefix like "Message:" or "Draft:"
- Return ONLY the message text, nothing else
- Make it feel human, not corporate`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 200,
  });

  const message = response.choices[0]?.message?.content?.trim() || '';
  if (!message) throw new Error('AI returned empty message');
  return message;
}

module.exports = { suggestSegmentRules, draftCampaignMessage };