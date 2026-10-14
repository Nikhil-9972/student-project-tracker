import express from 'express';

const app = express();

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));

// Temporary in-memory storage
const projects = [];
let nextId = 1;

// Allowed project statuses
const validStatuses = ['Planned', 'In Progress', 'Completed'];

// Health-check API
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// GET: Retrieve all projects
app.get('/api/projects', (req, res) => {
  res.status(200).json(projects);
});

// POST: Create a new project
app.post('/api/projects', (req, res) => {
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
  if (
    typeof status !== 'string' ||
    !validStatuses.includes(status)
  ) {
    return res.status(400).json({
      error: 'Status must be Planned, In Progress, or Completed.'
    });
  }

  // Create the project only after validation succeeds
  const project = {
    id: nextId++,
    name: name.trim(),
    status
  };

  projects.push(project);

  // Return HTTP 201 Created
  return res.status(201).json(project);
});

// Start the server
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
