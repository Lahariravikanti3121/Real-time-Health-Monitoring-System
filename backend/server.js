require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const amqp = require('amqplib');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// --- 1. FASTER DB CONNECTION ---
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pulseguard', { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Server: MongoDB Connected');
    } catch (err) {
        console.error('❌ Server: MongoDB Failed. Retrying in 2s...');
        setTimeout(connectDB, 2000); // Retry faster
    }
};
connectDB();

// --- 2. ROBUST RABBITMQ CONNECTION ---
let channel;
async function connectRabbit() {
    try {
        const url = process.env.RABBIT_URL || 'amqp://localhost';
        console.log(`🔌 Server: Attempting RabbitMQ at ${url}...`);
        const conn = await amqp.connect(url);
        channel = await conn.createChannel();
        await channel.assertQueue('alerts_queue');
        console.log('✅ Server: RabbitMQ Connected & Channel Ready');
    } catch (e) {
        console.error('❌ Server: RabbitMQ Not Ready. Retrying in 2s...');
        setTimeout(connectRabbit, 2000); // Retry faster
    }
}
connectRabbit();

// Schemas
const UserSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true }, password: String, role: { type: String, default: 'PATIENT' }, age: Number, gender: String, specialization: String, hospital: String });
const User = mongoose.model('User', UserSchema);

const PatientSchema = new mongoose.Schema({
  userId: String,
  name: String,
  age: Number,
  gender: String,
  status: { type: String, default: 'Stable' },

  currentVitals: {
    bpm: Number,
    spo2: Number,
    temp: Number,
    bpSys: Number,   // ✅ Blood Pressure Systolic (NEW)
    bpDia: Number    // ✅ Blood Pressure Diastolic (NEW)
  },

  history: {
    bpm: [Object],
    spo2: [Object],
    temp: [Object],     // ✅ Temperature History (NEW)
    bpSys: [Object],   // ✅ BP Systolic History (NEW)
    bpDia: [Object]    // ✅ BP Diastolic History (NEW)
  }
});

const Patient = mongoose.model('Patient', PatientSchema);

const AppointmentSchema = new mongoose.Schema({ userId: String, patientName: String, doctorId: String, doctorName: String, date: String, status: { type: String, default: 'Upcoming' }, payment: { amount: Number, method: String, status: String, details: String } });
const Appointment = mongoose.model('Appointment', AppointmentSchema);

const redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.connect().catch(e => {});

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) { const token = authHeader.split(' ')[1]; jwt.verify(token, 'SECRET_KEY', (err, user) => { if (err) return res.sendStatus(403); req.user = user; next(); }); } else { res.sendStatus(401); }
};

// Routes
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password, role, age, gender, specialization, hospital } = req.body;
        if(await User.findOne({ email })) return res.status(400).json({ message: "Email taken" });
        const user = await User.create({ name, email, password, role, age, gender, specialization, hospital });
        if (role === 'PATIENT') 
  await Patient.create({ 
    userId: user._id, 
    name: user.name, 
    age: age || 30, 
    gender: gender || 'Unknown', 
    currentVitals: { 
      bpm: 70, 
      spo2: 98, 
      temp: 36.5,
      bpSys: 120,       // ✅ ADDED
      bpDia: 80         // ✅ ADDED
    }, 
    history: { 
      bpm: [], 
      spo2: [], 
      temp: [],        // ✅ ADDED
      bpSys: [],       // ✅ ADDED
      bpDia: []        // ✅ ADDED
    } 
  });

        res.status(201).json({ message: "Created" });
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.password !== password) return res.status(401).json({ message: "Invalid credentials" });
  const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, 'SECRET_KEY');
  res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
});

app.get('/api/patients', authenticateJWT, async (req, res) => {
    let query = {};
    if (req.user.role === 'PATIENT') query = { userId: req.user.id };
    else if (req.user.role === 'DOCTOR') { const myAppointments = await Appointment.find({ doctorId: req.user.id }); query = { userId: { $in: myAppointments.map(a => a.userId) } }; }
    const patients = await Patient.find(query);
    res.json(patients);
});

