# Reporting

## Objectives
Communicate findings clearly to both technical and non-technical audiences. Provide actionable, specific remediation guidance. Every finding must be reproducible from your report alone.

## Report Structure

### Executive Summary
- High-level overview for management and stakeholders — no technical jargon
- Overall risk rating with brief justification
- Key statistics: total findings by severity (Critical / High / Medium / Low / Info)
- Business impact of the most critical findings
- Recommendations summary and overall security posture assessment

### Scope and Methodology
- What was tested: IPs, CIDR ranges, domains, applications, cloud accounts
- What was explicitly excluded from testing
- Testing methodology referenced (OWASP Testing Guide, PTES, OSSTMM, NIST SP 800-115)
- Testing window: start date, end date, hours
- Tools used (list major tools)
- Tester(s) and point of contact

### Findings
Each finding must include:

| Field | Description |
|---|---|
| **Title** | Clear, specific name (e.g., "Unauthenticated SQL Injection in User Search Endpoint") |
| **Severity** | Critical / High / Medium / Low / Info |
| **CVSS Score** | v3.1 base score with vector string (e.g., `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`) |
| **CVE Reference** | CVE number if applicable (use RedLedger CVE Lookup to auto-populate) |
| **Description** | What the vulnerability is and why it exists |
| **Impact** | Specific business impact — what an attacker can actually do |
| **Evidence** | Screenshots, request/response pairs, tool output |
| **Affected Assets** | Specific URLs, IPs, hostnames, service versions |
| **Remediation** | Specific, actionable fix — not generic advice |
| **References** | CVE links, OWASP category, vendor advisories, CWE |

### Appendices
- Full nmap scan output
- Nuclei / vulnerability scanner results
- BloodHound attack path screenshots (for AD engagements)
- Credentials found (redacted — show format, not value)
- Methodology checklist completion
- Testing limitations and client-imposed restrictions

## Severity Ratings

| Severity | CVSS v3.1 | Color | Description |
|----------|-----------|-------|-------------|
| Critical | 9.0 – 10.0 | Red | Immediate exploitation possible, full system or data compromise, no user interaction required |
| High | 7.0 – 8.9 | Orange | Significant impact, exploitation straightforward, likely to be actively targeted |
| Medium | 4.0 – 6.9 | Yellow | Moderate impact, some conditions required (auth, specific config, user interaction) |
| Low | 0.1 – 3.9 | Blue | Minor impact, difficult to exploit in isolation, useful in attack chains |
| Info | 0.0 | Grey | Best practice / hardening recommendation, no direct exploitability |

## CVSS v3.1 Quick Reference

CVSS v3.1 base score = 8 metrics across Exploitability and Impact dimensions.

**Exploitability:** Attack Vector (AV) / Attack Complexity (AC) / Privileges Required (PR) / User Interaction (UI)

**Impact:** Scope (S) / Confidentiality (C) / Integrity (I) / Availability (A)

**Common finding scores:**

| Finding | CVSS Vector | Score |
|---------|-------------|-------|
| Unauthenticated SQLi (network) | AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H | 9.8 Critical |
| Default credentials (admin access) | AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H | 9.8 Critical |
| RCE via file upload (auth required) | AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H | 8.8 High |
| SSRF (internal network access) | AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N | 8.6 High |
| XXE (file read, unauth) | AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N | 7.5 High |
| Auth-required IDOR | AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N | 7.1 High |
| Local privilege escalation | AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H | 7.8 High |
| Reflected XSS | AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N | 6.1 Medium |
| Stored XSS (auth required) | AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N | 5.4 Medium |
| Kerberoasting (valid user) | AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:H | 7.5 High |

Use the **CVE Lookup** in Finding Detail to auto-populate CVSS from NVD for known CVEs.

## Writing Good Findings

### Title
Be specific: **"SQL Injection in `/api/v1/users` Search Parameter"** not **"SQL Injection Found"**

### Description
```
The `search` parameter in the `/api/v1/users` endpoint is not properly sanitised before being
interpolated into a SQL query. An attacker can manipulate the query to extract data from any
table in the database, bypass authentication, or (depending on database configuration) execute
operating system commands.

Affected endpoint: GET https://target.com/api/v1/users?search=
Database: MySQL 8.0.32
```

### Impact
Write concrete business impact — not just the technical consequence:
```
An unauthenticated attacker can extract the full contents of the application database, including
customer records containing names, email addresses, and hashed passwords. Depending on database
user permissions, an attacker may also be able to write files to disk or execute operating system
commands, leading to full server compromise.
```

### Evidence
Include the minimum reproducible proof:
```
Request:
GET /api/v1/users?search=admin'+AND+SLEEP(5)--+- HTTP/1.1
Host: target.com

Response: HTTP 200 OK (response time: 5.012 seconds — confirms time-based blind SQLi)

[Screenshot: 10.10.10.1_sqli_timebased_2024-01-15.png]
```

