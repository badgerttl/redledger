# Reconnaissance

Reconnaissance builds the working map for the rest of the assessment. Start passive, move to light active probing only when authorized, and keep the output organized enough that it can become scope entries, assets, tool output, and report evidence later.

## Objectives

- Confirm authorization, scope boundaries, exclusions, testing windows, credentials, and stop-test contacts.
- Build a target inventory from domains, IP ranges, ASNs, subsidiaries, cloud assets, applications, and identity surfaces.
- Discover public exposure without generating unnecessary target-side traffic.
- Prioritize the attack surface before moving into scanning and enumeration.

## Operator Flow

| Step | Goal | Output |
|------|------|--------|
| 1 | Confirm scope and rules of engagement | Authorized target list and constraints |
| 2 | Build seed inventory | Domains, brands, ASNs, IP ranges, subsidiaries |
| 3 | Collect passive DNS and certificate data | Subdomains and related hostnames |
| 4 | Search public exposure | Indexed pages, exposed services, cloud assets |
| 5 | Review people, identity, and source code | Emails, usernames, leaked secrets, SSO hints |
| 6 | Light active probing | Live hosts, web titles, technologies, banners |
| 7 | Prioritize next steps | Ranked assets for scanning and enumeration |

## Passive Reconnaissance

Passive recon should produce a broad target list without touching the client environment directly. Use multiple sources and deduplicate aggressively.

### OSINT Search

Use search operators to find indexed files, admin paths, backups, exposed configuration, and third-party references.

```text
site:target.com filetype:pdf
site:target.com inurl:admin OR inurl:login OR inurl:portal
site:target.com intitle:"index of"
site:target.com ext:sql OR ext:bak OR ext:env OR ext:config
"target.com" "password" site:pastebin.com
```

Other useful sources:

- **Shodan / Censys** - exposed services, banners, historical fingerprints, and TLS certificates.
- **theHarvester** - emails, subdomains, IPs, and public source aggregation.
- **Maltego** - visual link analysis for organizations, domains, people, and infrastructure.

### Domain Registration

Use registrar and nameserver data to identify ownership, legacy domains, authoritative DNS, and adjacent infrastructure.

```bash
whois target.com
```

### DNS Baseline

Collect core DNS records before deeper subdomain work. Keep the raw output because it often explains later routing, mail, or takeover findings.

```bash
dig target.com ANY +noall +answer
dig target.com MX +short
dig target.com NS +short
nslookup -type=ANY target.com
```

### Zone Transfer Checks

Zone transfers usually fail, but a single misconfigured nameserver can expose the full internal or external DNS map.

```bash
dig axfr target.com @ns1.target.com
dnsrecon -d target.com -t axfr
```

### DNS Enumeration Workflow

Run standard, brute-force, search-engine, and certificate-backed enumeration. Compare outputs from multiple tools instead of trusting one source.

```bash
dnsrecon -d target.com -t std,brt,axfr,bing,yand,crt
dnsenum --enum target.com -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -o dnsenum_output.txt
```

### Subdomain Discovery Workflow

Collect passive results first, then combine and deduplicate into a single working file.

```bash
subfinder -d target.com -all -recursive -o subfinder.txt
amass enum -passive -d target.com -o amass.txt
assetfinder --subs-only target.com | anew subdomains.txt
cat subfinder.txt amass.txt | sort -u | anew subdomains.txt
```

### Resolve Live Subdomains

Resolution turns a noisy hostname list into assets you can prioritize and probe.

```bash
cat subdomains.txt | dnsx -a -resp -o resolved.txt
```

### Certificate Transparency

Certificate transparency logs are often the fastest path to forgotten environments, wildcard certs, staging systems, and newly launched apps.

```bash
curl -s "https://crt.sh/?q=%.target.com&output=json" | jq -r '.[].name_value' | sed 's/\*\.//g' | sort -u | anew subdomains.txt
```

