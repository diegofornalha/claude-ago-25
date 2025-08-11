/**
 * A2A Server for helloworld
 * Refactored to use BaseA2AServer - eliminates code duplication
 */

const BaseA2AServer = require('../BaseA2AServer');
const HelloworldAgent = require('./agents/helloworld_agent');

class A2AServer extends BaseA2AServer {
  constructor() {
    const port = process.env.A2A_PORT || 8160;
    const config = {
      port: port,
      agentClass: HelloworldAgent,
      agentName: 'Helloworld Agent',
      basePath: __dirname,
      agentCardPath: '.well-known/agent.json'
    };
    
    super(config);
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new A2AServer();
  server.start();
}

module.exports = A2AServer;