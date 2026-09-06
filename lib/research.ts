export const researchQuestions = [
  "How can 3D-printed tooling use staged or compliant deformation to form and release re-entrant / undercut geometries with the simple vertical motion of a manual hydraulic press?",
  "How can sequential multimaterial forming combine rigid pre-forming, compliant displacement, constrained forming, undercut formation, and calibration?",
  "How do tool material, internal print geometry, confinement, press sequence, and sheet material interact to redirect material flow beyond the press axis?",
];

export const atlasGroups = [
  {
    code: "01",
    title: "Forming Methods",
    items: ["Rigid tooling", "Compliant tooling", "Sequential / multi-stage forming", "Localized deformation", "Calibration / restrike"],
  },
  {
    code: "02",
    title: "Materials",
    items: ["Thin metal", "Aluminum", "Paper / sheet fiber", "Other test sheets"],
  },
  {
    code: "03",
    title: "Tool Systems",
    items: ["PLA rigid tools", "TPU compliant tools", "Hybrid rigid + soft tools", "Printed internal compliance", "Confinement / side restraint"],
  },
  {
    code: "04",
    title: "Geometric Operations",
    items: ["Pre-form", "Draw", "Emboss", "Return", "Re-entrant form", "Undercut", "Calibration"],
  },
  {
    code: "05",
    title: "Observed Behaviors",
    items: ["Material flow", "Springback", "Wrinkling", "Thinning", "Tearing", "Tool deformation", "Surface marking"],
  },
  {
    code: "06",
    title: "Research Sources",
    items: ["Historical forming precedents", "Contemporary rapid tooling", "3D-printed press tooling", "Material suppliers", "Videos / process demonstrations"],
  },
];

export const processSequence = [
  "Flat sheet",
  "Rigid pre-form",
  "Constrained form",
  "Compliant / redirected displacement",
  "Undercut / re-entrant geometry",
  "Calibration",
];
