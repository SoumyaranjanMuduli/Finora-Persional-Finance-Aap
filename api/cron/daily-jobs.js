const dailyCheck = require('./daily-check');
const salaryCheck = require('./salary-check');
const recurringCheck = require('./recurring-check');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization || '';
  const results = {};
  let failed = false;

  for (const [name, handler] of Object.entries({ dailyCheck, salaryCheck, recurringCheck })) {
    let status = 200;
    let body = null;
    const subRes = {
      status(code) {
        status = code;
        return this;
      },
      json(value) {
        body = value;
        return this;
      }
    };

    await handler({ method: 'GET', headers: { authorization: auth } }, subRes);
    results[name] = { status, body };
    if (status >= 400) failed = true;
  }

  return res.status(failed ? 500 : 200).json({ ok: !failed, results });
};
