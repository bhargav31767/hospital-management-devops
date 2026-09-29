const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'hms_user',
  password: process.env.DB_PASSWORD || 'hms_password',
  database: process.env.DB_NAME || 'hospital_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool = null;
let isDbConnected = false;

// Connect to MySQL with retry logic for container environments
async function initDatabase() {
  const maxRetries = 15;
  const retryIntervalMs = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DB] Attempting connection to MySQL at ${dbConfig.host}:${dbConfig.port} (Attempt ${attempt}/${maxRetries})...`);
      pool = mysql.createPool(dbConfig);

      // Verify connection
      const connection = await pool.getConnection();
      console.log('[DB] Connected successfully to MySQL.');
      connection.release();

      // Initialize database tables if not existing
      await createTables();
      isDbConnected = true;
      return;
    } catch (err) {
      console.error(`[DB] Connection failed: ${err.message}`);
      if (attempt === maxRetries) {
        console.error('[DB] Max retries reached. Backend running in degraded state.');
      } else {
        await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
      }
    }
  }
}

async function createTables() {
  const createPatients = `
    CREATE TABLE IF NOT EXISTS patients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      age INT NOT NULL,
      gender VARCHAR(20) NOT NULL,
      diagnosis VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createDoctors = `
    CREATE TABLE IF NOT EXISTS doctors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      specialization VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createAppointments = `
    CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      doctor_id INT NOT NULL,
      appointment_date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'Scheduled',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    );
  `;

  await pool.query(createPatients);
  await pool.query(createDoctors);
  await pool.query(createAppointments);

  // Check if seed data needed
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM doctors');
  if (rows[0].count === 0) {
    await pool.query(`
      INSERT INTO doctors (name, specialization, email) VALUES
      ('Dr. Sarah Connor', 'Cardiology', 's.connor@hospital.org'),
      ('Dr. James Wilson', 'Neurology', 'j.wilson@hospital.org'),
      ('Dr. Emily Vance', 'Pediatrics', 'e.vance@hospital.org')
    `);

    await pool.query(`
      INSERT INTO patients (name, age, gender, diagnosis) VALUES
      ('John Doe', 45, 'Male', 'Hypertension'),
      ('Jane Smith', 32, 'Female', 'Migraine'),
      ('Alice Johnson', 28, 'Female', 'Asthma')
    `);

    await pool.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, status) VALUES
      (1, 1, CURDATE(), 'Confirmed'),
      (2, 2, CURDATE(), 'Scheduled'),
      (3, 3, CURDATE(), 'Completed')
    `);
    console.log('[DB] Seed data inserted successfully.');
  }
}

// Probes & Health check endpoint
app.get('/health', (req, res) => {
  const status = {
    status: isDbConnected ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
    uptime: process.uptime(),
  };

  if (!isDbConnected) {
    return res.status(503).json(status);
  }
  return res.status(200).json(status);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Hospital Management System API is running' });
});

// API Routes
app.get('/api/stats', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database unavailable' });
    const [[{ count: patients }]] = await pool.query('SELECT COUNT(*) AS count FROM patients');
    const [[{ count: doctors }]] = await pool.query('SELECT COUNT(*) AS count FROM doctors');
    const [[{ count: appointments }]] = await pool.query('SELECT COUNT(*) AS count FROM appointments');
    res.json({ patients, doctors, appointments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database unavailable' });
    const [rows] = await pool.query('SELECT * FROM patients ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const { name, age, gender, diagnosis } = req.body;
    if (!name || !age || !gender || !diagnosis) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const [result] = await pool.query(
      'INSERT INTO patients (name, age, gender, diagnosis) VALUES (?, ?, ?, ?)',
      [name, parseInt(age, 10), gender, diagnosis]
    );
    res.status(201).json({ id: result.insertId, name, age, gender, diagnosis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/doctors', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database unavailable' });
    const [rows] = await pool.query('SELECT * FROM doctors ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/doctors', async (req, res) => {
  try {
    const { name, specialization, email } = req.body;
    if (!name || !specialization || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const [result] = await pool.query(
      'INSERT INTO doctors (name, specialization, email) VALUES (?, ?, ?)',
      [name, specialization, email]
    );
    res.status(201).json({ id: result.insertId, name, specialization, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database unavailable' });
    const query = `
      SELECT 
        a.id, 
        p.name AS patient_name, 
        d.name AS doctor_name, 
        d.specialization,
        DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date, 
        a.status
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      ORDER BY a.id DESC;
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { patient_id, doctor_id, appointment_date, status } = req.body;
    if (!patient_id || !doctor_id || !appointment_date) {
      return res.status(400).json({ error: 'Missing required appointment fields' });
    }
    const [result] = await pool.query(
      'INSERT INTO appointments (patient_id, doctor_id, appointment_date, status) VALUES (?, ?, ?, ?)',
      [patient_id, doctor_id, appointment_date, status || 'Scheduled']
    );
    res.status(201).json({ id: result.insertId, patient_id, doctor_id, appointment_date, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`[SERVER] Hospital Management Backend running on port ${PORT}`);
  initDatabase();
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('[SERVER] SIGTERM received. Closing HTTP server and database pool...');
  server.close(async () => {
    if (pool) await pool.end();
    console.log('[SERVER] Process terminated gracefully.');
    process.exit(0);
  });
});
