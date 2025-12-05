const amqp = require('amqplib');

(async ()=>{
  try {
    const conn = await amqp.connect(process.env.RABBIT_URL || 'amqp://localhost:5672');
    const ch = await conn.createChannel();
    const q = 'alerts';
    await ch.assertQueue(q);
    console.log('Waiting for alerts...');
    ch.consume(q, msg => {
      if (!msg) return;
      const content = JSON.parse(msg.content.toString());
      console.log('Received alert:', content);
      ch.ack(msg);
    });
  } catch(e) {
    console.error('Worker error', e);
  }
})();
