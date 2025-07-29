import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Car, DollarSign, Users, CheckCircle, Brain } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { LeaseBudgetChart, RentVsLeaseChart } from './LeaseApprovalChart.js';

const CarLeaseQuiz = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    cellphone: '',
    zipcode: '',
    car_make: '',
    car_make_other: '',
    body_type: [],
    powertrain: [],
    lease_miles: '',
    yearly_income: '',
    residence_type: '',
    monthly_rent: '',
    credit_score: '',
    dp_budget: '',
    decision_monthly_budget_range: '',
    custom_min_budget: '',
    custom_max_budget: ''
  });
  
  const navigate = useNavigate();

  const totalSteps = 3;

  const formatCellPhoneNumber = (value) => {
    const cellphone = value.replace(/\D/g, '');
    const phoneLength = cellphone.length;
    if (phoneLength < 4) return cellphone;
    if (phoneLength < 7) return `(${cellphone.slice(0, 3)}) ${cellphone.slice(3)}`;
    return `(${cellphone.slice(0, 3)}) ${cellphone.slice(3, 6)}-${cellphone.slice(6, 10)}`;
  };

  const isValidPhoneNumber = (number) => {
    const digitsOnly = number.replace(/\D/g, '');
    return digitsOnly.length === 10;
  };

  const handlePhoneChange = (value) => {
    const formatted = formatCellPhoneNumber(value);
    setFormData({ ...formData, cellphone: formatted });
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidZipcode = (zipcode) => {
    return /^\d{5}$/.test(zipcode);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    const number = value.toString().replace(/[^\d]/g, '');
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number);
  };

  const calculateSuggestedLeaseRange = (yearly_income, credit_score, monthly_rent) => {
    if (!yearly_income || !credit_score) {
      return { lower_bound_lease_payment: 0, upper_bound_lease_payment: 0 };
    }

    const monthlyIncome = yearly_income / 12;

    let maxPercentage = 0.12; // default <600
    if (credit_score >= 700) {
      maxPercentage = 0.15;
    } else if (credit_score >= 650) {
      maxPercentage = 0.14;
    } else if (credit_score >= 600) {
      maxPercentage = 0.13;
    }

    let maxPayment = monthlyIncome * maxPercentage;

    // Only apply rent adjustment if user has rent/mortgage and it's provided
    if (monthly_rent && (formData.residence_type === 'rent' || formData.residence_type === 'own')) {
      const rentToIncomeRatio = (monthly_rent / monthlyIncome) * 100;
      if (rentToIncomeRatio > 30) {
        const adjustmentFactor = 1 - ((rentToIncomeRatio - 30) / 100);
        maxPayment = maxPayment * adjustmentFactor;
      }
    }

    const lower_bound_lease_payment =  Math.floor(maxPayment * 0.9 / 100) * 100;;
    const upper_bound_lease_payment = Math.round(maxPayment * 1.035);

    return { lower_bound_lease_payment, upper_bound_lease_payment };
  };

  const handleCheckboxChange = (field, value, isChecked) => {
    setFormData((prev) => {
      const currentArray = prev[field] || [];
      const updated = isChecked
        ? [...currentArray, value]
        : currentArray.filter((item) => item !== value);

      return { ...prev, [field]: updated };
    });
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isStepValid(currentStep)) {
      alert('Please fill in all required fields before submitting.');
      return;
    }

    try {
      console.log('Submitting quiz and generating recommendations...');
      
      setIsLoading(true);
      
    const suggestedRange = calculateSuggestedLeaseRange(
      Number(formData.yearly_income),
      Number(formData.credit_score),
      Number(formData.monthly_rent)
    );

    const submissionData = {
      ...formData,
      lower_bound_lease_payment: suggestedRange.lower_bound_lease_payment,
      upper_bound_lease_payment: suggestedRange.upper_bound_lease_payment,
      custom_min_budget: formData.custom_min_budget ? Number(formData.custom_min_budget) : null,
      custom_max_budget: formData.custom_max_budget ? Number(formData.custom_max_budget) : null,
    };

    const response = await fetch('http://localhost:3001/api/generate-recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quiz_data: submissionData
      })
    });
      const result = await response.json();
      
      if (result.success) {
        console.log('Recommendations generated:', result);
        localStorage.setItem('leaseResults', JSON.stringify(result));
        navigate('/results');

      } else {
        console.warn('Using fallback recommendations:', result.fallback_recommendations);
        alert('Recommendations ready! (Using backup system)');
      }
      
    } catch (error) {
      console.error('Full error details:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      alert(`Error: ${error.message}. Check console for details.`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderProgressBar = () => (
    <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
      ></div>
    </div>
  );

  const requiredFieldsByStep = {
    1: ['first_name', 'last_name', 'email', 'cellphone', 'zipcode'],
    2: (formData) => {
      const fields = ['car_make', 'body_type', 'powertrain', 'lease_miles'];
      if (formData.car_make.includes('Other')) {
        fields.push('car_make_other');
      }
      return fields;
    },
    3: (formData) => {
      const baseFields = ['yearly_income', 'residence_type', 'credit_score', 'dp_budget', 'decision_monthly_budget_range'];
      
      if (formData.residence_type === 'rent' || formData.residence_type === 'own') {
        baseFields.push('monthly_rent');
      }
      
      return baseFields;
    }
  };

  const isStepValid = (step) => {
    const requiredFields = typeof requiredFieldsByStep[step] === 'function'
      ? requiredFieldsByStep[step](formData)
      : requiredFieldsByStep[step];

    return requiredFields.every((field) => {
      const value = formData[field];

      if (Array.isArray(value)) return value.length > 0;

      if (field === 'email') return isValidEmail(value);
      if (field === 'cellphone') return isValidPhoneNumber(value);
      if (field === 'zipcode') return isValidZipcode(value);

      return value && value.toString().trim() !== '';
    });
  };

  // Updated to handle conditional requirements
  const isFinancialsFilled = () => {
    const { yearly_income, residence_type, credit_score, dp_budget } = formData;
    const baseFieldsFilled = yearly_income && residence_type && credit_score && dp_budget;
    
    // If living with family, don't require monthly_rent
    if (residence_type === 'live_with_family') {
      return baseFieldsFilled;
    }
    
    // If rent or own, require monthly_rent as well
    return baseFieldsFilled && formData.monthly_rent;
  };

  const renderStep = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className="text-center">
            <Users className="w-16 h-16 text-blue-600 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Initial Information</h2>
            
            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  placeholder="John"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-xl"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="Smith"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-xl"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="john_smith@gmail.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-xl"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
                {!isValidEmail(formData.email) && formData.email && 
                (<p className="text-red-500 text-sm mt-1">Please enter a valid email address</p>)}
              </div>

              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                  Cellphone
                </label>
                <input
                  type="tel"
                  placeholder="### ### ####"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-xl"
                  value={formData.cellphone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
                {!isValidPhoneNumber(formData.cellphone) && formData.cellphone && 
                (<p className="text-red-500 text-sm mt-1">Please enter a valid 10-digit phone number</p>)}
              </div>

              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                  Zipcode
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter your zipcode"
                  maxLength={5}
                  className={`w-full px-4 py-3 border ${
                    !isValidZipcode(formData.zipcode) && formData.zipcode ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-xl`}
                  value={formData.zipcode}
                  onChange={(e) =>
                    handleInputChange('zipcode', e.target.value.replace(/\D/g, '').slice(0, 5))
                  }
                />
                {!isValidZipcode(formData.zipcode) && formData.zipcode && (
                  <p className="text-red-500 text-sm mt-1">Zipcode must be 5 digits.</p>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <div>
              <h2 className="text-xl font-semibold mb-2">What Make are you interested in?</h2> 
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xl"
                value={formData.car_make}
                onChange={(e) => handleInputChange('car_make', e.target.value)}
              >
                <option value="">Select an option...</option>
                <option value="Acura">Acura</option>
                <option value="Bentley">Bentley</option>
                <option value="BMW">BMW</option>
                <option value="Chevrolet">Chevrolet</option>
                <option value="Cadillac">Cadillac</option>
                <option value="Genesis">Genesis</option>
                <option value="Honda">Honda</option>
                <option value="Hummer EV">Hummer EV</option>
                <option value="Hyundai">Hyundai</option>
                <option value="Jeep">Jeep</option>
                <option value="Kia">Kia</option>
                <option value="Lamborghini">Lamborghini</option>
                <option value="Lexus">Lexus</option>
                <option value="Mazda">Mazda</option>
                <option value="Mercedes Benz">Mercedes Benz</option>
                <option value="Nissan">Nissan</option>
                <option value="Porsche">Porsche</option>
                <option value="Toyota">Toyota</option>
                <option value="Volkswagen">Volkswagen</option>
                <option value="Other">Other</option>
              </select>
              {formData.car_make === 'Other' && (
                <input
                  type="text"
                  placeholder="Please provide the Make"
                  value={formData.car_make_other}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, car_make_other: e.target.value }))
                  }
                  className="mt-3 w-full px-4 py-2 border border-gray-300 rounded"
                />
              )}
            </div>                   

            <div>
              <h2 className="text-xl font-semibold mb-2">What types of cars are you interested in? (Select all that apply)</h2> 
              {[
                'Sedan', 'Coupe', 'SUV', 'Convertible', 'Pick-Up Truck', 'Hatchback' 
              ].map((option) => (
                <label key={option} className="block text-left text-md text-gray-800 mb-2">
                  <input
                    type="checkbox"
                    value={option}
                    checked={formData.body_type.includes(option)}
                    onChange={(e) => handleCheckboxChange('body_type', option, e.target.checked)}
                    className="mr-2"
                  />
                  {option}
                </label>
              ))}
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-2">Which types of car interest you? (Select all that apply)</h2> 
              {[
                'Electric Cars', 'Hybrid Cars', 'Gas Cars'
              ].map((option) => (
                <label key={option} className="block text-left text-md text-gray-800 mb-2">
                  <input
                    type="checkbox"
                    value={option}
                    checked={formData.powertrain.includes(option)}
                    onChange={(e) => handleCheckboxChange('powertrain', option, e.target.checked)}
                    className="mr-2"
                  />
                  {option}
                </label>
              ))}
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-2">How many miles do you anticipate on driving a year?</h2> 
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xl"
                value={formData.lease_miles}
                onChange={(e) => handleInputChange('lease_miles', e.target.value)}
              >
                <option value="">Select an option...</option>
                <option value="7,500 Miles">7,500 Miles</option>
                <option value="10,000 Miles">10,000 Miles</option>
                <option value="12,000 Miles">12,000 Miles</option>
                <option value="15,000 Miles">15,000 Miles</option>
                <option value="18,000 Miles">18,000 Miles</option>
                <option value="20,000 Miles">20,000 Miles</option>
              </select>
            </div>                   
          </div>
        );

      case 3:
        const suggestedRange = calculateSuggestedLeaseRange(
          formData.yearly_income, 
          formData.credit_score, 
          formData.monthly_rent
        );

        const showRentChart = formData.residence_type === 'rent' || formData.residence_type === 'own';

        return (
          <div className="text-center">
            <DollarSign className="w-16 h-16 text-blue-600 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Financials</h2>
            <p className="text-gray-700 mb-8">Tell us about your available budget and financials for a lease</p>
            
            <div className="space-y-6 max-w-md mx-auto">
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                  Approximate Yearly Income (Before Taxes)
                </label>
                <input 
                  type="number"
                  placeholder="e.g. $75000"
                  value={formData.yearly_income}
                  onChange={(e) => setFormData((prev) => ({ ...prev, yearly_income: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xl"
                />
                <p className="text-sm text-gray-500 mt-1">{formatCurrency(formData.yearly_income)}</p>
              </div>

              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                  What is your estimated credit score?
                </label>
                <div className="flex space-x-4">
                  <input
                    type="number"
                    placeholder="e.g. 720"
                    value={formData.credit_score}
                    onChange={(e) => setFormData((prev) => ({ ...prev, credit_score: e.target.value }))}
                    className="w-1/2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                  How much would you like to put down as a downpayment?
                </label>
                <div className="flex space-x-4">
                  <input
                    type="number"
                    placeholder="e.g. $5000"
                    value={formData.dp_budget}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dp_budget: e.target.value }))}
                    className="w-1/2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xl"
                  />
                  <p className="text-sm text-gray-500 mt-1">{formatCurrency(formData.dp_budget)}</p>
                </div>
              </div>

              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                  Residence Type
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xl"
                  value={formData.residence_type}
                  onChange={(e) => handleInputChange('residence_type', e.target.value)}
                >
                  <option value="">Select an option...</option>
                  <option value="rent">Rent</option>
                  <option value="own">Own</option>
                  <option value="live_with_family">Live With Family</option>
                </select>
              </div>

              {formData.residence_type && (
                <>
                  {(formData.residence_type === 'rent' || formData.residence_type === 'own') && (
                    <div>
                      <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                        Monthly Rent/Mortgage Payment
                      </label>
                      <div className="flex space-x-4">
                        <input
                          type="number"
                          placeholder="e.g. $1500"
                          value={formData.monthly_rent}
                          onChange={(e) => setFormData((prev) => ({ ...prev, monthly_rent: e.target.value }))}
                          className="w-1/2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xl"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-center text-xl font-bold mb-4">
                      Your Recommended Monthly Lease Budget: ${suggestedRange.lower_bound_lease_payment} - ${suggestedRange.upper_bound_lease_payment}
                    </label> 
                    {isFinancialsFilled() && (
                      <div className="w-full max-w-4xl mx-auto px-4 mt-10 mb-16 space-y-20">
                        <div className="h-[400px] w-full">
                          <LeaseBudgetChart
                            monthlyIncome={Number(formData.yearly_income) / 12}
                            creditScore={Number(formData.credit_score)}
                          />
                        </div>
                        {showRentChart && (
                          <div className="h-[400px] w-full">
                            <RentVsLeaseChart
                              monthlyIncome={Number(formData.yearly_income) / 12}
                              creditScore={Number(formData.credit_score)}
                              monthlyRent={Number(formData.monthly_rent)}
                            />
                          </div>
                        )}
                        {formData.residence_type === 'live_with_family' && (
                          <div className="text-center p-6 bg-blue-50 rounded-lg">
                            <p className="text-blue-700 font-medium">
                              Since you live with family, we've focused on your lease budget analysis only on your credit score.
                              This gives you more flexibility in your monthly budget for a lease!
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                      Use the recommended lease budget or provide your own?
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xl"
                      value={formData.decision_monthly_budget_range}
                      onChange={(e) => handleInputChange('decision_monthly_budget_range', e.target.value)}
                    >
                      <option value="">Select an option...</option>
                      <option value="Yes">Yes, use the monthly range of ${suggestedRange.lower_bound_lease_payment} - ${suggestedRange.upper_bound_lease_payment}</option>
                      <option value="no_custom">No, I want to provide a custom range</option>
                    </select>
                    
                    {formData.decision_monthly_budget_range === 'no_custom' && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                        <label className="block text-left text-sm font-medium text-gray-700 mb-2">
                          Enter your custom monthly lease budget range:
                        </label>
                        <div className="flex gap-4 items-center">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-600 mb-1">Minimum ($)</label>
                            <input
                              type="number"
                              placeholder="e.g., $800"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={formData.custom_min_budget || ''}
                              onChange={(e) => handleInputChange('custom_min_budget', e.target.value)}
                            />
                          </div>
                          <span className="text-gray-500 pt-5">to</span>
                          <div className="flex-1">
                            <label className="block text-xs text-gray-600 mb-1">Maximum ($)</label>
                            <input
                              type="number"
                              placeholder="e.g., $900"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={formData.custom_max_budget || ''}
                              onChange={(e) => handleInputChange('custom_max_budget', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Car className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Leaseasy AI</span>
          </div>
          <div className="text-sm text-gray-500">
            Step {currentStep} of {totalSteps}
          </div>
        </div>

        {renderProgressBar()}

        <div className="mb-12">
          {renderStep()}
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          {currentStep === totalSteps ? (
            <button
              onClick={handleSubmit}
              disabled={!isStepValid(currentStep) || isLoading}
              className={`flex items-center space-x-2 px-8 py-3 rounded-lg font-semibold transition-all ${
                (isStepValid(currentStep) && !isLoading)
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              style={{
                cursor: (!isStepValid(currentStep) || isLoading) ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Generating Recommendations...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Get My Matches</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={nextStep}
              disabled={!isStepValid(currentStep)}
              className={`flex items-center space-x-2 px-8 py-3 rounded-lg font-semibold transition-all ${isStepValid(currentStep)
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              style={{
                cursor: !isStepValid(currentStep) ? 'not-allowed' : 'pointer'
              }}
            >
              <span>Continue</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CarLeaseQuiz;