### Remediation
Be specific — not "sanitise inputs":
```
Use parameterised queries (prepared statements) for all database interactions. Do not construct
SQL queries via string concatenation.

Example (Python/SQLAlchemy):
  # Vulnerable:   query = f"SELECT * FROM users WHERE name = '{search}'"
  # Fixed:        db.execute("SELECT * FROM users WHERE name = :s", {"s": search})

Additionally, restrict the database user to minimum required permissions (SELECT only where
writes are not needed). Apply a WAF rule as secondary defence-in-depth.
```

## Writing Tips

- Write for your audience — executives want business impact; engineers want exact reproduction steps
- One finding per vulnerability class per location — don't bundle separate issues
- Be specific in remediation — "update to Apache 2.4.58" is actionable; "update your software" is not
- Include proof for every finding — unreproducible findings get deprioritised or disputed
- Prioritise — order findings by severity so critical issues appear first
- Be objective — state facts, not opinions; avoid inflammatory language
- Avoid passive voice — "An attacker can extract" not "Data could potentially be obtained"
- Check all version numbers, CVE references, and URLs before delivering

## Executive Summary Template

```
This [internal / external / web application / red team] assessment was conducted against
[client name]'s [scope description] between [start date] and [end date].

The assessment identified [N] security findings: [N_critical] Critical, [N_high] High,
[N_medium] Medium, [N_low] Low, and [N_info] Informational.

[N_critical] Critical and [N_high] High severity findings present an immediate risk of
[business impact — e.g., "unauthorised access to all customer records",
"full compromise of the internal network"].

Key findings include:
• [Finding 1 title] — [one sentence business impact]
• [Finding 2 title] — [one sentence business impact]
• [Finding 3 title] — [one sentence business impact]

Immediate remediation is recommended for all Critical and High findings.
[Summary of overall security posture].
```

## Evidence Naming Convention

`<HOST_OR_APP>_<VULN_SHORT>_<DATE>.<ext>`

**Examples:**
- `10.10.10.1_sqli_dump_2024-01-15.png`
- `webapp_xss_stored_admin_cookie_2024-01-15.png`
- `dc01_dcsync_secretsdump_2024-01-16.txt`
- `10.10.10.1_rce_whoami_proof_2024-01-15.png`

**Folder structure during engagement:**
```
evidence/
├── screenshots/
├── tool_output/
│   ├── nmap_full_10.10.10.1.txt
│   └── sqlmap_10.10.10.1.txt
└── requests/
    └── sqli_burp_request.txt
```

## Remediation Prioritisation Matrix

| Priority | Criteria | Recommended Timeline |
|---|---|---|
| **P1 — Immediate** | Critical CVSS ≥ 9.0; actively exploitable with no auth; data already exposed; RCE/SQLi/default creds | 24–72 hours |
| **P2 — Urgent** | High CVSS 7.0–8.9; significant business impact; exploitation straightforward | 1–2 weeks |
| **P3 — Standard** | Medium CVSS 4.0–6.9; requires some conditions (auth, specific config) | 1 month |
| **P4 — Planned** | Low / Info; hardening recommendations; defence-in-depth improvements | Next release cycle |

## Common Finding Titles (Reference)

| Category | Example Title |
|---|---|
| SQLi | SQL Injection in `[endpoint]` `[parameter]` Parameter |
| XSS | Stored Cross-Site Scripting in `[feature]` |
| SSRF | Server-Side Request Forgery in `[endpoint]` |
| XXE | XML External Entity Injection in `[endpoint]` |
| LFI | Local File Inclusion via `[parameter]` Parameter |
| Auth | Broken Access Control — Horizontal Privilege Escalation in `[feature]` |
| Auth | Authentication Bypass via `[method]` |
| Crypto | Sensitive Data Transmitted Over Unencrypted HTTP |
| Config | Directory Listing Enabled on `[path]` |
| Config | Default Credentials on `[service]` (`[host]`) |
| Config | SMB Signing Not Required — NTLM Relay Possible |
| AD | Kerberoastable Service Account with Weak Password |
| AD | AS-REP Roasting — Pre-Authentication Not Required for `[account]` |
| AD | Unconstrained Delegation Enabled on `[host]` |
| Infra | Outdated `[software]` `[version]` — `[CVE]` |

## Using This Tool for Reporting
1. Ensure all findings are entered with complete descriptions, impact, and remediation
2. Attach evidence screenshots to each finding
3. Verify scope information is accurate
4. Complete the methodology checklists to show coverage
5. Go to the **Report** page and generate your report — choose Markdown, HTML, or PDF
6. Review and customize the generated report before delivering
7. For HTML/PDF: the report is styled and print-ready; customize the Markdown version for deeper edits