app.get('/api/doctors', authenticateJWT, async (req, res) => { res.json(await User.find({ role: 'DOCTOR' }, 'name _id specialization')); });

app.get('/api/appointments', authenticateJWT, async (req, res) => {
    const query = req.user.role === 'DOCTOR' ? { doctorId: req.user.id } : { userId: req.user.id };
    let apps = await Appointment.find(query);
    const now = new Date();
    let updated = false;
    for (let app of apps) { if (new Date(app.date) < now && app.status === 'Upcoming') { app.status = 'Completed'; await app.save(); updated = true; } }
    if(updated) apps = await Appointment.find(query);
    apps.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(apps);
});

app.post('/api/appointments', authenticateJWT, async (req, res) => {
    const { doctorId, doctorName, date, payMethod, payDetails } = req.body;
    let payStatus = payMethod === 'Card' ? 'Paid' : (payMethod === 'EHS' ? 'Insured' : 'Pay on Visit');
    await Appointment.create({ userId: req.user.id, patientName: req.user.name, doctorId, doctorName, date, status: 'Upcoming', payment: { amount: 500, method: payMethod, status: payStatus, details: payDetails } });
    io.emit('appt_update', { doctorId, patientId: req.user.id });
    res.json({ message: "Booked" });
});

app.delete('/api/appointments/:id', authenticateJWT, async (req, res) => {
    const appt = await Appointment.findById(req.params.id);
    if(appt) { await Appointment.findByIdAndDelete(req.params.id); io.emit('appt_update', { doctorId: appt.doctorId, patientId: appt.userId }); res.json({ message: "Deleted" }); } 
    else res.status(404).json({ message: "Not found" });
});

// --- VITALS & ALERTS (Fixed Name Logic) ---
app.post('/api/vitals/:id', async (req, res) => {
  const { bpm, spo2, temp, bpSys, bpDia } = req.body;
  const time = new Date().toLocaleTimeString();

  try {
    const patient = await Patient.findById(req.params.id);
    const patientName = patient ? patient.name : 'Unknown Patient';

    await Patient.findByIdAndUpdate(req.params.id, {
      currentVitals: { bpm, spo2, temp, bpSys, bpDia },

      $push: {
        'history.bpm': { $each: [{ time, value: bpm }], $slice: -20 },
        'history.spo2': { $each: [{ time, value: spo2 }], $slice: -20 },
        'history.temp': { $each: [{ time, value: temp }], $slice: -20 },       // ✅ NEW
        'history.bpSys': { $each: [{ time, value: bpSys }], $slice: -20 },     // ✅ NEW
        'history.bpDia': { $each: [{ time, value: bpDia }], $slice: -20 }      // ✅ NEW
      }
    });

    // ✅ LIVE UPDATE TO FRONTEND
// ✅ LIVE UPDATE TO FRONTEND  (✅ CORRECT FIX)
io.emit('vital_update', {
  id: req.params.id,
  bpm: bpm,
  spo2: spo2,
  temp: temp,
  bpSys: bpSys,
  bpDia: bpDia
});



    // ✅ CRITICAL ALERT LOGIC (FOR ALL)
    if (
      bpm > 110 ||
      spo2 < 92 ||
      temp > 38 ||
      bpSys > 150 ||
      bpDia > 95
    ) {
      const alert = {
        patientId: req.params.id,
        patientName,
        message: `Critical Vitals Detected!`,
        type: 'CRITICAL',
        timestamp: time
      };

      if (channel) {
        channel.sendToQueue('alerts_queue', Buffer.from(JSON.stringify(alert)));
        io.emit('alert_new', alert);
      }
    }

    res.send('ok');
  } catch (e) {
    console.error(e);
    res.status(500).send('error');
  }
});


app.get('/api/search', async (req, res) => { try { const patients = await Patient.find({ name: new RegExp(req.query.q, 'i') }); res.json(patients); } catch (e) { res.json([]); } });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));