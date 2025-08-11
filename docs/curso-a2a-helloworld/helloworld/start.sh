#!/bin/bash

# Set the port to 9998
export A2A_PORT=9998

# Navigate to the directory
cd "$(dirname "$0")"

# Start the server
echo "Starting Helloworld A2A Server on port 9998..."
node a2a-server.js