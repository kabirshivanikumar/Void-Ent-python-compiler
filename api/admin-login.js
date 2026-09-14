module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const password = (body && body.password) || '';
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD is not configured on the server.' });
    return;
  }

  if (password && password === expected) {
    res.status(200).json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Incorrect password.' });
  }
};
