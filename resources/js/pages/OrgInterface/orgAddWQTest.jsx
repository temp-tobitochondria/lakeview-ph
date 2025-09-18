import React, { useMemo } from "react";
import WQTestWizard from "../../components/water-quality-test/WQTestWizard";

/**
 * IMPORTANT: Route-level layout (DashboardLayout) should wrap this page.
 * Do NOT wrap this component with DashboardLayout here to avoid double chrome.
 */

export default function OrgAddWQTest() {
  const organization = useMemo(() => ({ id: 10, name: "Sample LGU / ENRO" }), []);
  const lakeGeoms = useMemo(() => ({}), []); // plug real GeoJSON per lake later

  return (
    <div className="dashboard-content">
      <div className="dashboard-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 className="page-title">Add Water Quality Test</h2>
          <p className="page-subtitle">
            Full-page wizard (LayerWizard style). Frontend-only for now; Submit emits a payload to wire later.
          </p>
        </div>
      </div>

      <WQTestWizard
        organization={organization}
        lakeGeoms={lakeGeoms}
        onSubmit={(payload) => {
          console.log("[WQTestWizard] submit", payload);
          alert("Draft saved locally. Check console for the payload.");
        }}
      />
    </div>
  );
}
