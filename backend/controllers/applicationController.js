const applicationStore = require('../services/applicationStore');

// ── List all sent applications ───────────────────────────────────────────────
async function listApplications(req, res) {
  try {
    const apps = await applicationStore.readApplications();
    return res.json({ applications: apps, total: apps.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Check duplicate for a company name ──────────────────────────────────────
async function checkDuplicate(req, res) {
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: 'company query param is required' });

  try {
    const matches = await applicationStore.checkDuplicate(company);
    return res.json({
      isDuplicate: matches.length > 0,
      matches,
      company,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Delete an application record ─────────────────────────────────────────────
async function deleteApplication(req, res) {
  const { id } = req.params; // Using ID string for Firebase
  if (!id) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const apps = await applicationStore.readApplications();
    const result = await applicationStore.deleteApplication(id);
    if (result) {
      return res.json({ success: true });
    } else {
      return res.status(404).json({ error: 'Application not found or delete failed.' });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

module.exports = { listApplications, checkDuplicate, deleteApplication };
