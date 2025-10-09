import React from "react";
import { FiDatabase } from 'react-icons/fi';

function AboutData() {
  return (
    <div className="content-page" style={{ paddingTop: 4 }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 26, margin: '0 0 14px' }}>
        <FiDatabase /> <span>About the Data</span>
      </h1>
      <p style={{ marginTop: 0, fontSize: 14, lineHeight: 1.55 }}>
        Learn about the origin, processing, and limitations of the datasets powering LakeView PH.
      </p>

      <h2 style={{ fontSize: 18, margin: '30px 0 8px' }}>Data Sources</h2>
      <p className="muted" style={{ lineHeight: 1.55 }}>
        Provide a concise list of data providers (e.g., government hydrological agencies, environmental monitoring groups,
        satellite-derived datasets). Clarify licensing or attribution requirements here.
      </p>

      <h2 style={{ fontSize: 18, margin: '30px 0 8px' }}>Data Processing & Quality</h2>
      <p className="muted" style={{ lineHeight: 1.55 }}>
        Summarize validation steps, cleaning routines, interpolation approaches, and quality control thresholds. Mention how often data is refreshed and any automated anomaly detection.
      </p>

      <h2 style={{ fontSize: 18, margin: '30px 0 8px' }}>Limitations & Caveats</h2>
      <p className="muted" style={{ lineHeight: 1.55 }}>
        Explain temporal gaps, spatial resolution limits, instrument precision, or potential biases. Encourage users to treat outputs as indicative rather than absolute where applicable.
      </p>

      <h2 style={{ fontSize: 18, margin: '30px 0 8px' }}>Methodologies</h2>
      <p className="muted" style={{ lineHeight: 1.55 }}>
        Outline calculation formulas, classification schemes, and modeling techniques. Reference any publicly available technical documentation or peer-reviewed sources.
      </p>

      <h2 style={{ fontSize: 18, margin: '30px 0 8px' }}>Attribution & Licensing</h2>
      <p className="muted" style={{ lineHeight: 1.55 }}>
        Add required attribution statements and links to source licenses. Provide a contact or feedback mechanism for corrections or takedown requests.
      </p>

      <h2 style={{ fontSize: 18, margin: '30px 0 8px' }}>Contact & Feedback</h2>
      <p className="muted" style={{ lineHeight: 1.55, marginBottom: 60 }}>
        Direct users to the feedback form in the sidebar or an email channel for inquiries about data provenance or requests for additional indicators.
      </p>
    </div>
  );
}

export default AboutData;