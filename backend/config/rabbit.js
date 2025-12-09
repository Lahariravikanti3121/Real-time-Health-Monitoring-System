const amqp = require('amqplib');

async function createChannel() {
  const connection = await amqp.connect(process.env.RABBIT_URL || 'amqp://localhost:5672');
  const channel = await connection.createChannel();
  return channel;
}

module.exports = { createChannel };
