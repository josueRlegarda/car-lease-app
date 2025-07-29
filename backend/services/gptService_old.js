const OpenAI = require('openai');

let openai = null;

const getOpenAIClient = () => {
  console.log('=== GETTING OPENAI CLIENT ===');
  console.log('Current openai client:', openai);
  console.log('Environment API key exists:', !!process.env.OPENAI_API_KEY);
  console.log('API key first 10 chars:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'NOT FOUND');
  
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is missing');
    }
    
    console.log('Creating new OpenAI client...');
    try {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log('OpenAI client created successfully');
    } catch (error) {
      console.error('Error creating OpenAI client:', error);
      throw error;
    }
  }
  
  console.log('Returning OpenAI client:', !!openai);
  return openai;
};

const today = new Date();
const formattedDate = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`;

// Helper function to build intelligent prompts based on quiz
const buildCarRecommendationPrompt = (quizData) => {
  const { 
    first_name,
    zipcode,
    q1_primary_usage,
    q1_primary_usage_other,
    q1_known_exact_make,
    q1_known_exact_make_other,
    q2_car_type,
    q2_known_exact_car_type,
    q3_car_make,
    q3_car_make_other,
    q4_car_features,
    q4_car_features_other,
    q5_car_drivetrain,
    q6_leaseterm,
    q6_known_exact_leaseterm,
    q7_leasemiles,
    q7_known_exact_leasemiles,
    yearly_income,
    lease_budget_min,
    lease_budget_max,
    dp_budget,
    car_interest_level
  } = quizData;

  let prompt = 
    `You are an expert car leasing consultant with access to realistic dealership lease data as of ${formattedDate}.
    Your job is to recommend car lease offers that would realistically be available at authorized franchised dealership in or near the ${zipcode} area.

    You MUST follow these rules:
    - ONLY suggest lease offers that are active as of ${formattedDate} (do NOT use expired or outdated deals).
    - DO NOT use third-party lease brokers (e.g. VIP Auto, LeaseHackr, eAutoLease).
    - Only include MY24 or MY25 models with active lease programs.
    - NEVER fabricate or guess lease deals — base recommendations on typical mid-2025 pricing patterns.
    - If unsure, state your uncertainty and prioritize vehicles with known strong lease support.
    - Use real-world MSRP values from brand configurators when possible.
    - Recommend the best value options first.

    Customer Profile:
    - Name:${first_name}
    - Zipcode: ${zipcode}
    - Monthly Budget: $${lease_budget_min} - $${lease_budget_max}
    - Total Due at Signing Budget: $${dp_budget}

    Usage Profile:
    - Primary Usage: ${quizData.q1_primary_usage?.join(', ') || 'Not specified'}
    `;

  // Add specific preferences based on their knowledge level
  if (car_interest_level === 'need_help' || car_interest_level === 'have_idea') {
    prompt += `Vehicle Preferences:
    - Vehicle Types: ${quizData.q2_car_type?.join(', ') || 'Not specified'}
    - Preferred Brands: ${quizData.q3_car_make?.join(', ') || 'Not specified'}
    - Important Features: ${quizData.q4_car_features?.join(', ') || 'Not specified'}
    - Drivetrain: ${quizData.q5_car_drivetrain?.join(', ') || 'Not specified'}
    - Lease Term: ${quizData.q6_leaseterm?.join(', ') || 'Not specified'}
    - Annual Mileage: ${quizData.q7_leasemiles || 'Not specified'}
    `;
    } else {
        prompt += `Specific Preferences:
    - Specific Make: ${quizData.q1_known_exact_make?.join(', ') || 'Not specified'}
    - Specific Vehicle Types: ${quizData.q2_known_exact_car_type?.join(', ') || 'Not specified'}
    - Lease Term: ${quizData.q6_known_exact_leaseterm?.join(', ') || 'Not specified'}
    - Annual Mileage: ${quizData.q7_known_exact_leasemiles || 'Not specified'}
    `;
    }

  // Add additional context if provided
  if (quizData.q1_primary_usage_other) {
    prompt += `\nAdd Usage Notes: ${quizData.q1_primary_usage_other}`;
  }
  if (quizData.q1_known_exact_make_other) {
    prompt += `\nOther Makes (know_exact): ${quizData.q1_known_exact_make_other}`;
  }
  if (quizData.q3_car_make_other) {
    prompt += `\nOther Makes: ${quizData.q3_car_make_other}`;
  }
  if (quizData.q4_car_features_other) {
    prompt += `\nOther Features: ${quizData.q4_car_features_other}`;
  }

  prompt += `
