import express from 'express';
import { db } from './database.js';

const app = express();

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));

// Allowed project statuses
const validStatuses = ['Planned', 'In Progress', 'Completed'];

// Health-check API
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// GET: Retrieve all projects from SQLite
app.get('/api/projects', async (req, res, next) => {
  try {
    const projects = await db.list();
    return res.status(200).json(projects);
  } catch (error) {
    return next(error);
  }
});

// POST: Validate and create a project in SQLite
app.post('/api/projects', async (req, res, next) => {
  const { name, status } = req.body ?? {};

  // Validate project name
  if (
    typeof name !== 'string' ||
    name.trim() === '' ||
    name.trim().length > 80
  ) {
    return res.status(400).json({
      error: 'Name must be nonblank and no longer than 80 characters.'
    });
  }

  // Validate project status
  if (typeof status !== 'string' || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Status must be Planned, In Progress, or Completed.'
    });
  }

  try {
    const project = await db.create({ name: name.trim(), status });
    return res.status(201).json(project);
  } catch (error) {
    return next(error);
  }
});

// Return JSON for unexpected server/database errors.
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Internal server error.' });
});

// Start the server
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
