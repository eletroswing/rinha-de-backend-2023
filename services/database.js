const { Pool } = require('pg');
require("dotenv").config();

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
  min: 8, max: 8 
});

pool.once('connect', () => {
    return pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            apelido VARCHAR(32) UNIQUE NOT NULL,
            nome VARCHAR(100) NOT NULL,
            nascimento DATE NOT NULL,
            stack VARCHAR(32)[]
        );
    
        CREATE INDEX IF NOT EXISTS term_search_index_apelido ON users
            USING gin(to_tsvector('english', apelido));
          
        CREATE INDEX IF NOT EXISTS term_search_index_nome ON users
            USING gin(to_tsvector('english', nome));
        `)
});

module.exports = pool;