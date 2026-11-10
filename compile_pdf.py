# -*- coding: utf-8 -*-
"""
Compiles the complete SYNAPSE Technical Documentation HTML & PDF
"""
import os
import sys
import subprocess
import fitz

from doc_sections_part1 import get_cover_and_section1_3
from doc_sections_part2 import get_sections4_8
from doc_sections_part3 import get_sections9_12
from doc_sections_part4 import get_sections13_15

HTML_PATH = r"d:\B Vcoding\attend\SYNAPSE_Technical_Documentation.html"
PDF_PATH = r"d:\B Vcoding\attend\SYNAPSE_Technical_Documentation.pdf"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

print("[1/3] Assembling HTML document...")

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SYNAPSE — Complete Technical Documentation &amp; Face Recognition Workflow</title>
<style>
  @page {
    size: A4;
    margin: 14mm 12mm 16mm 12mm;
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 7.5pt;
      color: #71717a;
    }
    @bottom-left {
      content: "SYNAPSE — AI Smart Attendance Technical Report";
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 7.5pt;
      color: #71717a;
    }
  }

  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    color: #18181b;
    background: #ffffff;
    line-height: 1.5;
    font-size: 9.5pt;
    margin: 0;
    padding: 0;
  }

  .cover {
    page-break-after: always;
    min-height: 90vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 30px 10px;
    border-bottom: 3px solid #ff168b;
  }

  .cover-badge {
    display: inline-block;
    align-self: flex-start;
    padding: 4px 12px;
    background: #18181b;
    color: #efff00;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 20px;
    border-left: 4px solid #ff168b;
  }

  .cover h1 {
    font-size: 25pt;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #09090b;
    margin: 0 0 12px 0;
    line-height: 1.15;
    text-transform: uppercase;
  }

  .cover h1 span.pink {
    color: #ff168b;
  }

  .cover h2 {
    font-size: 12pt;
    font-weight: 500;
    color: #52525b;
    margin: 0 0 24px 0;
    line-height: 1.4;
    border: none;
    padding: 0;
  }

  .cover-meta {
    margin-top: 30px;
    padding: 16px 20px;
    background: #f4f4f5;
    border-left: 4px solid #18181b;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    font-size: 8.5pt;
    font-family: 'JetBrains Mono', Consolas, monospace;
  }

  .cover-meta div strong {
    color: #09090b;
    text-transform: uppercase;
  }

  h1.section-title {
    page-break-before: always;
    font-size: 16pt;
    font-weight: 800;
    color: #09090b;
    border-bottom: 2px solid #ff168b;
    padding-bottom: 5px;
    margin-top: 20px;
    margin-bottom: 14px;
    text-transform: uppercase;
    letter-spacing: -0.01em;
  }

  h2 {
    font-size: 12pt;
    font-weight: 700;
    color: #18181b;
    margin-top: 18px;
    margin-bottom: 8px;
    border-left: 3px solid #ff168b;
    padding-left: 8px;
  }

  h3 {
    font-size: 10pt;
    font-weight: 700;
    color: #27272a;
    margin-top: 12px;
    margin-bottom: 6px;
  }

  p {
    margin: 0 0 8px 0;
    text-align: justify;
  }

  ul, ol {
    margin: 0 0 10px 0;
    padding-left: 18px;
  }

  li {
    margin-bottom: 3px;
  }

  code, pre {
    font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  }

  code {
    background: #f4f4f5;
    color: #e11d48;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 8pt;
    border: 1px solid #e4e4e7;
  }

  pre {
    background: #09090b;
    color: #fafafa;
    padding: 10px 12px;
    border-radius: 4px;
    font-size: 7.5pt;
    overflow-x: auto;
    border-left: 3px solid #efff00;
    margin: 8px 0 12px 0;
    line-height: 1.4;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px 0;
    font-size: 8pt;
  }

  table th {
    background: #18181b;
    color: #ffffff;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 6px 8px;
    border: 1px solid #27272a;
    text-align: left;
  }

  table td {
    padding: 5px 8px;
    border: 1px solid #e4e4e7;
    vertical-align: top;
  }

  table tr:nth-child(even) td {
    background: #fafafa;
  }

  .callout {
    padding: 10px 12px;
    border-radius: 4px;
    margin: 12px 0;
    font-size: 8.5pt;
    line-height: 1.45;
  }

  .callout-info {
    background: #f0fdf4;
    border-left: 4px solid #16a34a;
    color: #166534;
  }

  .callout-warning {
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    color: #92400e;
  }

  .callout-danger {
    background: #fff1f2;
    border-left: 4px solid #ff168b;
    color: #9f1239;
  }

  .callout strong {
    display: block;
    font-weight: 700;
    margin-bottom: 3px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .formula-box {
    background: #fafafa;
    border: 1px solid #e4e4e7;
    border-left: 3px solid #ff168b;
    padding: 8px 12px;
    margin: 10px 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.5pt;
  }

  .diagram-container {
    margin: 14px 0 16px 0;
    text-align: center;
    background: #fafafa;
    border: 1px solid #e4e4e7;
    padding: 10px;
    border-radius: 4px;
  }

  .diagram-caption {
    font-size: 7.5pt;
    font-family: 'JetBrains Mono', monospace;
    color: #71717a;
    margin-top: 5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .qa-card {
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-left: 3px solid #ff168b;
    padding: 8px 12px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }

  .qa-q {
    font-weight: 700;
    color: #09090b;
    font-size: 9pt;
    margin-bottom: 4px;
  }

  .qa-q span {
    color: #ff168b;
    font-family: 'JetBrains Mono', monospace;
    margin-right: 4px;
  }

  .qa-a {
    color: #27272a;
    font-size: 8.5pt;
    line-height: 1.45;
  }
</style>
</head>
<body>
""" + get_cover_and_section1_3() + get_sections4_8() + get_sections9_12() + get_sections13_15()

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"HTML successfully generated at: {HTML_PATH} ({len(html_content):,} bytes)")

print("[2/3] Compiling HTML to PDF via Chrome Headless...")
chrome_cmd = [
    CHROME_PATH,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    f"--print-to-pdf={PDF_PATH}",
    "--no-pdf-header-footer",
    HTML_PATH
]

res = subprocess.run(chrome_cmd, capture_output=True, text=True)
if res.returncode != 0:
    print(f"Error executing Chrome: {res.stderr}")
    sys.exit(1)

print("[3/3] Inspecting generated PDF document...")
if not os.path.exists(PDF_PATH):
    print("Error: PDF was not generated!")
    sys.exit(1)

doc = fitz.open(PDF_PATH)
page_count = len(doc)
file_size_kb = os.path.getsize(PDF_PATH) / 1024.0

print("=" * 70)
print("  SYNAPSE TECHNICAL DOCUMENTATION PDF COMPILED SUCCESSFULLY!")
print(f"  • File Location: {PDF_PATH}")
print(f"  • Total Pages:   {page_count} Pages")
print(f"  • Document Size: {file_size_kb:.1f} KB")
print("=" * 70)
doc.close()

