export const INITIAL_USERS = [
    {
        id: 'd1', 
        email: 'doctor@hospital.com',
        password: 'password',
        name: 'Dr. Sarah Connor',
        role: 'DOCTOR'
    },
    {
        id: 'p1',
        email: 'naomi@patient.com',
        password: 'password',
        name: 'Naomi Vring',
        role: 'PATIENT'
    }
];

export const INITIAL_PATIENTS = [
  {
    id: 'p1',
    name: 'Naomi Vring',
    age: 34,
    gender: 'Female',
    status: 'Stable',
    avatar: 'https://ui-avatars.com/api/?name=Naomi+Vring',
    currentVitals: { bpm: 72, spo2: 98, temp: 36.6, bpSystolic: 120, bpDiastolic: 80 },
    history: { bpm: [], spo2: [] },
    medicalRecords: []
  },
  {
    id: 'p2',
    name: 'Marcus Chen',
    age: 58,
    gender: 'Male',
    status: 'Critical',
    avatar: 'https://ui-avatars.com/api/?name=Marcus+Chen',
    currentVitals: { bpm: 110, spo2: 92, temp: 38.1, bpSystolic: 145, bpDiastolic: 95 },
    history: { bpm: [], spo2: [] },
    medicalRecords: []
  }
];

INITIAL_PATIENTS.forEach(p => {
  const now = new Date();
  for (let i = 20; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 1000).toLocaleTimeString([], { hour12: false });
    p.history.bpm.push({ time, value: p.currentVitals.bpm + (Math.random() * 4 - 2) });
    p.history.spo2.push({ time, value: p.currentVitals.spo2 + (Math.random() * 1 - 0.5) });
  }
});

export const AVAILABLE_DOCTORS = [
    {
        id: 'd1',
        name: 'Dr. Sarah Connor',
        specialization: 'Cardiologist',
        hospital: 'City General Hospital',
        distance: '0.8 miles',
        rating: 4.9,
        avatar: 'https://ui-avatars.com/api/?name=Sarah+Connor'
    },
    {
        id: 'd2',
        name: 'Dr. John Watson',
        specialization: 'General Physician',
        hospital: 'Baker St. Clinic',
        distance: '1.2 miles',
        rating: 4.7,
        avatar: 'https://ui-avatars.com/api/?name=John+Watson'
    }
];

export const INITIAL_ALERTS = [
  {
    id: 'a1',
    patientId: 'p2',
    patientName: 'Marcus Chen',
    message: 'Elevated Heart Rate (>105 BPM)',
    timestamp: '10:42:05',
    type: 'CRITICAL'
  }
];

export const INITIAL_APPOINTMENTS = [];