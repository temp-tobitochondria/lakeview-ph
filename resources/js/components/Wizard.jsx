// resources/js/components/Wizard.jsx
import React, { useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

/**
 * Wizard
 * - Reusable stepper for multi-step flows.
 *
 * Props:
 * - steps: Array<{
 *     key: string;
 *     title: string;
 *     render: (ctx: {data, setData, stepIndex}) => React.ReactNode;
 *     canNext?: (data) => boolean;     // optional gate before going next
 *   }>
 * - initialData?: any                 // shared cross-step state
 * - initialStep?: number              // default 0
 * - onFinish?: (data) => void         // called on final "Finish"
 * - labels?: { back?, next?, finish? }
 *
 * Usage:
 * <Wizard steps={[...]} onFinish={(data)=>{}} />
 */
export default function Wizard({
  steps,
  initialData = {},
  initialStep = 0,
  onFinish,
  labels = { back: "Back", next: "Next", finish: "Finish" },
}) {
  const [stepIndex, setStepIndex] = useState(initialStep);
  const [data, setData] = useState(initialData);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const current = useMemo(() => steps[stepIndex] || null, [steps, stepIndex]);
  const canGoNext = useMemo(() => {
    if (!current) return false;
    if (typeof current.canNext === "function") return !!current.canNext(data);
    return true; // default: allow
  }, [current, data]);

  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (!canGoNext) return;
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  };
  const finish = () => {
    if (!canGoNext) return;
    onFinish?.(data);
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="dashboard-card" style={{ marginBottom: 12 }}>
        <div className="dashboard-card-header">
          <div className="dashboard-card-title">
            <span>Wizard</span>
          </div>
        </div>
        <div className="wizard-steps">
          {steps.map((s, idx) => {
            const state = idx === stepIndex ? "active" : idx < stepIndex ? "done" : "";
            return (
              <div key={s.key} className={`wizard-step ${state}`}>
                <span className="step-index">{idx + 1}</span>
                <span className="step-label">{s.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      {current && current.render({ data, setData, stepIndex })}

      {/* Nav */}
      <div className="wizard-nav">
        <button className="pill-btn" disabled={isFirst} onClick={goPrev}>
          <FiChevronLeft /> <span className="hide-sm">{labels.back}</span>
        </button>
        <div style={{ flex: 1 }} />
        {!isLast ? (
          <button className="pill-btn primary" disabled={!canGoNext} onClick={goNext}>
            <span className="hide-sm">{labels.next}</span> <FiChevronRight />
          </button>
        ) : (
          <button className="pill-btn primary" disabled={!canGoNext} onClick={finish}>
            {labels.finish}
          </button>
        )}
      </div>
    </div>
  );
}
