import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
  Label
} from 'recharts';

const LeaseBudgetChart = ({ monthlyIncome, creditScore }) => {
  const rounded = (value) => Math.round(value);

  const data = [
    { creditScore: 500, monthlyPayment: rounded(monthlyIncome * 0.12) },
    { creditScore: 600, monthlyPayment: rounded(monthlyIncome * 0.13) },
    { creditScore: 650, monthlyPayment: rounded(monthlyIncome * 0.14) },
    { creditScore: 700, monthlyPayment: rounded(monthlyIncome * 0.15) },
    { creditScore: 800, monthlyPayment: rounded(monthlyIncome * 0.15) }
  ];

  return (
    <div className="w-full h-full">
      <h2 className="text-center text-xl font-bold mb-4">Credit Score vs Estimated Monthly Approval</h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
            data={data} 
            width={600}
            height={300}
            margin={{ top: 40, right: 30, left: 20, bottom: 40 }
        }>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="creditScore"
            type="number"    
            padding={{ left:30 }}
            tickCount={7}
            ticks={[500, 550, 600, 650, 700, 750, 800]}
            label={{ 
                value: 'Credit Score', 
                position: 'insideBottom', 
                offset: -5,
                dy: 10,
                dx: 0,
                style: { textAnchor: 'middle', fill: '#000', fontSize: 15 }
            }}
          />

          <YAxis
            dataKey="monthlyPayment"
            tickFormatter={(value) =>
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(value)
            }
            label={{
                value: 'Estimated Monthly Approval',
                angle: -90,
                position: 'insideLeft',
                dy: 0,
                dx:-10 ,
                style: { textAnchor: 'middle', fill: '#000', fontSize: 15 }
            }}
          />

          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(value)
            }
          />

          <Line
            type="stepAfter"
            dataKey="monthlyPayment"
            stroke="#4F46E5"
            strokeWidth={3}
            dot={{ r: 5 }}
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
              fill: '#0000FF',     
              fontSize: 13,
              fontWeight: 500
              }}
            />
          </Line>

          <ReferenceLine
            x={creditScore}
            stroke="red"
            strokeDasharray="3 3"
            ifOverflow="extendDomain"
            label={{
              value: `${creditScore}`,
              position: 'top',
              fill: 'red',
              fontSize: 12,
              fontWeight: 'bold'
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
const RentVsLeaseChart = ({ monthlyIncome = 0, creditScore = 700, monthlyRent = 0 }) => {

  let basePercent = 0.15;
  if (creditScore < 600) basePercent = 0.12;
  else if (creditScore < 650) basePercent = 0.13;
  else if (creditScore < 700) basePercent = 0.14;

  const baseLeasePayment = Math.round(monthlyIncome * basePercent);

  const calculateLeasePayment = (rentAmount) => {
    const rentToIncomeRatio = (rentAmount / monthlyIncome) * 100;
    
    if (rentToIncomeRatio <= 30) {
      return baseLeasePayment;
    } else {
      const adjustmentFactor = 1 - ((rentToIncomeRatio - 30) / 100);
      return Math.round(baseLeasePayment * adjustmentFactor);
    }
  };

  const percentages = [70, 80, 90, 100, 110, 120, 130];
  
  const chartData = percentages.map((percentage) => {
    const rentAmount = Math.round(monthlyRent * (percentage / 100));
    const leasePayment = calculateLeasePayment(rentAmount);
    
    return {
      rent: rentAmount,
      leasePayment: leasePayment,
      percentage: percentage
    };
  });

  return (
    <div className="w-full h-full">
      <h2 className="text-center text-xl font-bold mb-4">
        Rent/Mortgage Payments vs Estimated Monthly Approval
      </h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 30, right: 30, bottom: 40, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="rent"
            type="number"
            domain={['dataMin - 100', 'dataMax + 100']}
            tickFormatter={(value) => `$${value}`}
            label={{
              value: 'Monthly Rent/Mortgage Payment',
              position: 'insideBottom',
              offset: -5,
              dy: 10,
              dx: 0,
              style: { textAnchor: 'middle', fill: '#000', fontSize: 15 }
            }}
          />
          <YAxis
            dataKey="leasePayment"
            tickFormatter={(value) => `$${value}`}
            label={{
              value: 'Estimated Monthly Approval',
              angle: -90,
              position: 'insideLeft',
              dy: 0,
              dx: -10,
              style: { textAnchor: 'middle', fill: '#000', fontSize: 15 }
            }}
          />
          <Tooltip 
            formatter={(value, name) => [`$${value || 0}`, 'Lease Approval']}
            labelFormatter={(value) => `Rent: $${value}`}
          />
          
          <Line
            type="monotone"
            dataKey="leasePayment"
            stroke="#4F46E5"
            strokeWidth={3}
            dot={{ r: 5 }}
          >
            <LabelList
              dataKey="leasePayment"
              position="top"
              formatter={(value) => `$${value}`}
              style={{
                fill: '#0000FF',
                fontSize: 13,
                fontWeight: 500
              }}
            />
          </Line>
          
          {monthlyRent > 0 && (
            <ReferenceLine
              x={monthlyRent}
              stroke="red"
              strokeDasharray="5 5"
              strokeWidth={2}
              ifOverflow="extendDomain"
              label={{
                value: `$${monthlyRent}`,
                position: 'top',
                fill: 'red',
                fontSize: 12,
                fontWeight: 'bold'
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      
    </div>
  );
};
export { LeaseBudgetChart, RentVsLeaseChart };
;

