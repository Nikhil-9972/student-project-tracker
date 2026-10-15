import express from 'express';
import { db } from './database.js';

const app = express();

const validStatuses = [
  'Planned',
  'In Progress',
  'Completed'
];

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true });
});

// GET: Return every project
app.get('/api/projects', async (req, res, next) => {
  try {
    const projects = await db.list();

    return res.status(200).json(projects);
  } catch (error) {
    return next(error);
  }
});

// POST: Create a project
app.post('/api/projects', async (req, res, next) => {
  const { name, status } = req.body ?? {};

  if (
    typeof name !== 'string' ||
    name.trim() === '' ||
    name.trim().length > 80
  ) {
    return res.status(400).json({
      error: 'Name must be nonblank and no longer than 80 characters.'
    });
  }

  if (
    typeof status !== 'string' ||
    !validStatuses.includes(status)
  ) {
    return res.status(400).json({
      error: 'Status must be Planned, In Progress, or Completed.'
    });
  }

  try {
    const project = await db.create({
      name: name.trim(),
      status
    });

    return res.status(201).json(project);
  } catch (error) {
    return next(error);
  }
});

// PUT: Update an existing project
app.put('/api/projects/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const { name, status } = req.body ?? {};

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      error: 'Project ID must be a positive integer.'
    });
  }

  if (
    typeof name !== 'string' ||
    name.trim() === '' ||
    name.trim().length > 80
  ) {
    return res.status(400).json({
      error: 'Name must be nonblank and no longer than 80 characters.'
    });
  }

  if (
    typeof status !== 'string' ||
    !validStatuses.includes(status)
  ) {
    return res.status(400).json({
      error: 'Status must be Planned, In Progress, or Completed.'
    });
  }

  try {
    const project = await db.update(id, {
      name: name.trim(),
      status
    });

    if (!project) {
      return res.status(404).json({
        error: 'Project not found.'
      });
    }

    return res.status(200).json(project);
  } catch (error) {
    return next(error);
  }
});

// DELETE: Remove a project
app.delete('/api/projects/:id', async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      error: 'Project ID must be a positive integer.'
    });
  }

  try {
    const deleted = await db.remove(id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Project not found.'
      });
    }

    return res.status(200).json({
      ok: true,
      id
    });
  } catch (error) {
    return next(error);
  }
});

// Handle invalid JSON and unexpected errors.
// This must remain after the routes.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  // express.json() marks malformed JSON with this error type.
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON request body.'
    });
  }

  console.error(error);

  return res.status(500).json({
    error: 'Internal server error.'
  });
});

// Start the server
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
