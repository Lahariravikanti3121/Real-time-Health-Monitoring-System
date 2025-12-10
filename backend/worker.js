const amqp = require('amqplib');
const redis = require('redis');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// ============================================================
// 👇 STEP 1: PASTE YOUR CREDENTIALS HERE
// ============================================================
const EMAIL_USER = 'g.saip666666@gmail.com'; 
const EMAIL_PASS = 'vpii vffy yliv oktu'; // YOUR 16-CHAR APP PASSWORD
// ============================================================

// --- 2. ROBUST CONNECTION STRINGS ---
// If in Docker, use service names. If local, use localhost.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/pulseguard'; 
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rabbitmq:5672';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// DB Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Worker: DB Connected'))
    .catch(err => console.error('❌ Worker: DB Connection Failed', err.message));

const UserSchema = new mongoose.Schema({ name: String, email: String });
const User = mongoose.model('User', UserSchema);
const PatientSchema = new mongoose.Schema({ userId: String, name: String });
const Patient = mongoose.model('Patient', PatientSchema);

// Redis
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.connect().catch(e => console.log('Worker Redis Error:', e.message));

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

async function sendAlertEmail(patientId, message, timestamp) {
    try {
        console.log(`📨 Worker: Preparing email for Patient ID ${patientId}...`);
        
        const patient = await Patient.findById(patientId);
        if (!patient) { console.log("❌ Patient not found in DB"); return; }

        const user = await User.findById(patient.userId);
        if (!user || !user.email) { console.log("❌ User email not found"); return; }

        console.log(`📧 Worker: Sending to ${user.email}...`);
        
        await transporter.sendMail({
            from: `"PulseGuard System" <${EMAIL_USER}>`,
            to: user.email,
            subject: '🚨 CRITICAL HEALTH ALERT',
            html: `
                <div style="background:#fef2f2; border:1px solid #ef4444; color:#991b1b; padding:20px; border-radius:10px; font-family:sans-serif;">
                    <h2 style="margin-top:0;">⚠️ Critical Vitals Detected</h2>
                    <p><strong>Patient:</strong> ${patient.name}</p>
                    <p><strong>Time:</strong> ${timestamp}</p>
                    <hr style="border:0; border-top:1px solid #f87171;">
                    <h3 style="margin-bottom:5px;">${message}</h3>
                    <p>Please take immediate action.</p>
                </div>
            `
        });
        console.log("✅ Worker: Email Sent Successfully!");
    } catch (error) {
        console.error("❌ Worker: Email Failed! CHECK YOUR PASSWORD.", error.message);
    }
}

async function startWorker() {
    try {
        console.log(`🔌 Worker: Connecting to RabbitMQ at ${RABBIT_URL}...`);
        const conn = await amqp.connect(RABBIT_URL);
        const channel = await conn.createChannel();
        await channel.assertQueue('alerts_queue');
        
        console.log("👷 Worker: Online & Waiting for Alerts...");

        channel.consume('alerts_queue', async (msg) => {
            if (msg !== null) {
                const alertData = JSON.parse(msg.content.toString());
                console.log("🔔 Worker: Received Alert:", alertData.message);

                // Save history
                try {
                    await redisClient.lPush('recent_alerts', JSON.stringify(alertData));
                    await redisClient.lTrim('recent_alerts', 0, 99);
                } catch(e) {}

                // Send Email
                await sendAlertEmail(alertData.patientId, alertData.message, alertData.timestamp);
                
                channel.ack(msg);
            }
        });
    } catch (err) {
        console.error("❌ Worker: RabbitMQ Connection Failed (Retrying in 5s)...", err.message);
        setTimeout(startWorker, 5000);
    }
}

startWorker();