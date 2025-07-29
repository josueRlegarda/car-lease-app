/**
 * Results Page after Quiz submitted and GPT API call was analyzed
 */

import React, { useState, useEffect } from 'react';
import { Car, DollarSign, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import CarRecommendationCharts from './graphRecommendations'; // Add this import

const CarLeaseResults = () => {
  const [resultsData, setResultsData] = useState(null);
  const [selectedDeals, setSelectedDeals] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get the results data that was stored when user submitted the quiz
    const storedResults = localStorage.getItem('leaseResults');
    
    if (storedResults) {
      try {
        const parsedResults = JSON.parse(storedResults);
        setResultsData(parsedResults);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load results data');
        setIsLoading(false);
      }
    } else {
      setError('No results data found. Please complete the quiz first.');
      setIsLoading(false);
    }
  }, []);

  const handleDealSelection = (carKey, scenarioIndex, dealData) => {
    setSelectedDeals(prev => ({
      ...prev,
      [carKey]: {
        scenarioIndex,
        dealData,
        carInfo: dealData.carInfo
      }
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Remove the old renderPaymentTable function - we don't need it anymore

  const goBackToQuiz = () => {
    localStorage.removeItem('leaseResults');
    window.location.href = '/quiz';
  };

  const proceedWithSelection = () => {
    const selectedCount = Object.keys(selectedDeals).length;
    
    if (selectedCount === 0) {
      alert('Please select at least one deal to proceed.');
      return;
    }

    // Store selected deals for next step
    localStorage.setItem('selectedDeals', JSON.stringify(selectedDeals));
    
    // For now, just show what was selected (you can expand this later)
    alert(`You selected ${selectedCount} deal(s). Next step: Contact dealers!`);
    
    console.log('Selected deals:', selectedDeals);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your lease recommendations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <button
            onClick={goBackToQuiz}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Quiz
          </button>
        </div>
      </div>
    );
  }

  // Change this to use analysis_result instead of payment_tables
  const { analysis_result } = resultsData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Car className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Your Lease Options</h1>
                <p className="text-gray-600">Compare payment scenarios and select your preferred deals</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {analysis_result?.paymentCalculations ? Object.keys(analysis_result.paymentCalculations).length : 0} cars found
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-blue-900">Payment Scenarios</h2>
          </div>
          <p className="text-blue-800">
            Each chart shows different down payment options for the same car. The red dashed line shows your original down payment amount, 
            while the bars show how your monthly payment changes with different down payment amounts.
          </p>
        </div>

        {/* Car Recommendation Charts - Replace the old tables section */}
        {analysis_result?.success ? (
          <CarRecommendationCharts analysisResult={analysis_result} />
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No analysis data available</p>
            <p className="text-gray-400 text-sm mt-2">
              Debug info: {analysis_result ? 'Analysis object exists but no data' : 'No analysis_result object'}
            </p>
            {/* Debug: Show what data we have */}
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-blue-600">Show raw data (debug)</summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
                {JSON.stringify(resultsData, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Selection Summary - You might want to implement chart interaction later */}
        {Object.keys(selectedDeals).length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-8">
            <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span>Your Selections ({Object.keys(selectedDeals).length})</span>
            </h3>
            <div className="space-y-2">
              {Object.entries(selectedDeals).map(([carKey, selection]) => (
                <div key={carKey} className="flex justify-between items-center">
                  <span className="text-green-800">{selection.carInfo}</span>
                  <span className="text-green-600 font-medium">
                    {formatCurrency(selection.dealData.monthlyPayment)}/month 
                    ({formatCurrency(selection.dealData.downPayment)} down)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-12 pt-8 border-t border-gray-200">
          <button
            onClick={goBackToQuiz}
            className="flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Quiz</span>
          </button>

          <button
            onClick={proceedWithSelection}
            disabled={Object.keys(selectedDeals).length === 0}
            className={`flex items-center space-x-2 px-8 py-3 rounded-lg font-semibold transition-all ${
              Object.keys(selectedDeals).length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <span>Continue with Selection</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CarLeaseResults;