const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 'admin', role: 'admin' }, process.env.JWT_SECRET || 'supersecret123');

async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/facilities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Debug Turf",
        facility_type: "cricket",
        description: "Debug",
        location: "Loc",
        weekday_price: 800,
        weekend_price: 1000
      })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch (err) {
    console.error("Failed:", err.message);
  }
}
test();
