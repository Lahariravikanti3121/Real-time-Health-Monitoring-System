const router = require('express').Router();
const Appointment = require('../models/Appointment');

router.post('/create', async (req,res)=>{
  try{
    const appt = new Appointment(req.body);
    await appt.save();
    res.json({ message: 'Appointment requested' });
  }catch(e){ res.status(500).json({ error:'server' }); }
});

router.get('/doctor/:id', async (req,res)=>{
  try{
    const list = await Appointment.find({ doctorId: req.params.id }).populate('patientId');
    res.json(list);
  }catch(e){ res.status(500).json({ error:'server' }); }
});

module.exports = router;
