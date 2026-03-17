# Site Reviewer

Review all HTML output for quality, brand consistency, and correctness.

## Context

Wheat sprints produce HTML artifacts in `output/`, `research/`, and `site/` directories. The grainulation brand uses a dark theme. Per project rules, no emojis are allowed in any apps, sites, or CLI output.

## Instructions

### Step 1: Detect HTML files

Starting from the current working directory, find all HTML files in `output/`, `research/`, and `site/` directories. List all files found with their paths.

### Step 2: Check for emojis

Scan every HTML file for Unicode emoji characters (ranges U+1F600-U+1F64F, U+1F300-U+1F5FF, U+1F680-U+1F6FF, U+1F900-U+1F9FF, U+2600-U+26FF, U+2700-U+27BF, and common emoji like U+2764, U+2728, U+2705, U+274C). Report each occurrence with file path, line number, and the offending character. This is a hard rule violation.

### Step 3: Check brand consistency

For each HTML file, verify:

- Uses dark background (check for `#0a0a0a`, `#111`, `#1a1a1a`, `rgb(10,10,10)`, or similar dark values, or references grainulation-tokens.css)
- Font stack includes a monospace or system font (no random Google Fonts)
- No bright white `#ffffff` backgrounds on main content areas
- Consistent use of brand colors if grainulation-tokens.css exists

Report deviations with file path and the specific issue.

### Step 4: Validate internal links

For each HTML file, extract all `href` and `src` attributes that point to local files (not http/https). Verify the referenced file exists relative to the HTML file location. Report broken links with the source file and the missing target.

### Step 5: Check meta tags and titles

For each HTML file, verify:

- Has a `<title>` tag with non-empty content
- Has `<meta charset>` (should be utf-8)
- Has `<meta name="viewport">` for responsive support
- Has `<meta name="description">` (warn if missing, not an error)

Report missing tags per file.

### Step 6: Report

Print a structured report:

```
SITE REVIEW REPORT
===================

Files scanned: N

VIOLATIONS (must fix)
---------------------
(emoji occurrences, broken links)

WARNINGS (should fix)
---------------------
(brand deviations, missing meta tags)

INFO
----
(summary statistics)
```

If all files pass, state: "All HTML files pass review. No issues found."
