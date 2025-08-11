/**
 * Simple A2A Server for helloworld
 * Standalone implementation without BaseA2AServer dependencies
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const HelloworldAgent = require('./agents/helloworld_agent');

const app = express();
const port = process.env.A2A_PORT || 9998;
const agent = new HelloworldAgent();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.get('/discover', async (req, res) => {
  const result = await agent.discover();
  res.json(result);
});

app.post('/communicate', async (req, res) => {
  try {
    const result = await agent.communicate(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/delegate', async (req, res) => {
  try {
    const result = await agent.delegate(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', async (req, res) => {
  const result = await agent.health();
  res.json(result);
});

app.get('/', (req, res) => {
  res.json({
    message: 'Helloworld A2A Server',
    version: '1.0.0',
    endpoints: [
      'GET /discover',
      'POST /communicate',
      'POST /delegate',
      'GET /health'
    ]
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Helloworld A2A Server running on port ${port}`);
  console.log(`📍 http://localhost:${port}`);
});