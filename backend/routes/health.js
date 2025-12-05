const express = require('express');
const router = express.Router();
const Health = require('../models/HealthData');
const { checkAlerts } = require('../utils/alerts');
const redisClient = require('../config/redisClient');
const { createChannel } = require('../config/rabbit');

module.exports = (io) => {

router.get('/recent/:userId', async (req, res) => {
  const userId = req.params.userId;
  const cacheKey = `recent:${userId}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const data = await Health.find({ userId }).sort({ createdAt: -1 }).limit(20);
    await redisClient.set(cacheKey, JSON.stringify(data), { EX: 10 });
    return res.json(data);
  } catch (err) { return res.status(500).json({ error: 'server' }); }
});

router.post('/generate/:userId', async (req, res) => {
  const userId = req.params.userId;

  const payload = {
    userId,
    heartRate: Math.floor(Math.random()*60)+50,
    bloodPressure: Math.floor(Math.random()*80)+80,
    oxygen: Math.floor(Math.random()*7)+92,
    temperature: parseFloat((Math.random()*2 + 36).toFixed(1))
  };

  try {
    const doc = new Health(payload);
    await doc.save();

    await redisClient.del(`recent:${userId}`);

    io.emit('health-update', doc);

    const alerts = checkAlerts(payload);
    if (alerts.length > 0) {
      try {
        const ch = await createChannel();
        const q = 'alerts';
        await ch.assertQueue(q);
        ch.sendToQueue(q, Buffer.from(JSON.stringify({ userId, alerts, doc })));
      } catch (e) { console.error('Rabbit publish failed', e); }
    }

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server' });
  }
});

return router;
};
