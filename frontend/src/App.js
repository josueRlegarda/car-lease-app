import { Routes, Route, useNavigate } from "react-router-dom";
import CarLeaseQuiz from './components/CarLeaseQuiz';
import CarLeaseResults from './components/CarLeaseResults';
import LandingPage from './components/LandingPage';

function App() {
  const navigate = useNavigate();

  const handleStartQuiz = () => {
    navigate('/quiz');
  };

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<LandingPage onStartQuiz={handleStartQuiz} />} />
        <Route path="/quiz" element={<CarLeaseQuiz />} />
        <Route path="/results" element={<CarLeaseResults />} />
      </Routes>
    </div>
  );
}

export default App;