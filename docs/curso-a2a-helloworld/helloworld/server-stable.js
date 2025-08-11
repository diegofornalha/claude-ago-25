/**
 * Stable A2A Server for helloworld - Port 9998
 * Production-ready implementation with error handling
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
app.use(bodyParser.urlencoded({ extended: true }));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/discover', async (req, res) => {
  try {
    const result = await agent.discover();
    res.json(result);
  } catch (error) {
    console.error('Discover error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/communicate', async (req, res) => {
  try {
    const result = await agent.communicate(req.body);
    res.json(result);
  } catch (error) {
    console.error('Communicate error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/delegate', async (req, res) => {
  try {
    const result = await agent.delegate(req.body);
    res.json(result);
  } catch (error) {
    console.error('Delegate error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', async (req, res) => {
  try {
    const result = await agent.health();
    res.json(result);
  } catch (error) {
    console.error('Health error:', error);
    res.status(503).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Helloworld A2A Server',
    version: '1.0.0',
    port: port,
    status: 'running',
    endpoints: [
      'GET /discover - Discover agent capabilities',
      'POST /communicate - Send message to agent',
      'POST /delegate - Delegate task to agent',
      'GET /health - Check agent health'
    ],
    timestamp: new Date().toISOString()
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.path} not found`,
    available_endpoints: ['/', '/discover', '/communicate', '/delegate', '/health']
  });
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log(`🚀 Helloworld A2A Server`);
  console.log(`📍 Running on: http://localhost:${port}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Keep the server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Keep the server running
});