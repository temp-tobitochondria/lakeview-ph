import React from "react";
import Modal from "../Modal";
import PreviewMap from "./PreviewMap";

export default function LayerPreviewModal({
  open,
  onClose,
  layer,
  geometry,
  viewport,
  viewportVersion = 0
}) {
  const color = layer?.body_type === 'watershed' ? '#16a34a' : '#2563eb';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={layer?.name ? `Layer: ${layer.name}` : 'Layer Preview'}
      width={900}
      ariaLabel="Layer Preview"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '80vh' }}>
        {geometry ? (
          <PreviewMap
            geometry={geometry}
            color={color}
            viewport={viewport}
            viewportVersion={viewportVersion}
          />
        ) : (
          <div style={{
            height: 420,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fafafa',
            color: '#6b7280',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ padding: 20, textAlign: 'center' }}>
              No geometry available for this layer.
            </div>
          </div>
        )}

        <div style={{ marginTop: 0 }}>
          {layer && layer.name && (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Previewing {layer.name}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}