import React from "react";
import { Download } from "lucide-react";
import { ResumeData } from "../types";

interface CVBuilderProps {
  resumeData: ResumeData;
  companyName: string;
  lang: "sv" | "en";
}

const generatePrintableHTML = (resumeData: ResumeData, lang: "sv" | "en"): string => {
  const { name, targetRole, contact, summary, experience, skills, education, certifications, languages, achievements } = resumeData;
  const isSv = lang === "sv";

  const labels = {
    summary: isSv ? "Profil" : "Professional Summary",
    experience: isSv ? "Erfarenhet" : "Professional Experience",
    skills: isSv ? "Kompetenser" : "Skills",
    education: isSv ? "Utbildning" : "Education",
    certs: isSv ? "Certifieringar" : "Certifications",
    langs: isSv ? "Språk" : "Languages",
    achievements: isSv ? "Prestationer" : "Key Achievements",
    technical: isSv ? "Teknisk" : "Technical",
    tools: isSv ? "Verktyg & Plattformar" : "Tools & Platforms",
    soft: isSv ? "Kompetenser" : "Competencies",
  };

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} – Resume</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Arial', 'Helvetica Neue', sans-serif;
    font-size: 10.5pt;
    color: #1a1a2e;
    background: #fff;
    line-height: 1.45;
  }
  @page { size: A4; margin: 14mm 17mm 14mm 17mm; }

  /* ── HEADER ── */
  .cv-header {
    background: linear-gradient(135deg, #1a365d 0%, #2a4a7f 100%);
    color: #fff;
    padding: 20px 22px 16px;
    margin-bottom: 16px;
  }
  .cv-name {
    font-size: 22pt;
    font-weight: 800;
    letter-spacing: -0.4px;
    line-height: 1.1;
  }
  .cv-role {
    font-size: 11pt;
    color: #90cdf4;
    font-weight: 600;
    margin-top: 4px;
  }
  .cv-contacts {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 9px;
    font-size: 8.5pt;
    color: #bee3f8;
  }
  .cv-contacts span { display: flex; align-items: center; gap: 4px; }

  /* ── SECTION ── */
  .section { margin-bottom: 13px; }
  .section-title {
    font-size: 7.5pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.6px;
    color: #1a365d;
    border-bottom: 1.5px solid #2b6cb0;
    padding-bottom: 3px;
    margin-bottom: 8px;
  }

  /* ── SUMMARY ── */
  .summary-text {
    font-size: 10pt;
    color: #2d3748;
    line-height: 1.65;
    text-align: justify;
  }

  /* ── EXPERIENCE ── */
  .exp-item { margin-bottom: 9px; page-break-inside: avoid; }
  .exp-row { display: flex; justify-content: space-between; align-items: flex-start; }
  .exp-company { font-weight: 700; font-size: 10.5pt; color: #1a202c; }
  .exp-role { font-size: 10pt; color: #276749; font-style: italic; }
  .exp-meta { font-size: 8.5pt; color: #718096; text-align: right; white-space: nowrap; margin-left: 10px; }
  .exp-bullets { margin-top: 4px; padding-left: 15px; }
  .exp-bullets li {
    font-size: 9.5pt;
    color: #2d3748;
    margin-bottom: 2px;
    line-height: 1.45;
  }

  /* ── SKILLS ── */
  .skills-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .skill-cat-label { font-size: 8pt; font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
  .skill-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .skill-tag {
    font-size: 8pt;
    padding: 2px 7px;
    border-radius: 3px;
    font-weight: 500;
  }
  .tag-tech { background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; }
  .tag-tools { background: #faf5ff; color: #6b46c1; border: 1px solid #e9d8fd; }
  .tag-soft { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

  /* ── EDUCATION ── */
  .edu-item { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .edu-degree { font-weight: 600; font-size: 10pt; color: #1a202c; }
  .edu-inst { font-size: 9pt; color: #4a5568; }
  .edu-year { font-size: 9pt; color: #718096; white-space: nowrap; margin-left: 8px; }

  /* ── TWO-COL ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  /* ── LISTS ── */
  .plain-list { list-style: none; padding: 0; }
  .plain-list li {
    font-size: 9.5pt;
    color: #2d3748;
    padding: 1.5px 0 1.5px 12px;
    position: relative;
    line-height: 1.45;
  }
  .plain-list li::before { content: "▸"; position: absolute; left: 0; color: #2b6cb0; font-size: 8pt; top: 3px; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .cv-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }

  /* Print button (hidden on print) */
  .print-bar {
    text-align: center;
    padding: 12px;
    background: #f7fafc;
    border-bottom: 1px solid #e2e8f0;
  }
  .print-btn {
    background: #2b6cb0;
    color: #fff;
    border: none;
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .print-btn:hover { background: #2c5282; }
</style>
</head>
<body>

<div class="print-bar no-print">
  <button class="print-btn" onclick="window.print()">🖨 Save as PDF / Print</button>
</div>

<div class="cv-header">
  <div class="cv-name">${escapeHtml(name)}</div>
  <div class="cv-role">${escapeHtml(targetRole)}</div>
  <div class="cv-contacts">
    ${contact.email ? `<span>✉&nbsp;${escapeHtml(contact.email)}</span>` : ""}
    ${contact.phone ? `<span>📞&nbsp;${escapeHtml(contact.phone)}</span>` : ""}
    ${contact.location ? `<span>📍&nbsp;${escapeHtml(contact.location)}</span>` : ""}
    ${contact.linkedin ? `<span>in&nbsp;${escapeHtml(contact.linkedin)}</span>` : ""}
    ${contact.website ? `<span>🌐&nbsp;${escapeHtml(contact.website)}</span>` : ""}
  </div>
</div>

<div style="padding: 0 4px;">

${summary ? `
<div class="section">
  <div class="section-title">${labels.summary}</div>
  <div class="summary-text">${escapeHtml(summary)}</div>
</div>` : ""}

${experience && experience.length > 0 ? `
<div class="section">
  <div class="section-title">${labels.experience}</div>
  ${experience.map(exp => `
  <div class="exp-item">
    <div class="exp-row">
      <div>
        <div class="exp-company">${escapeHtml(exp.company)}</div>
        <div class="exp-role">${escapeHtml(exp.role)}${exp.location ? ` &nbsp;·&nbsp; ${escapeHtml(exp.location)}` : ""}</div>
      </div>
      <div class="exp-meta">${escapeHtml(exp.period)}</div>
    </div>
    ${exp.bullets && exp.bullets.length > 0 ? `
    <ul class="exp-bullets">
      ${exp.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join("")}
    </ul>` : ""}
  </div>`).join("")}
</div>` : ""}

${(skills.technical?.length > 0 || skills.tools?.length > 0 || skills.soft?.length > 0) ? `
<div class="section">
  <div class="section-title">${labels.skills}</div>
  <div class="skills-grid">
    ${skills.technical?.length > 0 ? `
    <div>
      <div class="skill-cat-label">${labels.technical}</div>
      <div class="skill-tags">${skills.technical.map(s => `<span class="skill-tag tag-tech">${escapeHtml(s)}</span>`).join("")}</div>
    </div>` : ""}
    ${skills.tools?.length > 0 ? `
    <div>
      <div class="skill-cat-label">${labels.tools}</div>
      <div class="skill-tags">${skills.tools.map(s => `<span class="skill-tag tag-tools">${escapeHtml(s)}</span>`).join("")}</div>
    </div>` : ""}
    ${skills.soft?.length > 0 ? `
    <div>
      <div class="skill-cat-label">${labels.soft}</div>
      <div class="skill-tags">${skills.soft.map(s => `<span class="skill-tag tag-soft">${escapeHtml(s)}</span>`).join("")}</div>
    </div>` : ""}
  </div>
</div>` : ""}

${education && education.length > 0 ? `
<div class="section">
  <div class="section-title">${labels.education}</div>
  ${education.map(edu => `
  <div class="edu-item">
    <div>
      <div class="edu-degree">${escapeHtml(edu.degree)}</div>
      <div class="edu-inst">${escapeHtml(edu.institution)}${edu.gpa ? ` &nbsp;·&nbsp; GPA ${escapeHtml(edu.gpa)}` : ""}</div>
    </div>
    <div class="edu-year">${escapeHtml(edu.year)}</div>
  </div>`).join("")}
</div>` : ""}

${(certifications?.length > 0 || languages?.length > 0) ? `
<div class="two-col">
  ${certifications?.length > 0 ? `
  <div class="section">
    <div class="section-title">${labels.certs}</div>
    <ul class="plain-list">${certifications.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
  </div>` : ""}
  ${languages?.length > 0 ? `
  <div class="section">
    <div class="section-title">${labels.langs}</div>
    <ul class="plain-list">${languages.map(l => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
  </div>` : ""}
</div>` : ""}

${achievements?.length > 0 ? `
<div class="section">
  <div class="section-title">${labels.achievements}</div>
  <ul class="plain-list">${achievements.map(a => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
</div>` : ""}

</div>
</body>
</html>`;
};

// Simple HTML escaper to prevent XSS in the print window
function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CVBuilder: React.FC<CVBuilderProps> = ({ resumeData, companyName, lang }) => {
  const { name, targetRole, contact, summary, experience, skills, education, certifications, languages, achievements } = resumeData;
  const isSv = lang === "sv";

  const t = {
    downloadPDF: isSv ? "Ladda ner CV som PDF" : "Download Resume as PDF",
    atsNote: isSv ? "ATS-optimerat CV anpassat för" : "ATS-optimized resume tailored for",
    summarySection: isSv ? "Profil" : "Professional Summary",
    experienceSection: isSv ? "Erfarenhet" : "Professional Experience",
    skillsSection: isSv ? "Kompetenser" : "Skills",
    educationSection: isSv ? "Utbildning" : "Education",
    certsSection: isSv ? "Certifieringar" : "Certifications",
    langSection: isSv ? "Språk" : "Languages",
    achieveSection: isSv ? "Prestationer" : "Key Achievements",
    technicalLabel: isSv ? "Teknisk" : "Technical",
    toolsLabel: isSv ? "Verktyg & Plattformar" : "Tools & Platforms",
    softLabel: isSv ? "Kompetenser" : "Competencies",
  };

  const handleDownloadPDF = () => {
    const html = generatePrintableHTML(resumeData, lang);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const printWin = window.open(url, "_blank", "width=860,height=750,scrollbars=yes");
    if (printWin) {
      printWin.addEventListener("load", () => {
        setTimeout(() => {
          printWin.print();
          URL.revokeObjectURL(url);
        }, 600);
      });
    }
  };

  const SectionHeading: React.FC<{ label: string }> = ({ label }) => (
    <h2 className="text-[9px] font-extrabold uppercase tracking-[1.6px] text-blue-900 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800 pb-1.5 mb-3">
      {label}
    </h2>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          {t.atsNote} <strong>{companyName}</strong>
        </div>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow"
        >
          <Download size={14} />
          {t.downloadPDF}
        </button>
      </div>

      {/* ── CV CARD ── */}
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-md overflow-hidden text-sm">

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-700 text-white px-7 py-5">
          <h1 className="text-[22px] font-black tracking-tight leading-tight">{name}</h1>
          <p className="text-blue-200 font-semibold text-[13px] mt-1">{targetRole}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[11px] text-blue-100">
            {contact.email    && <span>✉ {contact.email}</span>}
            {contact.phone    && <span>📞 {contact.phone}</span>}
            {contact.location && <span>📍 {contact.location}</span>}
            {contact.linkedin && <span>in {contact.linkedin}</span>}
            {contact.website  && <span>🌐 {contact.website}</span>}
          </div>
        </div>

        {/* Body */}
        <div className="px-7 py-5 space-y-5">

          {/* Summary */}
          {summary && (
            <section>
              <SectionHeading label={t.summarySection} />
              <p className="text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed text-justify">{summary}</p>
            </section>
          )}

          {/* Experience */}
          {experience && experience.length > 0 && (
            <section>
              <SectionHeading label={t.experienceSection} />
              <div className="space-y-4">
                {experience.map((exp, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-bold text-[13px] text-neutral-900 dark:text-neutral-100">{exp.company}</div>
                        <div className="text-[12px] text-emerald-700 dark:text-emerald-400 italic">
                          {exp.role}{exp.location ? ` · ${exp.location}` : ""}
                        </div>
                      </div>
                      <span className="text-[11px] text-neutral-400 whitespace-nowrap shrink-0">{exp.period}</span>
                    </div>
                    {exp.bullets && exp.bullets.length > 0 && (
                      <ul className="mt-2 pl-4 space-y-1">
                        {exp.bullets.map((b, j) => (
                          <li key={j} className="text-[12px] text-neutral-600 dark:text-neutral-400 list-disc leading-snug">{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Skills */}
          {(skills.technical?.length > 0 || skills.tools?.length > 0 || skills.soft?.length > 0) && (
            <section>
              <SectionHeading label={t.skillsSection} />
              <div className="grid grid-cols-3 gap-4">
                {skills.technical?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-2">{t.technicalLabel}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.technical.map((s, i) => (
                        <span key={i} className="text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {skills.tools?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-2">{t.toolsLabel}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.tools.map((s, i) => (
                        <span key={i} className="text-[11px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-100 dark:border-purple-800 font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {skills.soft?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-2">{t.softLabel}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.soft.map((s, i) => (
                        <span key={i} className="text-[11px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800 font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Education */}
          {education && education.length > 0 && (
            <section>
              <SectionHeading label={t.educationSection} />
              <div className="space-y-2">
                {education.map((edu, i) => (
                  <div key={i} className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">{edu.degree}</div>
                      <div className="text-[11px] text-neutral-500">{edu.institution}{edu.gpa ? ` · GPA ${edu.gpa}` : ""}</div>
                    </div>
                    <span className="text-[11px] text-neutral-400 whitespace-nowrap shrink-0">{edu.year}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Certs + Languages */}
          {(certifications?.length > 0 || languages?.length > 0) && (
            <div className="grid grid-cols-2 gap-6">
              {certifications?.length > 0 && (
                <section>
                  <SectionHeading label={t.certsSection} />
                  <ul className="space-y-1">
                    {certifications.map((c, i) => (
                      <li key={i} className="text-[12px] text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                        <span className="text-blue-500 mt-0.5 shrink-0">▸</span>{c}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {languages?.length > 0 && (
                <section>
                  <SectionHeading label={t.langSection} />
                  <ul className="space-y-1">
                    {languages.map((l, i) => (
                      <li key={i} className="text-[12px] text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-0.5 shrink-0">▸</span>{l}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {/* Achievements */}
          {achievements?.length > 0 && (
            <section>
              <SectionHeading label={t.achieveSection} />
              <ul className="space-y-1">
                {achievements.map((a, i) => (
                  <li key={i} className="text-[12px] text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5 shrink-0">★</span>{a}
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>
      </div>
    </div>
  );
};

export default CVBuilder;