Recommend 4 specific car models that are strictly within the monthly and upfront budget, and 2 that slightly exceed budget but offer strong value. Use current lease trends and plausible pricing.

IMPORTANT FORMAT RULES:
- Respond ONLY with raw JSON (no markdown, no commentary).
- Output MUST begin with { and end with }.
- Do NOT add headers, explanations, or code blocks.
- Use realistic monthly payments, MSRP, and lease terms based on 2025 conditions.
- If no valid options exist, return an empty recommendations list with an explanation in a "note" field.

Please provide recommendations in the following JSON format:
Only include raw JSON (no markdown or explanation). Begin with { and end with }.
{
  "recommendations": [
    {
      "rank": 1,
      "make": "Toyota",
      "model": "RAV4",
      "year": 2025,
      "trim": "LE",
      "category": "Mid-Size SUV",
      "msrp": "$56,100",
      "monthly_payment": 450,
      "total_due_at_signing": 2500,
      "source": "Toyota of Manhattan, incl. home delivery",
      "pros": ["Excellent resale value", "Reliable", "Good fuel economy"],
      "cons": ["Road noise at highway speeds", "Rear seat space could be better"],
      "lease_terms": "36 months, 10,000 miles/year",
      "confidence_score": 95
    }
  ],
  "above_budget": [...]
}
`;

  return prompt;
};

// Main function to get car recommendations
const getCarRecommendations = async (quizData) => {
  try {
    console.log('Generating car recommendations for:', quizData.first_name);

    console.log('Getting OpenAI client...');
    const client = getOpenAIClient();
    
    if (!client) {
      throw new Error('Failed to create OpenAI client');
    }
    
    console.log('Building prompt...');
    const prompt = buildCarRecommendationPrompt(quizData);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert car leasing consultant with deep knowledge of current car models, pricing, and lease terms. Always provide accurate, best prices recommendations based on customer needs and budget."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });
    
    console.log('OpenAI API call successful');
    const response = completion.choices[0].message.content;
    
    // Try to parse JSON response
    try {
        let cleanedResponse = response;
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
        cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
        cleanedResponse = cleanedResponse.trim();
        console.log('Cleaned response for parsing:', cleanedResponse.substring(0, 200) + '...');
        const recommendations = JSON.parse(response);
      return {
        success: true,
        data: recommendations,
        raw_response: response
      };
    } catch (parseError) {
      // If JSON parsing fails, return the raw text
      console.warn('Failed to parse JSON response:', parseError);
      console.warn('Raw response was:', response);

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const extractedJson = JSON.parse(jsonMatch[0]);
            console.log('Successfully extracted JSON from response');
            return {
                success: true,
                data: extractedJson,
                raw_response: response
            };
        }
      } catch (extractError) {
        console.warn('Failed to extract JSON manually:', extractError);
      }

      return {
        success: true,
        data: { raw_text: response },
        raw_response: response
      };
    }
    
  } catch (error) {
    console.error('OpenAI API Error:', error);
    console.error('Error type:', typeof error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Provide fallback recommendations
    const fallbackRecommendations = {
      recommendations: [
        {
          rank: 1,
          make: "Honda",
          model: "Civic",
          year: 2024,
          category: "Sedan",
          estimated_monthly_payment: parseInt(quizData.lease_budget_min) || 350,
          why_recommended: "Reliable and fuel-efficient option within your budget.",
          next_steps: "Our team will contact you with specific dealership quotes."
        }
      ],
      summary: "We're experiencing high demand. Our team will personally review your preferences and provide detailed recommendations.",
      error: "AI temporarily unavailable"
    };
    
    return {
      success: false,
      error: error.message,
      fallback_data: fallbackRecommendations
    };
  }
};

module.exports = {
  getCarRecommendations,
  buildCarRecommendationPrompt
};