```bash
curl -s "https://api.certspotter.com/v1/issuances?domain=target.com&include_subdomains=true&expand=dns_names" | jq -r '.[].dns_names[]' | sort -u
```

Use `tlsx` against discovered IPs and hosts to pull certificate common names and subject alternative names.

```bash
cat resolved.txt | tlsx -san -cn -silent | anew certs.txt
```

### Internet-Wide Scan Sources

Shodan and Censys help identify exposed services, hostnames, certificates, and unmanaged assets before you scan anything yourself.

```bash
shodan search 'org:"Target Company"' --fields ip_str,port,hostnames
shodan search 'ssl.cert.subject.cn:target.com' --fields ip_str,port
shodan search 'http.title:"Target Login" hostname:target.com'
shodan host 10.10.10.1
```

```bash
censys search 'parsed.subject_dn: "O=Target Company"' --index-type hosts
```

### ASN and IP Range Discovery

Use ASN data to identify owned or associated netblocks. Validate ownership before adding ranges to scope.

```bash
curl -s "https://api.bgpview.io/search?query_term=Target+Company" | jq '.data.asns[].asn'
```

```bash
curl -s "https://api.bgpview.io/asn/12345/prefixes" | jq -r '.data.ipv4_prefixes[].prefix'
```

### Cloud and Infrastructure Discovery

Look for public storage, cloud-hosted apps, tenant names, metadata exposure paths, and provider-specific hostnames.

```bash
cloud_enum -k target -k target.com -l cloud_enum.txt --disable-azure --brute
python3 s3scanner.py --buckets-file wordlist.txt
```

Manual bucket checks are useful for quick validation and screenshots.

```bash
curl -s https://target.s3.amazonaws.com/ | xmllint --format -
curl -s "https://storage.googleapis.com/target/"
curl -s "https://target.blob.core.windows.net/?comp=list"
```

### GitHub and GitLab OSINT

Search source repositories for secrets, internal hostnames, deployment scripts, CI/CD variables, API keys, and environment files.

```bash
trufflehog github --org=TargetOrg --only-verified
trufflehog git https://github.com/target/repo --only-verified
```

```bash
git clone https://github.com/target/repo && cd repo
gitleaks detect --source=. -v --log-opts="--all"
```

Manual repository dorks are still valuable when tools miss context.

```text
site:github.com "target.com" password
site:github.com "target.com" api_key
site:github.com "target.com" secret_key
site:github.com "target.com" connectionString
site:github.com "target.com" .env
```

Search commit history and CI/CD files in already-cloned repositories.

```bash
git log --all -p | grep -iE "(password|passwd|secret|api_key|token|apikey)" | head -50
find . -name "*.yml" -path "*/.github/*" | xargs grep -iE "(password|secret|token|key)" 2>/dev/null
```

### Social and People Recon

People and identity recon helps identify username formats, email patterns, SSO providers, technologies, and likely password-spray targets.

```bash
theHarvester -d target.com -b google,bing,linkedin,yahoo,hunter,urlscan -l 500 -f harvester_output
```

Use Hunter.io or similar sources to confirm email formats when authorized.

```bash
curl "https://api.hunter.io/v2/domain-search?domain=target.com&api_key=YOUR_KEY" | jq '.data.emails[].value'
```

Additional people-focused sources:

- **LinkedIn** - employees, IT/DevOps/Security staff, job postings, and technology hints such as Kubernetes, Terraform, CrowdStrike, Okta, or Azure.
- **Pastebin / breach databases** - HaveIBeenPwned, DeHashed, and IntelligenceX for leaked credentials and exposed usernames.

## Active Reconnaissance

Active recon should be deliberate and aligned with the rules of engagement. The goal is to verify live assets, identify technologies, and prepare for scanning without overreaching.

### Banner Grabbing

Use direct banner checks sparingly for quick service confirmation.

```bash
nc -nv 10.10.10.1 80
nc -nv 10.10.10.1 22
```

