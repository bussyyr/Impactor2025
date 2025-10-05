# 🌍 Impactor-2025: Planetary Impact Simulation Dashboard

**Impactor-2025** is an interactive web application that visualizes potential asteroid impact scenarios on Earth using real data from **NASA’s NeoWs API** and **USGS Earthquake Service**.  
Built for the *NASA Space Apps Challenge 2025*, it helps users explore how asteroid size, speed, and impact angle affect global impact zones and population exposure.

---

## Features
- Real-time 3D globe visualization (Three.js + React + Three-Globe)  
- Simulation of asteroid impact radii (severe / major / light)  
- Live **Near-Earth Object (NEO)** feed from **NASA NeoWs API**  
- Adjustable parameters: diameter, velocity, impact angle, explosion type  
- Basic mitigation strategies (deflection & evacuation)  
- Population exposure estimation via planned **Eurostat GISCO** integration  
- A/B scenario comparison for scientific and educational use  

---

## Tech Stack
| Layer | Tools & Frameworks |
|-------|--------------------|
| Frontend | React, Three.js, Three-Globe, Framer Motion |
| Backend | Node.js + Express |
| APIs | NASA NeoWs, USGS Earthquake Feed, (planned) Eurostat GISCO |
| Language | JavaScript / JSX |
| Env vars | `.env` file (see below) |

---

## Environment Variables
Replace the placeholder values with your own credentials:

```bash
PORT=8787
NASA_KEY=your_nasa_api_key          # Replace with your personal NASA API key
GEONAMES_USER=your_geonames_username # Replace with your GeoNames username
REACT_APP_API_BASE=http://localhost:8787
```

A free NASA API key can be obtained from [https://api.nasa.gov](https://api.nasa.gov).

## How It Works

1. **Backend Data Retrieval**  
   The backend retrieves **Near-Earth Object (NEO)** data via [`server/model/neows.js`](server/model/neows.js).  
   It calls **NASA’s NeoWs API** to collect asteroid parameters (mean diameter, relative velocity, close-approach date), then **normalizes** the response into a flat list that the frontend can consume.

2. **Frontend Visualization**  
   The main interface [`src/pages/AsteroidImpactDashboard.jsx`](src/pages/AsteroidImpactDashboard.jsx) renders an interactive 3D globe using **React**, **Three.js**, and **Three-Globe**.  
   Users can click on any location or select a country to set an impact point and adjust asteroid **diameter**, **speed**, **entry angle**, and **explosion type** (ground, airburst, water).

3. **Impact Modeling**  
   [`impact.js`](impact.js) estimates blast radii using simplified physics:
   
   `radius ∝ diameter³ × speed² × sin(angle)`
   
   The model outputs three zones — **severe**, **major**, and **light** — in kilometers. These values update in real time as the user changes parameters. (This is a demo-level approximation; not a validated physical model.)

4. **Mitigation and Comparison**  
   The dashboard lets users experiment with **mitigation strategies**:  
   - **Deflection:** Applies a reduction factor based on Δv (mm/s) and lead time (years).  
   - **Evacuation:** Reduces expected casualties based on evacuation radius and coverage (%).  
   
   Users can save **A/B scenarios** and see deltas in affected population, estimated deaths, and radius sizes.

5. **Population & Data Layers (Planned/Partial)**  
   Population exposure is computed via a backend endpoint that aggregates counts within the **severe/major/light** radii (Eurostat GISCO/WorldPop planned). Until those layers are fully integrated, exposure values are illustrative.
   
---

## 🤖 AI Use Disclosure
We used **ChatGPT (OpenAI GPT-5)** as a development assistant to accelerate our workflow and improve implementation clarity.  
Specifically, AI was used to:
- Provide structural guidance for integrating a 3D globe using **Three.js** and **React**  
- Suggest example class structures and reusable UI component patterns  
- Refactor repetitive logic and improve code readability  

All AI-generated outputs were **reviewed, modified, and verified** by the team before integration.  
No AI-generated **images**, **videos**, or **NASA-branded materials** were used.  

---

## Important Notices 
- Any AI-generated code or documentation is clearly acknowledged in this repository.  
- **API keys and sensitive credentials** must remain private.
- This simulation is **illustrative only**, not a physically validated model.  
  It is designed for **educational and outreach** purposes.  
- Data sources include **NASA NeoWs**, **USGS Earthquake Feed**, and **Eurostat GISCO Population Grids** under respective open-data licenses.

---

## Future Enhancements
- Integration of **Eurostat population heatmaps** for demographic risk estimation  
- **Live NEO trajectory visualization** using NASA’s NeoWs extended feed  
- Implementation of **physics-based thermal and shockwave propagation models**  
- **Offline and classroom modes** for educational demonstrations  

---

## Team
**Challenge:** Meteor Madness — *NASA Space Apps Challenge 2025*  

| Member | GitHub |
|---------|--------|
| **Buse Okcu** | [@bussyyr](https://github.com/bussyyr) |
| **Furkan Doğan** | [@sozialnomad](https://github.com/SozialNomad) |

**Acknowledgments:**  
- NASA Open Data APIs  
- USGS Earthquake Feed  
- Eurostat GISCO Population Grids  

---

© 2025 **Impactor-2025** — Open-source educational project created for the NASA Space Apps Challenge.  
This repository aims to promote planetary defense awareness and interactive science communication.  
