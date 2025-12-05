require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointment');

const app = express();
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('WS client connected:', socket.id);
  socket.on('disconnect', () => console.log('WS disconnected', socket.id));
});

app.use(cors());
app.use(express.json());

connectDB();

app.use('/auth', authRoutes);
app.use('/health', require('./routes/health')(io));
app.use('/appointment', appointmentRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
