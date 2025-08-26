// src/components/ScreenshotButton.jsx
import React from "react";
import { FiCamera } from "react-icons/fi";
import domtoimage from "dom-to-image";

function ScreenshotButton() {
  const handleScreenshot = () => {
    const mapContainer = document.querySelector(".leaflet-container");

    // Select overlays to hide
    const overlays = document.querySelectorAll(
      ".search-bar, .coordinates-scale, .layer-control, .map-controls, .screenshot-btn, .leaflet-control-container"
    );
    overlays.forEach((el) => (el.style.display = "none"));

    domtoimage.toBlob(mapContainer).then((blob) => {
      // Download image
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "map-screenshot.png";
      link.click();

      // Restore overlays
      overlays.forEach((el) => (el.style.display = ""));
    });
  };

  return (
    <div className="screenshot-btn">
      <button className="btn-floating" onClick={handleScreenshot}>
        <FiCamera className="icon-layer" />
      </button>
    </div>
  );
}

export default ScreenshotButton;