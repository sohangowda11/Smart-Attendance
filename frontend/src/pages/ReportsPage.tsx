import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import {
  FileSpreadsheet, FileText, Download, CheckCircle2,
  Calendar, BookOpen, Filter, ArrowRight
} from 'lucide-react';
import { reportsApi, academicApi } from '../services/api';
import { Department, Subject } from '../services/types';

export const ReportsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | undefined>();
  const [selectedSubj, setSelectedSubj] = useState<number | undefined>();
  const [selectedSem, setSelectedSem] = useState<number>(6);
  const [title, setTitle] = useState('Department Attendance Audit & Disbarment Report');

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [excelGenerating, setExcelGenerating] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [generatedExcelUrl, setGeneratedExcelUrl] = useState<string | null>(null);

  useEffect(() => {
    loadMetadata();
  }, [selectedDept]);

  const loadMetadata = async () => {
    try {
      const [deptData, subjData] = await Promise.all([
        academicApi.getDepartments(),
        academicApi.getSubjects({ department_id: selectedDept }),
      ]);
      setDepartments(deptData);
      setSubjects(subjData);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGeneratePdf = async () => {
    setPdfGenerating(true);
    setGeneratedPdfUrl(null);
    try {
      const res = await reportsApi.generatePdf({
        department_id: selectedDept,
        subject_id: selectedSubj,
        semester: selectedSem,
        title: title,
      });
      setGeneratedPdfUrl(res.report_url);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to generate PDF report');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleGenerateExcel = async () => {
    setExcelGenerating(true);
    setGeneratedExcelUrl(null);
    try {
      const res = await reportsApi.generateExcel({
        department_id: selectedDept,
        subject_id: selectedSubj,
        semester: selectedSem,
        title: title,
      });
      setGeneratedExcelUrl(res.report_url);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to generate Excel export');
    } finally {
      setExcelGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Report Generation & Data Export" breadcrumbs={['Reports', 'Exports']} />

      <main className="flex-1 p-6 sm:p-8 space-y-8 max-w-[1600px] w-full mx-auto">
        {/* Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              INSTITUTIONAL AUDIT DOCUMENTATION
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Attendance Reports & Dossiers
            </h1>
            <p className="text-xs text-synapse-secondary mt-1">
              Generate formatted PDF audit reports for university accreditation and export raw CSV/Excel spreadsheets.
            </p>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="p-8 bg-synapse-surface border border-synapse-border max-w-4xl">
          <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
            REPORT PARAMETERS & SCOPE
          </span>

          <div className="mt-6 space-y-5 font-mono text-xs">
            <div>
              <label className="block text-synapse-secondary uppercase mb-2">
                Report Document Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-synapse-elevated border border-synapse-border px-4 py-3 text-white focus:border-synapse-pink focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-synapse-secondary uppercase mb-1">
                  Department Filter
                </label>
                <select
                  value={selectedDept || ''}
                  onChange={(e) => setSelectedDept(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-synapse-secondary uppercase mb-1">
                  Subject Focus
                </label>
                <select
                  value={selectedSubj || ''}
                  onChange={(e) => setSelectedSubj(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
                >
                  <option value="">Cumulative (All Courses)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-synapse-secondary uppercase mb-1">
                  Semester
                </label>
                <select
                  value={selectedSem}
                  onChange={(e) => setSelectedSem(Number(e.target.value))}
                  className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-synapse-border flex flex-wrap items-center gap-4">
              <button
                onClick={handleGeneratePdf}
                disabled={pdfGenerating}
                className="px-6 py-3 bg-synapse-pink text-white font-mono uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                <span>{pdfGenerating ? 'Generating PDF...' : 'Generate Formatted PDF'}</span>
              </button>

              <button
                onClick={handleGenerateExcel}
                disabled={excelGenerating}
                className="px-6 py-3 bg-synapse-surface border border-synapse-border hover:border-synapse-yellow text-white font-mono uppercase font-semibold hover:text-synapse-yellow transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{excelGenerating ? 'Exporting...' : 'Export Spreadsheet (.xlsx)'}</span>
              </button>
            </div>
          </div>

          {/* Generated download links */}
          {(generatedPdfUrl || generatedExcelUrl) && (
            <div className="mt-8 p-4 bg-synapse-elevated border border-emerald-500/40 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Report Ready for Download:</span>
              </div>

              {generatedPdfUrl && (
                <div className="flex items-center justify-between">
                  <span className="text-white">PDF Institutional Audit Report</span>
                  <a
                    href={generatedPdfUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-synapse-pink text-white font-bold flex items-center gap-1.5 hover:bg-synapse-softpink transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </a>
                </div>
              )}

              {generatedExcelUrl && (
                <div className="flex items-center justify-between">
                  <span className="text-white">Excel Attendance Ledger Data</span>
                  <a
                    href={generatedExcelUrl}
                    download
                    className="px-3 py-1.5 bg-synapse-yellow text-black font-bold flex items-center gap-1.5 hover:bg-yellow-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download XLSX</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

