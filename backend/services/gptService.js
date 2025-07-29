/**
 * GPT API Call
 */
console.log('=== LOADING gptService.js ===');
console.log('File loaded at:', new Date().toISOString());

const OpenAI = require('openai');

let openai = null;

const getOpenAIClient = () => {
  console.log('=== GETTING OPENAI CLIENT ===');
  
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is missing');
    }
    
    console.log('Creating new OpenAI client...');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('OpenAI client created successfully');
  }
  
  return openai;
};

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Core API call function
const makeOpenAICall = async (prompt, attemptNumber) => {
  console.log(`Making OpenAI API call - attempt ${attemptNumber}`);
  
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: "gpt-4o",
    tools: [{ type: "web_search" }],
    input: prompt,
    temperature: attemptNumber > 1 ? 0.3 : 0,
  });
  
  return response?.output_text ?? "";
};

// Main function with retry logic
const getCarRecommendationsWebSearch = async (zipcode, quizData, options = {}) => {
  console.log('=== FUNCTION CALLED WITH RETRY LOGIC ===');
  console.log('Parameters received:');
  console.log('zipcode:', zipcode);
  console.log('quizData type:', typeof quizData);
  
  // Extract retry options
  const maxRetries = options.maxRetries || 3;
  const minRecommendations = options.minRecommendations || 2;
  const retryDelay = options.retryDelay || 2000;
  
  console.log(`Retry config: maxRetries=${maxRetries}, minRecommendations=${minRecommendations}`);
  
  if (!quizData) {
    throw new Error('quizData is null or undefined');
  }
  
  console.log('=== QUIZ DATA DEBUG ===');
  console.log('car_make:', quizData.car_make, '(type:', typeof quizData.car_make, ')');
  console.log('body_type:', quizData.body_type, '(type:', typeof quizData.body_type, 'isArray:', Array.isArray(quizData.body_type), ')');
  console.log('powertrain:', quizData.powertrain, '(type:', typeof quizData.powertrain, 'isArray:', Array.isArray(quizData.powertrain), ')');
  
  // Extract data safely
  const carMake = quizData.car_make || quizData.car_make_other || 'any make';
  const bodyTypes = Array.isArray(quizData.body_type) ? quizData.body_type.join(', ') : (quizData.body_type || 'any body type');
  const powertrainTypes = Array.isArray(quizData.powertrain) ? quizData.powertrain.join(', ') : (quizData.powertrain || 'Not specified');
  
  console.log('Processed values:');
  console.log('- carMake:', carMake);
  console.log('- bodyTypes:', bodyTypes);
  console.log('- powertrainTypes:', powertrainTypes);
  
  // Build prompt
  const basePrompt = `
You are a professional car leasing consultant with live web search access on official/franchised dealerships only.

Your task is to find up to 10 active lease offers for a ${carMake} that is a ${bodyTypes} ONLY in the ${zipcode} area (within 10 miles).

User Preferences:
- Make: ${carMake}
- Category: ${bodyTypes}. ONLY include cars in this category.
- Powertrain: ${powertrainTypes}. ONLY include the powertrain cars that the user prefers.
- Zip Code: ${zipcode} (Search radius: 10 miles)

Listing Requirements:
- Only return listings from authorized franchised dealerships or official manufacturer websites
- Examples: BMW of Bayside, Toyota of Manhattan, Ford.com, Lexus.com
- Prohibited: Lease brokers, aggregators, classifieds (VIP Auto, Cars.com, Craigslist, etc.)

CRITICAL FILTERING REQUIREMENTS:
- UNIQUE MODELS ONLY: Do not include multiple listings of the same model. For example, if you find "BMW X3 xDrive30i", include it only ONCE, even if multiple dealerships offer it. Choose the best available offer for each unique model.
- MSRP REQUIRED: Only include cars where the MSRP is available and specified. Do NOT include any listings where MSRP is "Not specified", "TBD", "Call for pricing", or similar. Every car must have a valid numerical MSRP value.

Response format (JSON only):
{
  "recommendations": [
    {
      "rank": 1,
      "make": "BMW",
      "model": "X3 xDrive30i",
      "year": 2025,
      "trim": "xDrive30i",
      "category": "SUV",
      "msrp": "55890",
      "residual": "58%",
      "money_factor": "0.00190",
      "monthly_payment": 599,
      "down_payment": 5589,
      "lease_months": 39,
      "lease_miles_per_year": 10000,
      "source": "BMW of Bayside"
    }
  ]
}`;

  // Retry loop
  let attempts = [];
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`\n--- ATTEMPT ${attempt}/${maxRetries + 1} ---`);
      
      // Add urgency text for retries
      const urgencyText = attempt > 1 ? 
        `\n\nIMPORTANT: This is attempt #${attempt}. Please conduct a more thorough search and return at least 3-5 different car recommendations if available.` : '';
      
      const fullPrompt = basePrompt + urgencyText;
      
      // Make API call
      const content = await makeOpenAICall(fullPrompt, attempt);
      console.log(`Attempt ${attempt} response length:`, content.length);
      
      // Parse JSON response
      const jsonMatch = content?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const recommendationCount = parsed?.recommendations?.length || 0;
        
        console.log(`Attempt ${attempt}: Found ${recommendationCount} recommendations`);
        
        attempts.push({
          attempt,
          count: recommendationCount,
          data: parsed,
          content
        });

        // Check if we have enough recommendations
        if (recommendationCount >= minRecommendations) {
          console.log(`SUCCESS: Got ${recommendationCount} recommendations on attempt ${attempt}`);
          return {
            success: true,
            data: parsed,
            raw_response: content,
            attempts: attempt,
            all_attempts: attempts
          };
        }
        
        // If this is our last attempt, return what we have
        if (attempt === maxRetries + 1) {
          console.log(`FINAL ATTEMPT: Returning ${recommendationCount} recommendations`);
          return {
            success: true,
            data: parsed,
            raw_response: content,
            attempts: attempt,
            warning: `Only found ${recommendationCount} recommendations after ${attempt} attempts`,
            all_attempts: attempts
          };
        }
        
        // Wait before retrying
        console.log(`Insufficient recommendations (${recommendationCount}/${minRecommendations}). Retrying in ${retryDelay}ms...`);
        await delay(retryDelay);
        
      } else {
        console.log(`Attempt ${attempt}: No valid JSON found in response`);
        attempts.push({
          attempt,
          count: 0,
          data: null,
          content,
          error: 'No valid JSON in response'
        });
        
        if (attempt < maxRetries + 1) {
          console.log(`No valid response. Retrying in ${retryDelay}ms...`);
          await delay(retryDelay);
        }
      }
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      attempts.push({
        attempt,
        count: 0,
        data: null,
        content: null,
        error: error.message
      });
      
      // If this is our last attempt, throw the error
      if (attempt === maxRetries + 1) {
        throw error;
      }
      
      // Wait before retrying
      console.log(`Error on attempt ${attempt}. Retrying in ${retryDelay}ms...`);
      await delay(retryDelay);
    }
  }

  throw new Error('All retry attempts failed');
};

module.exports = {
  getCarRecommendationsWebSearch
};
