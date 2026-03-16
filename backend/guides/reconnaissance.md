# Reconnaissance

## Objectives
Gather as much information as possible about the target without directly interacting with it (passive) or with minimal direct interaction (active).

## Passive Reconnaissance

### OSINT
- **Search engine dorking** — Use Google, Bing, DuckDuckGo with operators like `site:`, `inurl:`, `filetype:`, `intitle:`
- **Shodan / Censys** — Search for exposed services, banners, and certificates
- **theHarvester** — Collect emails, subdomains, IPs from public sources
- **Maltego** — Visual link analysis and OSINT aggregation

### DNS & Domain
- **WHOIS lookup** — `whois target.com` — registrant info, name servers, dates
- **DNS enumeration** — `dig`, `nslookup`, `dnsenum`, `dnsrecon`
- **Subdomain enumeration** — `subfinder`, `amass`, `assetfinder`, `sublist3r`
- **Certificate transparency** — `crt.sh`, `certspotter`

### Social & People
- **LinkedIn** — Identify employees, roles, tech stack hints
- **GitHub / GitLab** — Search for leaked credentials, internal code, config files
- **Pastebin / breach databases** — Check for leaked data related to the target

## Active Reconnaissance

- **Banner grabbing** — `nc`, `curl`, `nmap -sV` to identify running services
- **Web crawling** — `hakrawler`, `gospider`, `katana`
- **WAF detection** — `wafw00f`
- **Technology fingerprinting** — `whatweb`, `wappalyzer`, `builtwith`

## Key Tools

| Tool | Purpose |
|------|---------|
| `amass` | Subdomain enumeration |
| `theHarvester` | Email, subdomain, IP collection |
| `recon-ng` | OSINT framework |
| `subfinder` | Fast subdomain discovery |
| `shodan` | Internet-wide service search |
| `dnsenum` | DNS enumeration |
| `whatweb` | Web technology fingerprinting |

## Tips
- Always start passive before going active
- Document everything as you go — IP ranges, subdomains, emails
- Cross-reference findings across multiple tools
- Check for acquisitions and related companies — they may share infrastructure
