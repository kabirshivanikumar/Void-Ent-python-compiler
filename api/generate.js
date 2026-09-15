// Defensive cap on how much conversation we forward upstream, regardless of
// what the client sends — keeps the context window small and cheap.
const MAX_HISTORY_MESSAGES = 12;

// The only model this deployment is allowed to use. Enforced server-side —
// any "model" field the client sends is ignored on purpose.
const FIXED_MODEL = 'meta-llama/llama-3.1-8b-instruct';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing OPENROUTER_API_KEY.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const prompt = body && body.prompt ? String(body.prompt).trim() : '';
  const model = FIXED_MODEL;
  const currentCode = body && typeof body.currentCode === 'string' ? body.currentCode : '';
  let history = Array.isArray(body && body.history) ? body.history : [];

  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt.' });
    return;
  }

  history = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY_MESSAGES)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  const systemPrompt =
    'You are a code generation engine embedded in a developer tool. ' +
    'Respond with valid, runnable Python 3 code only. ' +
    'Output ONLY the code itself inside a single fenced code block, with no explanation before or after it. ' +
    'When the user asks for a change, fix, or follow-up, edit the existing code shown to you and return the FULL updated file — never a diff, snippet, or partial excerpt.';

  const userContent = currentCode
    ? `Current code in the editor:\n\`\`\`python\n${currentCode.slice(0, 6000)}\n\`\`\`\n\nRequest: ${prompt}`
    : prompt;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userContent }
  ];

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || req.headers.referer || 'https://voidenterprises.xyz',
        'X-Title': 'VOID Enterprises Code Simulator'
      },
      body: JSON.stringify({ model, messages, temperature: 0.3 })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status).json({ error: `OpenRouter error (${upstream.status}): ${errText.slice(0, 500)}` });
      return;
    }

    const data = await upstream.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    if (!reply) {
      res.status(502).json({ error: 'No content returned by the model.' });
      return;
    }

    const fenceMatch = reply.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
    const code = (fenceMatch ? fenceMatch[1] : reply).trim();

    res.status(200).json({ code });
  } catch (err) {
    res.status(500).json({ error: 'NetworkError: ' + (err.message || String(err)) });
  }
};
