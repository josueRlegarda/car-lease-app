const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { getCarRecommendationsWebSearch, getCarRecommendations } = require('./services/gptService');
const { analyzeRecommendations } = require('./services/analysisService');
// REMOVED: const { createAllTables } = require('../frontend/src/components/graphRecommendations');

// Load environment variables
dotenv.config();

// Debug
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('Current working directory:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('OpenAI API Key first 10 characters:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'NOT FOUND');
console.log('All env vars starting with OPENAI:', Object.keys(process.env).filter(key => key.startsWith('OPENAI')));
console.log('=====================================');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'your_username',  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'car_lease_app',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://car-lease-frontend.onrender.com'
  ]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'Car Lease App API is running!' });
});

// Get all current deals
app.get('/api/deals', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM current_deals WHERE active = true ORDER BY category, make, model');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get deals by category
app.get('/api/deals/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const result = await pool.query(
      'SELECT * FROM current_deals WHERE category = $1 AND active = true ORDER BY make, model',
      [category]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new customer
app.post('/api/customers', async (req, res) => {
  try {
    const { email, first_name, last_name, phone } = req.body;
    
    // Check if customer already exists
    const existingCustomer = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);
    
    if (existingCustomer.rows.length > 0) {
      return res.json(existingCustomer.rows[0]);
    }
    
    // Create new customer
    const result = await pool.query(
      'INSERT INTO customers (email, first_name, last_name, phone) VALUES ($1, $2, $3, $4) RETURNING *',
      [email, first_name, last_name, phone]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

//GPT Integration + GPT Analysis
app.post('/api/generate-recommendations', async (req, res) => {
  try {
    const { quiz_data } = req.body;
    
    if (!quiz_data) {
      return res.status(400).json({ error: 'Quiz data is required' });
    }

    console.log('Getting GPT recommendations with retry logic...');
    
    // Use the retry logic with custom options
    const searchResult = await getCarRecommendationsWebSearch(quiz_data.zipcode, quiz_data, {
      maxRetries: 3,
      minRecommendations: 2,
      retryDelay: 2000,
      exponentialBackoff: true
    });

    if (searchResult.success) {
      console.log(`Got ${searchResult.data?.recommendations?.length || 0} recommendations after ${searchResult.attempts} attempts`);
      console.log('Running analysis on GPT response...');
      
      const analysisResult = await analyzeRecommendations(searchResult.data, quiz_data);
      
      if (analysisResult.success) {
        // REMOVED: console.log('Generating payment tables...');
        // REMOVED: const tablesData = createAllTables(analysisResult.paymentCalculations);
        
        res.json({
          success: true,
          gpt_recommendations: searchResult.data,
          analysis_result: analysisResult,
          // REMOVED: payment_tables: tablesData,
          attempts: searchResult.attempts,
          message: 'Recommendations and analysis completed successfully'
        });
      } else {
        res.json({
          success: true,
          gpt_recommendations: searchResult.data,
          analysis_error: analysisResult.error,
          attempts: searchResult.attempts,
          message: 'Recommendations generated, but analysis failed'
        });
      }
    } else {
      res.status(500).json({
        success: false,
        fallback_recommendations: searchResult.fallback_data,
        error: searchResult.error,
        attempts: searchResult.attempts,
        message: 'Using fallback recommendations due to Web Search GPT API issue'
      });
    }

  } catch (error) {
    console.error('Recommendation generation error:', error);
    res.status(500).json({
      error: 'Failed to generate recommendations',
      message: 'Please try again or contact support'
    });
  }
});

// Create a new lead
app.post('/api/leads', async (req, res) => {
  try {
    const {
      customer_id,
      customer_preferences,
      max_monthly_budget,
      available_down_payment,
      preferred_category,
      knows_car_type,
      selected_deals
    } = req.body;
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert lead
      const leadResult = await client.query(
        `INSERT INTO leads (customer_id, customer_preferences, max_monthly_budget, 
         available_down_payment, preferred_category, knows_car_type, qualification_status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *`,
        [customer_id, customer_preferences, max_monthly_budget, available_down_payment, preferred_category, knows_car_type]
      );
      
      const lead = leadResult.rows[0];
      
      // Insert selected deals
      if (selected_deals && selected_deals.length > 0) {
        for (let i = 0; i < selected_deals.length; i++) {
          const deal = selected_deals[i];
          await client.query(
            `INSERT INTO lead_selected_deals (lead_id, deal_id, priority_rank, customer_notes) 
             VALUES ($1, $2, $3, $4)`,
            [lead.id, deal.deal_id, deal.priority_rank, deal.customer_notes]
          );
        }
      }
      
      await client.query('COMMIT');
      res.status(201).json(lead);
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all leads for admin
app.get('/api/admin/leads', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        l.*,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        COUNT(lsd.id) as selected_deals_count
      FROM leads l
      JOIN customers c ON l.customer_id = c.id
      LEFT JOIN lead_selected_deals lsd ON l.id = lsd.lead_id
      GROUP BY l.id, c.id
      ORDER BY l.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get lead details with selected deals
app.get('/api/admin/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get lead with customer info
    const leadResult = await pool.query(`
      SELECT 
        l.*,
        c.first_name,
        c.last_name,
        c.email,
        c.phone
      FROM leads l
      JOIN customers c ON l.customer_id = c.id
      WHERE l.id = $1
    `, [id]);
    
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Get selected deals
    const dealsResult = await pool.query(`
      SELECT 
        lsd.*,
        cd.make,
        cd.model,
        cd.year,
        cd.category,
        cd.estimated_monthly_payment,
        cd.estimated_down_payment
      FROM lead_selected_deals lsd
      JOIN current_deals cd ON lsd.deal_id = cd.id
      WHERE lsd.lead_id = $1
      ORDER BY lsd.priority_rank
    `, [id]);
    
    const lead = leadResult.rows[0];
    lead.selected_deals = dealsResult.rows;
    
    res.json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, pool };
