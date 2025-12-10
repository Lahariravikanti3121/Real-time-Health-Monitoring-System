const mongoose = require('mongoose');

const HealthSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  heartRate: Number,
  bloodPressure: Number,
  oxygen: Number,
  temperature: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HealthData', HealthSchema);
