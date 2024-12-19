
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import InstaAuthSucess from '../Components/InstaAuthSucess';
import App from '../App';
import React from 'react'

const Navigator = () => {
  return (
    <Router>
    <Routes>
      <Route path="/auth/callback" element={<InstaAuthSucess />} />
      <Route path="/" element={<App />} />
    </Routes>
  </Router>
  )
}

export default Navigator