### HTTP Header and Technology Fingerprinting

Headers and web fingerprints often reveal frameworks, load balancers, reverse proxies, cookies, and security controls.

```bash
curl -sI https://target.com | grep -iE "(server|x-powered-by|x-aspnet|content-type|location)"
```

```bash
whatweb -a 3 https://target.com
whatweb -a 3 -U "Mozilla/5.0" https://target.com --log-json=whatweb.json
```

### WAF Detection

WAF detection helps tune later scanning and payload testing.

```bash
wafw00f -a https://target.com
```

### Targeted Nmap Fingerprinting

Use targeted service scripts when you already know the relevant ports.

```bash
nmap -sV -sC -p 80,443,8080,8443 --script=http-headers,http-title,http-server-header target.com
```

### Web Crawling

Run multiple crawlers because each one finds different routes, JavaScript paths, forms, and historical endpoints.

```bash
katana -u https://target.com -d 5 -jc -ef png,jpg,gif,css,woff -o katana_urls.txt
```

```bash
echo "https://target.com" | hakrawler -d 3 -insecure | tee hakrawler.txt
```

```bash
gospider -s https://target.com -o gospider_out -c 20 -d 5 --js --sitemap --robots
```

### Endpoint Collection

Combine crawler output with historical URL sources such as Wayback Machine, Common Crawl, and OTX.

```bash
cat katana_urls.txt hakrawler.txt gospider_out/* | sort -u | grep "target.com" | anew all_urls.txt
gau target.com | anew all_urls.txt
```

### Interesting Endpoint Filters

Filter for routes likely to expose sensitive files, API behavior, upload paths, administrative panels, and debug functionality.

```bash
cat all_urls.txt | grep -iE "\.(php|asp|aspx|jsp|action|do|cgi|json|xml|yaml|env|bak|sql|log)$"
cat all_urls.txt | grep -iE "(admin|login|upload|api|config|backup|debug|test|staging)"
```

### Live Web Probing

Probe discovered hostnames for reachable HTTP services, titles, redirects, and detected technologies.

```bash
cat subdomains.txt | httpx -status-code -title -tech-detect -follow-redirects -threads 50 -o live_web.txt
```

### Virtual Host Fuzzing

Use virtual host fuzzing to find hidden name-based applications on known infrastructure.

```bash
ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt \
  -u https://target.com -H "Host: FUZZ.target.com" \
  -fc 404,301 -t 50 -o vhost_ffuf.json -of json
```

## Rapid Pipelines

Use these when you need quick initial coverage. Save intermediate files so you can review and import the results.

### Initial Exposure Sweep

```bash
subfinder -d target.com -silent | httpx -silent | nuclei -t exposures/ -severity high,critical -o nuclei_initial.txt
```

### Resolve and Screenshot Web Surface

```bash
subfinder -d target.com -all -silent | dnsx -silent | httpx -screenshot -o screenshots/ -silent
```

### Full Passive Recon Pipeline

```bash
subfinder -d target.com -all | anew subdomains.txt && \
  curl -s "https://crt.sh/?q=%.target.com&output=json" | jq -r '.[].name_value' | sed 's/\*\.//g' | anew subdomains.txt && \
  cat subdomains.txt | dnsx -a -resp -silent | anew resolved.txt && \
  cat resolved.txt | httpx -status-code -title -tech-detect -o live_hosts.txt
```

## Extended OSINT Techniques

### GreyNoise and Threat Intelligence

Use threat intelligence to understand whether an exposed IP is a real service, scanner noise, cloud infrastructure, or previously observed suspicious host.

```bash
curl -s "https://api.greynoise.io/v3/community/10.10.10.1" -H "key: YOUR_API_KEY"
shodan host 10.10.10.1 --history
```

### Leaked Credential Databases

