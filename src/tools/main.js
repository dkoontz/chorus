#!/usr/bin/env node
// Wrapper to run compiled Gren Node applications

// Load the compiled Gren application
const app = require('./build/file-tools.js');

// Initialize the application
app.Gren.Main.init({});
