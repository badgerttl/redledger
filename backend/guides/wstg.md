# OWASP Web Security Testing Guide (WSTG) v4.2

The OWASP Web Security Testing Guide is the premier framework for web application security testing. It provides a comprehensive methodology covering 12 testing categories and 96 individual test cases.

> This guide can be updated from the latest OWASP source using the **Update from Online** button.

---

## Testing Categories

### 1. Information Gathering (WSTG-INFO)
Enumerate the target's attack surface: search engine footprinting, web server fingerprinting, application entry points, and leakage of sensitive information through HTTP headers, metadata, and source code.

### 2. Configuration & Deployment Management (WSTG-CONF)
Review network and application configuration, file extensions, HTTP methods, HTTP Strict Transport Security (HSTS), and the security posture of third-party components.

### 3. Identity Management (WSTG-IDNT)
Assess the account provisioning process, role definitions, and username enumeration vectors.

### 4. Authentication (WSTG-ATHN)
Test credential transport, default credentials, account lockout, password policy, authentication bypass, browser cache weaknesses, and multi-factor authentication.

### 5. Authorization (WSTG-ATHZ)
Test for directory traversal, privilege escalation, insecure direct object references (IDOR), and OAuth authorization flaws.

### 6. Session Management (WSTG-SESS)
Analyze session token entropy, cookie attributes, CSRF protections, session fixation, exposed session variables, and logout behavior.

### 7. Input Validation (WSTG-INPV)
Test for reflected/stored/DOM XSS, HTTP injection, SQL injection, LDAP injection, ORM injection, XML injection, SSI injection, XPath injection, IMAP/SMTP injection, code injection, path traversal, buffer overflows, and HTTP splitting/smuggling.

### 8. Error Handling (WSTG-ERRH)
Verify that application errors do not expose stack traces, internal paths, database schemas, or other sensitive information.

### 9. Cryptography (WSTG-CRYP)
Assess weak TLS configurations, padding oracle vulnerabilities, and sensitive data transmitted or stored without adequate encryption.

### 10. Business Logic (WSTG-BUSL)
Test business logic data validation, ability to forge requests, integrity checks, process timing, function use limits, workflow bypasses, and defenses against application misuse.

### 11. Client-Side Testing (WSTG-CLNT)
Test DOM-based XSS, JavaScript execution, HTML injection, client-side URL redirect, CSS injection, client-side resource manipulation, CORS, clickjacking, WebSockets, web messaging, browser storage, and cross-site script inclusion.

### 12. API Testing (WSTG-APIT)
GraphQL-specific testing: introspection, batching attacks, injection, and authorization checks on API endpoints.

---

## Testing Approach

### Black Box
Test with no prior knowledge of the application. Simulate an external attacker.

### Grey Box
Test with partial knowledge (API documentation, low-privilege account). Simulates an authenticated user or partner.

### White Box
Full knowledge of source code, architecture, and infrastructure. Most thorough coverage.

---

## Quick Reference

| Phase | Tests |
|---|---|
| Information Gathering | 10 |
| Configuration & Deployment | 12 |
| Identity Management | 4 |
| Authentication | 10 |
| Authorization | 4 |
| Session Management | 8 |
| Input Validation | 19 |
| Error Handling | 2 |
| Cryptography | 4 |
| Business Logic | 9 |
| Client-Side | 14 |
| API Testing | 1 |

---

## Resources

- [OWASP WSTG on GitHub](https://github.com/OWASP/wstg)
- [OWASP Testing Guide v4.2 PDF / Releases](https://github.com/OWASP/wstg/releases)
- [WSTG Checklists (spreadsheet & markdown)](https://github.com/OWASP/wstg/tree/master/checklists)
