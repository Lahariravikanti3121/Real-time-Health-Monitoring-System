const mongoose = require('mongoose');
const url = process.env.MONGO_URL || 'mongodb://localhost:27017/healthDB';

const connectDB = async () => {
  try {
    await mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connect error', err);
    process.exit(1);
  }
};

module.exports = connectDB;
