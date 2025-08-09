const express = require('express');
const Log = require('../models/Log');

const router = express.Router();

// List of URLs to ignore
const BLOCKLIST = ["localhost", "127.0.0.1", "newtab", "chrome://", "file://"];

// Helper: Extract hostname safely
function normalizeHostname(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, ""); // remove "www."
  } catch {
    return url;
  }
}

// POST: Add logs
router.post('/', async (req, res) => {
  try {
    let { userId, logs } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    if (!logs) return res.status(400).json({ message: 'logs required' });

    if (!Array.isArray(logs)) logs = [logs];

    // Sanitize logs
    logs = logs
      .map(l => ({
        url: normalizeHostname(l.url || 'unknown'),
        duration: Math.max(0, Number(l.duration) || 0),
        timestamp: l.timestamp ? new Date(l.timestamp) : new Date()
      }))
      .filter(l =>
        l.duration > 0 &&
        !BLOCKLIST.some(blocked => l.url.includes(blocked))
      );

    if (!logs.length) {
      return res.json({ message: "No valid logs to save" });
    }

    const userLog = await Log.findOneAndUpdate(
      { userId },
      { $push: { logs: { $each: logs } } },
      { upsert: true, new: true }
    );

    res.json({ logs: userLog.logs });
  } catch (err) {
    console.error('Error saving logs:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET: Fetch logs
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId required' });

    const userLog = await Log.findOne({ userId });
    if (!userLog) return res.json({ logs: [] });

    res.json({ logs: userLog.logs });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE: Remove all logs for a specific URL
router.delete('/remove-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'url required' });

    const normalized = normalizeHostname(url);

    const result = await Log.updateMany(
      {},
      { $pull: { logs: { url: normalized } } }
    );

    res.json({ message: 'Logs removed', result });
  } catch (err) {
    console.error('Error deleting logs:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
