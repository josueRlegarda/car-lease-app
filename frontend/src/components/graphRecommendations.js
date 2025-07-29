/**
 * Creates bar charts from the recommendations provided from GPT API and analysis from the analysisService.js script
 */
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine
} from 'recharts';

const CarRecommendationCharts = ({ analysisResult }) => {
  if (!analysisResult || !analysisResult.success) {
    return (
      <div className="w-full p-4 text-center">
        <p className="text-red-500">Error loading recommendation data</p>
      </div>
    );
  }

  const { paymentCalculations, monthlyPaymentComparison, userCriteria } = analysisResult;
  
  // Helper function to parse car info
  const parseCarInfo = (carData) => {
    // Extract year from car_info string
    const yearMatch = carData.car_info.match(/20\d{2}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
    
    // If we have original_data, use it
    if (carData.original_data && carData.original_data.make) {
      return {
        make: carData.original_data.make || 'Unknown',
        model: carData.original_data.model || '',
        trim: carData.original_data.trim || '',
        year: carData.original_data.year || year,
        fullName: carData.car_info // Use the full car_info as backup
      };
    }

    // Parse from car_info string (e.g., "BMW X3 xDrive30i")
    const carInfoParts = carData.car_info.split(' ');
    
    if (carInfoParts.length >= 2) {
      return {
        make: carInfoParts[0] || 'Unknown',
        model: carInfoParts[1] || '',
        trim: carInfoParts.slice(2).join(' ') || '',
        year: year,
        fullName: carData.car_info
      };
    }
    
    // Fallback
    return {
      make: carInfoParts[0] || 'Unknown',
      model: '',
      trim: '',
      year: year,
      fullName: carData.car_info
    };
  };

  // Sort cars by budget status
  const sortedSections = {
    within_budget: [],
    below_budget: [],
    above_budget: [],
    no_budget_set: []
  };

  Object.keys(paymentCalculations).forEach(carKey => {
    const carData = paymentCalculations[carKey];
    const budgetStatus = monthlyPaymentComparison[carKey]?.status || 'no_budget_set';
    
    if (!carData.error) {
      const carInfo = parseCarInfo(carData);
      const originalDownPayment = userCriteria.downPayment || 0;
      
      // Prepare chart data
      const chartData = carData.scenarios
        .map((scenario, index) => ({
          downPayment: scenario.down_payment,
          monthlyPayment: scenario.monthly_payment,
          downPaymentFormatted: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }).format(scenario.down_payment),
          isOriginal: scenario.scenario === 'original',
          leaseMonths: carData.original_data?.lease_months || 36,
          scenarioIndex: index
        }))
        .sort((a, b) => a.downPayment - b.downPayment); // Sort by down payment amount

      sortedSections[budgetStatus].push({
        carKey,
        carInfo,
        title: `${carInfo.year} ${carInfo.fullName}`, // Use fullName which includes the complete car info
        chartData,
        originalDownPayment,
        budgetInfo: monthlyPaymentComparison[carKey],
        originalMonthlyPayment: carData.scenarios[0]?.monthly_payment || 0
      });
    }
  });

  // Sort within each section by monthly payment
  Object.keys(sortedSections).forEach(section => {
    sortedSections[section].sort((a, b) => a.originalMonthlyPayment - b.originalMonthlyPayment);
  });

  const sectionOrder = ['within_budget', 'below_budget', 'above_budget', 'no_budget_set'];
  const sectionLabels = {
    within_budget: 'Within Budget',
    below_budget: 'Below Budget',
    above_budget: 'Above Budget',
    no_budget_set: 'No Budget Set'
  };

  const sectionColors = {
    within_budget: '#27ae60',
    below_budget: '#f39c12',
    above_budget: '#e74c3c',
    no_budget_set: '#6c757d'
  };

  // Custom dot component for the line chart
  const CustomDot = (props) => {
    const { cx, cy } = props;
    // Regular blue dots for all points
    return (
      <circle 
        cx={cx} 
        cy={cy} 
        r={5} 
        fill="#3498db" 
        stroke="#2980b9" 
        strokeWidth={2}
      />
    );
  };

  return (
    <div className="w-full space-y-8">
      {sectionOrder.map(sectionKey => {
        const section = sortedSections[sectionKey];
        
        if (!section || section.length === 0) return null;

        return (
          <div key={sectionKey} className="space-y-6">
            {/* Section Header */}
            <div 
              className="text-center py-4 px-6 rounded-lg font-bold text-xl"
              style={{ 
                backgroundColor: `${sectionColors[sectionKey]}20`,
                color: sectionColors[sectionKey],
                border: `2px solid ${sectionColors[sectionKey]}`
              }}
            >
              {sectionLabels[sectionKey]}
            </div>

            {/* Charts in this section */}
            {section.map(({ carKey, title, chartData, originalDownPayment, budgetInfo }) => {
              // Get the original car data for this specific car
              const carData = paymentCalculations[carKey];
              
              return (
                <div key={carKey} className="bg-white rounded-lg shadow-lg p-6">
                  {/* Chart Title */}
                  <h3 className="text-center text-xl font-bold mb-4">{title}</h3>
                  
                  {/* Car Lease Details */}
                  <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
                    <p><strong>Yearly Miles Allowed:</strong> {carData.original_data?.lease_miles_per_year ? carData.original_data.lease_miles_per_year.toLocaleString() : 'Not specified'} miles</p>
                    <p><strong>Lease Term:</strong> {carData.original_data?.lease_months || 'Not specified'} months</p>
                  </div>

                  {/* Chart */}
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={chartData} 
                        margin={{ top: 40, right: 30, left: 60, bottom: 60 }}
                      >
                        <XAxis
                          dataKey="downPayment"
                          type="number"
                          scale="linear"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={(value) =>
                            new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            }).format(value)
                          }
                          label={{
                            value: 'Down Payment',
                            position: 'insideBottom',
                            offset: -10,
                            style: { textAnchor: 'middle', fill: '#000', fontSize: 14, fontWeight: 'bold' }
                          }}
                        />
                        
                        <YAxis
                          tickFormatter={(value) =>
                            new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            }).format(value)
                          }
                          label={{
                            value: 'Monthly Payment',
                            angle: -90,
                            position: 'insideLeft',
                            style: { textAnchor: 'middle', fill: '#000', fontSize: 14, fontWeight: 'bold' }
                          }}
                        />

                        <Tooltip
                          formatter={(value, name, props) => {
                            const currency = new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            }).format(value);
                            
                            return [currency, 'Monthly Payment'];
                          }}
                          labelFormatter={(value) => 
                            `Down Payment: ${new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            }).format(value)}`
                          }
                        />

                        <Line 
                          type="monotone"
                          dataKey="monthlyPayment" 
                          stroke="#3498db"
                          strokeWidth={3}
                          dot={<CustomDot />}
                        >
                          <LabelList
                            dataKey="monthlyPayment"
                            position="top"
                            formatter={(value) =>
                              new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              }).format(value)
                            }
                            style={{
                              fill: '#2c3e50',
                              fontSize: 11,
                              fontWeight: 500
                            }}
                          />
                        </Line>

                        {/* Vertical dashed line for original down payment */}
                        {originalDownPayment > 0 && (
                          <ReferenceLine
                            x={originalDownPayment}
                            stroke="#e74c3c"
                            strokeDasharray="5 5"
                            strokeWidth={3}
                            label={{
                              value: 'Your Down Payment',
                              position: 'top',
                              fill: '#e74c3c',
                              fontSize: 14,
                              fontWeight: 'bold',
                              offset: 10
                            }}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default CarRecommendationCharts;