- **DeHashed** - `https://dehashed.com` - search email, domain, or username for breached data.
- **IntelligenceX** - `https://intelx.io` - pastes, dark web sources, and breaches.
- **HaveIBeenPwned API** - check if employee emails appear in known breaches.
- **Breach-Parse** - if you have raw breach data locally, search it safely:

```bash
grep -i "@target.com" breach_data.txt
```

## Key Tools

| Tool | Purpose | Install |
|------|---------|---------|
| `amass` | Subdomain enumeration, passive and active | `apt install amass` |
| `subfinder` | Fast passive subdomain discovery | `go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest` |
| `dnsx` | Fast DNS resolution and probing | `go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest` |
| `theHarvester` | Email, subdomain, and IP collection | `apt install theharvester` |
| `recon-ng` | Modular OSINT framework | `apt install recon-ng` |
| `shodan` | Internet-wide service search | `pip install shodan` |
| `trufflehog` | Git secret scanning | `brew install trufflesecurity/trufflehog/trufflehog` |
| `gitleaks` | Git repository secret detection | `apt install gitleaks` |
| `whatweb` | Web technology fingerprinting | `apt install whatweb` |
| `wafw00f` | WAF detection | `pip install wafw00f` |
| `katana` | Web crawler | `go install github.com/projectdiscovery/katana/cmd/katana@latest` |
| `gau` | Fetch URLs from Wayback, Common Crawl, and OTX | `go install github.com/lc/gau/v2/cmd/gau@latest` |
| `anew` | Append unique lines and deduplicate output | `go install github.com/tomnomnom/anew@latest` |
| `cloud_enum` | Cloud bucket discovery | `pip install cloud-enum` |

## Tips

- Always start passive before going active; passive recon leaves no target-side logs.
- Document everything in real time: IP ranges, subdomains, emails, technology stack, and evidence source.
- Cross-reference findings across multiple tools; no single tool covers everything.
- Check acquired or subsidiary companies because they often share infrastructure and may be less secured.
- Use `anew` to accumulate unique findings across tool runs without duplicates.
- Commit all discovered assets to scope before moving to scanning.
- Old subdomains pointing to cloud services may be vulnerable to subdomain takeover; check with `subjack` or `nuclei -t takeovers/`.

## RedLedger Workflow

1. Add discovered subdomains as **Assets -> Web Page** type with the target set to the full URL.
2. Add discovered IP ranges to **Scope -> Scope Entries** with type `cidr`.
3. Log key findings in **Activity Log** with phase set to **Reconnaissance**.
4. Paste theHarvester, amass, and other raw output into **Tool Output** for reference.

## Checklist Command Reference

These headings intentionally match the Methodology checklist. Checklist links land here because each section demonstrates the commands or concrete workflow for that item.

### Confirm scope and rules of engagement

