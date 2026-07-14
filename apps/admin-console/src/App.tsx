import { Routes, Route } from 'react-router-dom';

// Pages added as implemented (Phase 1 Step 8 / Phase 2)
// Company admin: /company/* — Listings, Customers, Payments, Settings
// Super admin: /super-admin/* — Tenants, Billing, Platform Analytics
function App() {
  return (
    <Routes>
      <Route path="/" element={<div>RoomFinder Admin — coming soon</div>} />
    </Routes>
  );
}

export default App;
