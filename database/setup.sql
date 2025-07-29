-- Car Lease App Database Setup
-- Run this in PostgreSQL to create all tables

-- Create customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create current_deals table
CREATE TABLE current_deals (
    id SERIAL PRIMARY KEY,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    trim VARCHAR(50),
    category VARCHAR(30) NOT NULL,
    estimated_monthly_payment DECIMAL(8,2),
    estimated_down_payment DECIMAL(8,2),
    msrp DECIMAL(10,2),
    region VARCHAR(50) DEFAULT 'NYC',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create leads table
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    customer_preferences TEXT,
    max_monthly_budget DECIMAL(8,2),
    available_down_payment DECIMAL(8,2),
    preferred_category VARCHAR(30),
    knows_car_type BOOLEAN DEFAULT false,
    gpt_conversation_log TEXT,
    employment_status VARCHAR(50),
    annual_income DECIMAL(10,2),
    credit_score INTEGER,
    credit_report_file VARCHAR(255),
    qualification_status VARCHAR(20) DEFAULT 'PENDING',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create lead_selected_deals table (junction table)
CREATE TABLE lead_selected_deals (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    deal_id INTEGER REFERENCES current_deals(id),
    priority_rank INTEGER,
    customer_notes TEXT,
    dealership_quote DECIMAL(8,2),
    dealership_name VARCHAR(100),
    dealership_contact VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create applications table
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    final_selected_deal_id INTEGER REFERENCES lead_selected_deals(id),
    ssn_encrypted VARCHAR(255),
    drivers_license VARCHAR(100),
    employment_details TEXT,
    financial_details TEXT,
    bank_approval_status VARCHAR(20) DEFAULT 'PENDING',
    approved_amount DECIMAL(10,2),
    final_dealership_info TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP
);

-- Create status_updates table
CREATE TABLE status_updates (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    status VARCHAR(50) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_users table
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create gpt_interactions table
CREATE TABLE gpt_interactions (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    user_message TEXT,
    gpt_response TEXT,
    interaction_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some sample current deals for testing
INSERT INTO current_deals (make, model, year, trim, category, estimated_monthly_payment, estimated_down_payment, msrp) VALUES
('BMW', '330i', 2024, 'Base', 'sedan', 599.00, 3000.00, 45000.00),
('Toyota', 'RAV4', 2024, 'LE', 'suv', 450.00, 2500.00, 35000.00),
('Ford', 'F-150', 2024, 'XLT', 'pickup', 525.00, 3500.00, 42000.00),
('Honda', 'Civic', 2024, 'LX', 'sedan', 320.00, 2000.00, 25000.00),
('Jeep', 'Grand Cherokee', 2024, 'Laredo', 'suv', 480.00, 3000.00, 38000.00),
('Tesla', 'Model 3', 2024, 'Standard', 'sedan', 650.00, 4000.00, 47000.00);

-- Create an admin user (password: 'admin123' - change this!)
INSERT INTO admin_users (email, password_hash) VALUES 
('admin@carlease.com', '$2a$10$XYZ123HASHEDPASSWORD');