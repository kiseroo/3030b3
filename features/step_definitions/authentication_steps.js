const { Given, When, Then, After, Before } = require('@cucumber/cucumber');
const { expect } = require('chai');
const axios = require('axios');
const { spawn } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let server;
let response;
let registrationData;
const baseURL = 'http://localhost:3000';

// Helper function to connect to the database
function getDb() {
  return new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));
}

// Helper function to wait for server to be ready
function waitForServer() {
  return new Promise((resolve) => {
    const checkServer = async () => {
      try {
        await axios.get(baseURL);
        resolve();
      } catch (error) {
        if (error.code !== 'ECONNREFUSED') {
          resolve();
        } else {
          setTimeout(checkServer, 100);
        }
      }
    };
    checkServer();
  });
}

// Before each scenario
Before(async function() {
  // Reset response and registration data
  response = null;
  registrationData = null;
  
  // Kill any existing server
  if (server) {
    try {
      process.kill(server.pid);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for server to fully stop
    } catch (e) {
      // Ignore errors if server is already stopped
    }
    server = null;
  }
});

// Start the server before tests
Given('the server is running', async function() {
  if (!server) {
    console.log('Starting server...');
    server = spawn('node', ['app.js'], { 
      cwd: path.join(__dirname, '../..'),
      detached: false
    });
    
    server.stdout.on('data', (data) => {
      console.log(`Server stdout: ${data}`);
    });
    
    server.stderr.on('data', (data) => {
      console.error(`Server stderr: ${data}`);
    });
    
    // Wait for server to be ready
    await waitForServer();
    console.log('Server is ready');
  }
  return Promise.resolve();
});

When('I register with the following details:', async function(dataTable) {
  const userData = dataTable.hashes()[0];
  registrationData = userData;
  
  console.log('Attempting to register with data:', userData);
  try {
    response = await axios.post(`${baseURL}/register`, userData);
    console.log('Registration response:', response.status, response.data);
  } catch (err) {
    console.log('Registration error:', err.response?.status, err.response?.data);
    response = err.response;
  }
});

Then('I should receive a successful registration message', function() {
  console.log('Checking registration response:', response?.status, response?.data);
  expect(response).to.not.be.undefined;
  expect(response.status).to.equal(201);
  expect(response.data).to.include('User registered successfully');
});

Then('my data should be stored encrypted in the database', function() {
  const db = getDb();
  
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = (SELECT MAX(id) FROM users)', (err, row) => {
      if (err) {
        console.error('Database error:', err);
        reject(err);
      }
      
      console.log('Retrieved user from database:', row ? 'Found' : 'Not found');
      
      // Check that data exists and is encrypted
      expect(row).to.exist;
      expect(row.email).to.include(':'); // Encrypted data contains a colon
      expect(row.email).to.not.equal(registrationData.email); // Not stored as plaintext
      expect(row.address).to.include(':'); // Encrypted data contains a colon
      expect(row.address).to.not.equal(registrationData.address); // Not stored as plaintext
      
      db.close();
      resolve();
    });
  });
});

Given('I have registered with email {string} and password {string}', async function(email, password) {
  const userData = {
    email,
    password,
    father_name: 'Test Father',
    first_name: 'Test User',
    address: 'Test Address',
    phone: Date.now().toString() // Use timestamp to ensure unique phone number
  };
  
  console.log('Pre-registering user:', email);
  try {
    await axios.post(`${baseURL}/register`, userData);
    console.log('Pre-registration successful');
  } catch (err) {
    console.log('Pre-registration error (might already exist):', err.response?.data);
  }
  return Promise.resolve();
});

When('I login with email {string} and password {string}', async function(email, password) {
  console.log('Attempting to login with:', email);
  try {
    response = await axios.post(`${baseURL}/login`, { email, password });
    console.log('Login response:', response.status, response.data);
  } catch (err) {
    console.log('Login error:', err.response?.status, err.response?.data);
    response = err.response;
  }
});

Then('I should be successfully logged in', function() {
  console.log('Checking login response:', response?.status);
  expect(response).to.not.be.undefined;
  expect(response.status).to.equal(200);
});

Then('I should see my decrypted personal information', function() {
  console.log('Checking decrypted data:', response?.data);
  expect(response.data).to.have.property('email');
  expect(response.data).to.have.property('first_name');
  expect(response.data).to.have.property('father_name');
  expect(response.data).to.have.property('address');
  expect(response.data).to.have.property('phone');
});

Then('I should see my address {string} in my profile', function(address) {
  console.log('Checking address:', response?.data?.address);
  expect(response.data.address).to.equal(address);
});

Then('I should see an error message {string}', function(errorMessage) {
  console.log('Checking error message:', response?.status, response?.data);
  expect(response).to.not.be.undefined;
  expect(response.status).to.be.at.least(400);
  expect(response.data).to.equal(errorMessage);
});

// Cleanup after all tests
After(async function() {
  if (server) {
    try {
      process.kill(server.pid);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for server to fully stop
    } catch (e) {
      // Ignore errors if server is already stopped
    }
    server = null;
  }
}); 