const { Pool } = require('pg');
const redis = require('redis');
const { promisify } = require('util');
require("dotenv").config();

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
  min: 8, max: 8 
});

module.exports = pool;