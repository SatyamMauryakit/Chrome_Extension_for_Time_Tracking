const mongoose = require('mongoose');

const LogEntrySchema = new mongoose.Schema({
  url: { type: String, required: true },
  duration: { type: Number, default: 0 }, // seconds
  timestamp: { type: Date, default: Date.now }
});

const LogSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  logs: [LogEntrySchema]
}, { timestamps: true });

module.exports = mongoose.model('Log', LogSchema);