```bash
cat scope.txt
cat rules_of_engagement.txt
grep -iE "in scope|out of scope|testing window|emergency|stop" rules_of_engagement.txt
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

Record the authorized targets, exclusions, testing window, credentials provided, and emergency contacts before active probing.

### Build target inventory

```bash
printf "target.com\napi.target.com\n10.10.10.0/24\n" > targets_seed.txt
sort -u targets_seed.txt -o targets_seed.txt
cat targets_seed.txt
```

```bash
curl -s "https://api.bgpview.io/search?query_term=Target+Company" | jq '.data.asns[].asn'
curl -s "https://api.bgpview.io/asn/12345/prefixes" | jq -r '.data.ipv4_prefixes[].prefix'
```

### WHOIS and registrar lookup

```bash
whois target.com
dig target.com NS +short
dig target.com SOA +short
```

### DNS enumeration

```bash
dig target.com ANY +noall +answer
dig target.com MX +short
dig target.com TXT +short
dnsrecon -d target.com -t std,brt,axfr,bing,yand,crt
dnsenum --enum target.com -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -o dnsenum_output.txt
```

### Subdomain enumeration

```bash
subfinder -d target.com -all -recursive -o subfinder.txt
amass enum -passive -d target.com -o amass.txt
assetfinder --subs-only target.com | anew subdomains.txt
cat subfinder.txt amass.txt | sort -u | anew subdomains.txt
cat subdomains.txt | dnsx -a -resp -o resolved.txt
```

### Certificate transparency search

```bash
curl -s "https://crt.sh/?q=%.target.com&output=json" | jq -r '.[].name_value' | sed 's/\*\.//g' | sort -u | anew subdomains.txt
curl -s "https://api.certspotter.com/v1/issuances?domain=target.com&include_subdomains=true&expand=dns_names" | jq -r '.[].dns_names[]' | sort -u
cat resolved.txt | tlsx -san -cn -silent | anew certs.txt
```

### OSINT - search engine dorking

```text
site:target.com filetype:pdf
site:target.com inurl:admin OR inurl:login OR inurl:portal
site:target.com intitle:"index of"
site:target.com ext:sql OR ext:bak OR ext:env OR ext:config
"target.com" "password" site:pastebin.com
```

### Shodan / Censys search

```bash
shodan search 'org:"Target Company"' --fields ip_str,port,hostnames
shodan search 'ssl.cert.subject.cn:target.com' --fields ip_str,port
shodan search 'http.title:"Target Login" hostname:target.com'
censys search 'parsed.subject_dn: "O=Target Company"' --index-type hosts
```

### Technology fingerprinting

```bash
whatweb -a 3 https://target.com
curl -sI https://target.com | grep -iE "(server|x-powered-by|x-aspnet|content-type|location)"
wafw00f -a https://target.com
nmap -sV -sC -p 80,443,8080,8443 --script=http-headers,http-title,http-server-header target.com
```

### Cloud asset discovery

```bash
cloud_enum -k target -k target.com -l cloud_enum.txt --disable-azure --brute
python3 s3scanner.py --buckets-file wordlist.txt
curl -s https://target.s3.amazonaws.com/ | xmllint --format -
curl -s "https://storage.googleapis.com/target/"
curl -s "https://target.blob.core.windows.net/?comp=list"
```

### Email and identity discovery

```bash
theHarvester -d target.com -b google,bing,linkedin,yahoo,hunter,urlscan -l 500 -f harvester_output
curl "https://api.hunter.io/v2/domain-search?domain=target.com&api_key=YOUR_KEY" | jq '.data.emails[].value'
```

### Social media / LinkedIn research

```text
LinkedIn company search: "Target Company" employees
LinkedIn job search: "Target Company" Kubernetes OR Terraform OR Okta OR Azure
Search notes: names, roles, username formats, technologies, identity providers
```

### GitHub / code repository search

```bash
trufflehog github --org=TargetOrg --only-verified
trufflehog git https://github.com/target/repo --only-verified
git log --all -p | grep -iE "(password|passwd|secret|api_key|token|apikey)" | head -50
find . -name "*.yml" -path "*/.github/*" | xargs grep -iE "(password|secret|token|key)" 2>/dev/null
```

```text
site:github.com "target.com" password
site:github.com "target.com" api_key
site:github.com "target.com" .env
```

### Breach and credential exposure review

```bash
grep -i "@target.com" breach_data.txt
```

Search DeHashed, IntelligenceX, and HaveIBeenPwned for authorized email/domain exposure checks. Record only the source, account, and exposure type unless rules allow storing secret material.

### Prioritize attack surface

```bash
cat live_web.txt nuclei_initial.txt cloud_enum.txt resolved.txt | sort -u > recon_priority_inputs.txt
grep -iE "(admin|login|vpn|sso|jenkins|gitlab|jira|grafana|kibana|staging|dev|backup)" recon_priority_inputs.txt
```

Prioritize internet-facing admin portals, exposed storage, authentication surfaces, high-risk technologies, sensitive hostnames, and assets tied to business-critical systems.
