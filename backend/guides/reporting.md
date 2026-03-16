# Reporting

## Objectives
Communicate findings clearly to both technical and non-technical audiences. Provide actionable remediation guidance.

## Report Structure

### Executive Summary
- High-level overview for management and stakeholders
- Overall risk rating
- Key statistics (number of findings by severity)
- Critical findings highlighted
- Recommendations summary

### Scope and Methodology
- What was tested (IPs, domains, applications)
- What was excluded
- Testing methodology (OWASP, PTES, OSSTMM)
- Tools used
- Testing timeline

### Findings
Each finding should include:
- **Title** — Clear, descriptive name
- **Severity** — Critical / High / Medium / Low / Info with CVSS score
- **Description** — What the vulnerability is
- **Impact** — What an attacker could do with this vulnerability
- **Evidence** — Screenshots, tool output, request/response pairs
- **Affected Assets** — Which systems are impacted
- **Remediation** — Specific steps to fix the issue
- **References** — CVE numbers, OWASP links, vendor advisories

### Appendices
- Full tool output (nmap scans, vulnerability scanner results)
- Credentials found (redacted as appropriate)
- Methodology checklist completion

## Severity Ratings

| Severity | CVSS Range | Description |
|----------|-----------|-------------|
| Critical | 9.0 - 10.0 | Immediate exploitation possible, full system compromise |
| High | 7.0 - 8.9 | Significant impact, exploitation likely |
| Medium | 4.0 - 6.9 | Moderate impact, some conditions required |
| Low | 0.1 - 3.9 | Minor impact, difficult to exploit |
| Info | 0.0 | Best practice recommendations, no direct risk |

## Writing Tips
- Write for your audience — executives want business impact, engineers want technical details
- Be specific in remediation — "update Apache" is not helpful; "update Apache HTTP Server to version 2.4.58+ to address CVE-2023-XXXXX" is
- Include proof — every finding needs evidence (screenshots, request/response)
- Prioritize — order findings by severity so the most critical issues are addressed first
- Be professional — avoid inflammatory language; state facts objectively
- Proofread — typos and formatting issues undermine credibility

## Using This Tool for Reporting
1. Ensure all findings are entered with complete descriptions, impact, and remediation
2. Attach evidence screenshots to each finding
3. Verify scope information is accurate
4. Complete the methodology checklists to show coverage
5. Go to the Report page and generate your report
6. Review and customize the generated Markdown before delivering
