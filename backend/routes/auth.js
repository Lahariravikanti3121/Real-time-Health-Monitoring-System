const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/signup', async (req, res) => {
  try {
    console.log("SIGNUP BODY RECEIVED:", req.body);


    const { name, email, password, role, city } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already used' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed, role, city });
    await user.save();

    res.json({ message: 'Signup successful' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret123');
    res.json({ token, role: user.role, userId: user._id });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/doctors', async (req,res)=>{
  const docs = await User.find({ role:'doctor' }, 'name city');
  res.json(docs);
});

module.exports = router;
