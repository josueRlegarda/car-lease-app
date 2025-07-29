/**
 * Analysis Service for Car Lease Recommendations Provided by GPT API
 */

class AnalysisService {
  constructor() {}

  async analyzeRecommendations(gptResponse, quizData) {
    try {
      const recommendations = this.extractRecommendations(gptResponse);

      const individualCars = this.splitRecommendations(recommendations);

      const userCriteria = this.extractQuizData(quizData);

      const paymentCalculations = this.calculatePaymentScenarios(individualCars, userCriteria);

      const monthlyPaymentComparison = this.compareMonthlyPayments(individualCars, userCriteria);

      return {
        success: true,
        recommendations: recommendations,
        individualCars: individualCars,
        userCriteria: userCriteria,
        paymentCalculations: paymentCalculations,
        monthlyPaymentComparison: monthlyPaymentComparison,
      };

    } catch (error) {
      console.error('Analysis Service Error:', error);
      return {
        success: false,
        error: error.message,
        recommendations: [],
        userCriteria: {}
      };
    }
  }
  extractRecommendations(gptResponse) {
    console.log('GPT Response structure:', Object.keys(gptResponse));
    return gptResponse.recommendations || [];
  }

  splitRecommendations(recommendations) {
    const individualCars = {};

    recommendations.forEach((car, index) => {
      const carKey = `car${index + 1}`;
      individualCars[carKey] = car;
    });
    console.log(`Split ${recommendations.length} recommendations into individual cars`);
    return individualCars;
  }

  extractQuizData(quizData) {
    console.log('Quiz Data structure:', Object.keys(quizData));
    
    return {
      minMonthlyPayment: quizData.lower_bound_lease_payment || null,
      maxMonthlyPayment: quizData.upper_bound_lease_payment || null,
      minMonthlyPaymentCustom: quizData.custom_min_budget || null,
      maxMonthlyPaymentCustom: quizData.custom_max_budget || null,
      monthlyPaymentDecision: quizData.decision_monthly_budget_range || null,
      downPayment: quizData.dp_budget || null,
      annualMileage: quizData.lease_miles || null,
      includeStretchOptions: true
    };
  }

compareMonthlyPayments(individualCars, userCriteria) {
    const comparison = {};

    let minPayment, maxPayment, budgetType;

    if (userCriteria.monthlyPaymentDecision === "Yes") {
    minPayment = userCriteria.minMonthlyPayment;
    maxPayment = userCriteria.maxMonthlyPayment;
    budgetType = "regular";
    } else {
    minPayment = userCriteria.minMonthlyPaymentCustom;
    maxPayment = userCriteria.maxMonthlyPaymentCustom;
    budgetType = "custom";
    }
    if (!minPayment || !maxPayment) {
      console.log(`No valid budget values found - ${budgetType} budget`);
      Object.keys(individualCars).forEach(carKey => {
        const car = individualCars[carKey];
        comparison[carKey] = {
          car_info: `${car.make} ${car.model}`,
          monthly_payment: parseFloat(car.monthly_payment) || 0,
          status: "no_budget_set",
          reason: `No valid ${budgetType} budget values provided`
        };
      });
      return comparison;
    }
    console.log(`Comparing monthly payments against ${budgetType} budget: ${minPayment} - ${maxPayment}`);

    Object.keys(individualCars).forEach(carKey => {
    const car = individualCars[carKey];
    const carPayment = parseFloat(car.monthly_payment) || 0;

    let status;
    let reason;

    if (carPayment < minPayment) {
        status = "below_budget";
        reason = `Payment ${carPayment} is below minimum ${budgetType} budget of ${minPayment}`;
    } else if (carPayment >= minPayment && carPayment <= maxPayment) {
        status = "within_budget";
        reason = `Payment ${carPayment} is within ${budgetType} budget range ${minPayment} - ${maxPayment}`;
    } else {
        status = "above_budget";
        reason = `Payment ${carPayment} exceeds maximum ${budgetType} budget of ${maxPayment}`;
    }

    comparison[carKey] = {
        car_info: `${car.make} ${car.model}`,
        monthly_payment: carPayment,
        user_min_budget: minPayment,
        user_max_budget: maxPayment,
        budget_type: budgetType,
        status: status,
        reason: reason
    };
    });
    return comparison;
  }

  calculatePaymentScenarios(individualCars, userCriteria) {
    const calculations = {};
    const downPaymentMultipliers = [1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6];
    const defaultMoneyFactor = 0.0000175;
    const defaultLeaseMonths = 36;

    Object.keys(individualCars).forEach(carKey => {
      const car = individualCars[carKey];
      
      const msrp = parseFloat(car.msrp) || 0;
      const leaseMonths = parseInt(car.lease_months) || defaultLeaseMonths ;
      const residualPercent = this.convertResidualToDecimal(car.residual);
      const moneyFactor = parseFloat(car.money_factor) || defaultMoneyFactor;
      const userDownPayment = parseFloat(userCriteria.downPayment) || 0;
      const leaseMilesPerYear = parseInt(car.lease_miles_per_year) || null;

      console.log(`${carKey} lease miles debug:`, {
        original: car.lease_miles_per_year,
        originalType: typeof car.lease_miles_per_year,
        parsed: leaseMilesPerYear,
        parsedType: typeof leaseMilesPerYear
        });

      console.log(`Processing ${carKey}: MSRP: ${msrp}, Lease Months: ${leaseMonths}, Residual: ${residualPercent}, Money Factor: ${moneyFactor}, Miles: ${leaseMilesPerYear}`);

      if (msrp === 0 || leaseMonths === 0) {
        calculations[carKey] = {
          car_info: `${car.make} ${car.model}`,
          error: "Missing essential data (MSRP or lease months)",
          scenarios: []
        };
        return;
      }

      const scenarios = [];

      downPaymentMultipliers.forEach((multiplier, index) => {
        const downPayment = userDownPayment * multiplier;
        
        const capCost = msrp - downPayment;
        
        const residualValue = msrp * residualPercent;
        
        const depreciation = (capCost - residualValue) / leaseMonths;
        
        const financeFee = (capCost + residualValue) * moneyFactor;
        
        const totalPayment = depreciation + financeFee;

        scenarios.push({
          scenario: index === 0 ? "original" : `${Math.round(multiplier * 100)}%`,
          down_payment: Math.round(downPayment),
          down_payment_multiplier: multiplier,
          cap_cost: Math.round(capCost),
          residual_value: Math.round(residualValue),
          depreciation: Math.round(depreciation * 100) / 100,
          finance_fee: Math.round(financeFee * 100) / 100,
          monthly_payment: Math.round(totalPayment * 100) / 100
        });
      });

      calculations[carKey] = {
        car_info: `${car.make} ${car.model}`,
        original_data: {
          msrp: msrp,
          lease_months: leaseMonths,
          residual_percent: residualPercent,
          money_factor: moneyFactor,
          user_down_payment: userDownPayment,
          lease_miles_per_year: leaseMilesPerYear
        },
        scenarios: scenarios
      };
    });

    return calculations;
  }

  convertResidualToDecimal(residualString) {
    if (!residualString) return 0;
    
    if (typeof residualString === 'string' && residualString.includes('%')) {
      return parseFloat(residualString.replace('%', '')) / 100;
    }
    
    const residualNum = parseFloat(residualString);
    if (residualNum > 1) {
      return residualNum / 100;
    }
    
    return residualNum || 0;
  }
}

const analysisService = new AnalysisService();

module.exports = {
  AnalysisService,
  analyzeRecommendations: (gptResponse, quizData) => 
    analysisService.analyzeRecommendations(gptResponse, quizData)
};
