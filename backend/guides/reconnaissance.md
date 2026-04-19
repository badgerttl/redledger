# Reconnaissance

## Objectives
Gather as much information as possible about the target without directly interacting with it (passive) or with minimal direct interaction (active). Build a complete picture of the attack surface before touching anything.

## Passive Reconnaissance

### OSINT

- **Google dorking** — Combine operators for targeted results:
  ```
  site:target.com filetype:pdf
  site:target.com inurl:admin OR inurl:login OR inurl:portal
  site:target.com intitle:"index of"
  site:target.com ext:sql OR ext:bak OR ext:env OR ext:config
  "target.com" "password" site:pastebin.com
  ```
- **Shodan / Censys** — Search for exposed services, banners, and TLS certificates
- **theHarvester** — Collect emails, subdomains, IPs from public sources
- **Maltego** — Visual link analysis and OSINT aggregation

### DNS & Domain

```bash
# WHOIS — registrant info, nameservers, dates
whois target.com

# Basic DNS lookups
dig target.com ANY +noall +answer
dig target.com MX +short
dig target.com NS +short
nslookup -type=ANY target.com

# Zone transfer attempt (often fails but always try)
dig axfr target.com @ns1.target.com
dnsrecon -d target.com -t axfr

# Full DNS enumeration
dnsrecon -d target.com -t std,brt,axfr,bing,yand,crt
dnsenum --enum target.com -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -o dnsenum_output.txt

# Subdomain enumeration (run multiple tools, combine output)
subfinder -d target.com -all -recursive -o subfinder.txt
amass enum -passive -d target.com -o amass.txt
assetfinder --subs-only target.com | anew subdomains.txt
cat subfinder.txt amass.txt | sort -u | anew subdomains.txt

# Resolve live subdomains
cat subdomains.txt | dnsx -a -resp -o resolved.txt
```

### Certificate Transparency

```bash
# Enumerate subdomains from TLS certificates
curl -s "https://crt.sh/?q=%.target.com&output=json" | jq -r '.[].name_value' | sed 's/\*\.//g' | sort -u | anew subdomains.txt

# Certspotter API
curl -s "https://api.certspotter.com/v1/issuances?domain=target.com&include_subdomains=true&expand=dns_names" | jq -r '.[].dns_names[]' | sort -u

# Use tlsx to enumerate certs on discovered IPs
cat resolved.txt | tlsx -san -cn -silent | anew certs.txt
```

### Cloud & Infrastructure Discovery

```bash
# Shodan queries (use shodan CLI: pip install shodan)
shodan search 'org:"Target Company"' --fields ip_str,port,hostnames
shodan search 'ssl.cert.subject.cn:target.com' --fields ip_str,port
shodan search 'http.title:"Target Login" hostname:target.com'
shodan host 10.10.10.1

# Censys (use censys CLI: pip install censys)
censys search 'parsed.subject_dn: "O=Target Company"' --index-type hosts

# Cloud bucket discovery
cloud_enum -k target -k target.com -l cloud_enum.txt --disable-azure --brute
python3 s3scanner.py --buckets-file wordlist.txt

# Manual bucket checks
curl -s https://target.s3.amazonaws.com/ | xmllint --format -
curl -s "https://storage.googleapis.com/target/"
curl -s "https://target.blob.core.windows.net/?comp=list"

# ASN / IP range discovery
# Find ASN:
curl -s "https://api.bgpview.io/search?query_term=Target+Company" | jq '.data.asns[].asn'
# Then get prefixes:
curl -s "https://api.bgpview.io/asn/12345/prefixes" | jq -r '.data.ipv4_prefixes[].prefix'
```

### GitHub / GitLab OSINT

```bash
# TruffleHog — scan GitHub org for secrets
trufflehog github --org=TargetOrg --only-verified
trufflehog git https://github.com/target/repo --only-verified

# gitleaks — scan a local clone for secrets in history
git clone https://github.com/target/repo && cd repo
gitleaks detect --source=. -v --log-opts="--all"

# Manual dorks (run in browser)
# site:github.com "target.com" password
# site:github.com "target.com" api_key
# site:github.com "target.com" secret_key
# site:github.com "target.com" connectionString
# site:github.com "target.com" .env

# Scan commit history for secrets in already-cloned repo
git log --all -p | grep -iE "(password|passwd|secret|api_key|token|apikey)" | head -50

# Check CI/CD files for hardcoded credentials
find . -name "*.yml" -path "*/.github/*" | xargs grep -iE "(password|secret|token|key)" 2>/dev/null
```

### Social & People Recon

```bash
# theHarvester — aggregate emails, subdomains, IPs
theHarvester -d target.com -b google,bing,linkedin,yahoo,hunter,urlscan -l 500 -f harvester_output

# Hunter.io API (get email format)
curl "https://api.hunter.io/v2/domain-search?domain=target.com&api_key=YOUR_KEY" | jq '.data.emails[].value'
```

- **LinkedIn** — Search company employees, identify IT/DevOps/Security staff, note technologies from job postings ("experience with Kubernetes, Terraform, CrowdStrike")
- **Pastebin / breach databases** — Check HaveIBeenPwned, DeHashed, IntelligenceX for leaked credentials

## Active Reconnaissance

### Banner Grabbing & Fingerprinting

```bash
# Netcat banner grab
nc -nv 10.10.10.1 80
nc -nv 10.10.10.1 22

# curl — grab headers and identify tech
curl -sI https://target.com | grep -iE "(server|x-powered-by|x-aspnet|content-type|location)"

# whatweb — web technology fingerprinting
whatweb -a 3 https://target.com
whatweb -a 3 -U "Mozilla/5.0" https://target.com --log-json=whatweb.json

# wafw00f — WAF detection
wafw00f -a https://target.com

# nmap service version detection (targeted)
nmap -sV -sC -p 80,443,8080,8443 --script=http-headers,http-title,http-server-header target.com
```

### Web Crawling & Endpoint Discovery

```bash
# katana — fast crawler
katana -u https://target.com -d 5 -jc -ef png,jpg,gif,css,woff -o katana_urls.txt

# hakrawler
echo "https://target.com" | hakrawler -d 3 -insecure | tee hakrawler.txt

# gospider
gospider -s https://target.com -o gospider_out -c 20 -d 5 --js --sitemap --robots

# Extract unique endpoints from all crawlers
cat katana_urls.txt hakrawler.txt gospider_out/* | sort -u | grep "target.com" | anew all_urls.txt

# gau — fetch known URLs from Wayback Machine, Common Crawl, OTX
gau target.com | anew all_urls.txt

# Filter for juicy endpoints
cat all_urls.txt | grep -iE "\.(php|asp|aspx|jsp|action|do|cgi|json|xml|yaml|env|bak|sql|log)$"
cat all_urls.txt | grep -iE "(admin|login|upload|api|config|backup|debug|test|staging)"
```

### Virtual Host & Subdomain Probing

```bash
# Probe resolved subdomains for live HTTP services
cat subdomains.txt | httpx -status-code -title -tech-detect -follow-redirects -threads 50 -o live_web.txt

# Virtual host fuzzing
ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt \
  -u https://target.com -H "Host: FUZZ.target.com" \
  -fc 404,301 -t 50 -o vhost_ffuf.json -of json
```

## Key Tools

| Tool | Purpose | Install |
|------|---------|---------|
| `amass` | Subdomain enumeration (passive + active) | `apt install amass` |
| `subfinder` | Fast passive subdomain discovery | `go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest` |
| `dnsx` | Fast DNS resolution and probing | `go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest` |
| `theHarvester` | Email, subdomain, IP collection | `apt install theharvester` |
| `recon-ng` | Modular OSINT framework | `apt install recon-ng` |
| `shodan` | Internet-wide service search | `pip install shodan` |
| `trufflehog` | Git secret scanning | `brew install trufflesecurity/trufflehog/trufflehog` |
| `gitleaks` | Git repo secret detection | `apt install gitleaks` |
| `whatweb` | Web technology fingerprinting | `apt install whatweb` |
| `wafw00f` | WAF detection | `pip install wafw00f` |
| `katana` | Web crawler | `go install github.com/projectdiscovery/katana/cmd/katana@latest` |
| `gau` | Fetch URLs from Wayback, CC, OTX | `go install github.com/lc/gau/v2/cmd/gau@latest` |
| `anew` | Append unique lines (dedup) | `go install github.com/tomnomnom/anew@latest` |
| `cloud_enum` | Cloud bucket discovery | `pip install cloud-enum` |

## Extended OSINT Techniques

### GreyNoise & Threat Intelligence

```bash
# GreyNoise — distinguish legitimate services from scanners
curl -s "https://api.greynoise.io/v3/community/10.10.10.1" -H "key: YOUR_API_KEY"

# Shodan for historical data on IPs
shodan host 10.10.10.1 --history
```

### Leaked Credential Databases

- **DeHashed** — `https://dehashed.com` — search email/domain/username for breached data
- **IntelligenceX** — `https://intelx.io` — pastes, darkweb, breaches
- **HaveIBeenPwned API** — Check if employee emails are in known breaches
- **Breach-Parse** — If you have raw breach data locally: `grep -i "@target.com" breach_data.txt`

### Useful One-Liners

```bash
# Combine subfinder + httpx + nuclei for rapid initial assessment
subfinder -d target.com -silent | httpx -silent | nuclei -t exposures/ -severity high,critical -o nuclei_initial.txt

# Find subdomains, resolve, screenshot all
subfinder -d target.com -all -silent | dnsx -silent | httpx -screenshot -o screenshots/ -silent

# Full passive recon pipeline
subfinder -d target.com -all | anew subdomains.txt && \
  curl -s "https://crt.sh/?q=%.target.com&output=json" | jq -r '.[].name_value' | sed 's/\*\.//g' | anew subdomains.txt && \
  cat subdomains.txt | dnsx -a -resp -silent | anew resolved.txt && \
  cat resolved.txt | httpx -status-code -title -tech-detect -o live_hosts.txt
```

## Tips

- Always start passive before going active — passive recon leaves no logs
- Document everything in real time — IP ranges, subdomains, emails, technology stack
- Cross-reference findings across multiple tools — no single tool covers everything
- Check acquired/subsidiary companies — they often share infrastructure and may be less secured
- Use `anew` to accumulate unique findings across tool runs without duplicates
- Commit all discovered assets to scope before moving to scanning
- Old subdomains pointing to cloud services may be vulnerable to subdomain takeover — check with `subjack` or `nuclei -t takeovers/`

## RedLedger Workflow
1. Add discovered subdomains as **Assets → Web Page** type (target = full URL)
2. Add discovered IP ranges to **Scope → Scope Entries** (type: cidr)
3. Log key findings in **Activity Log** with phase = Reconnaissance
4. Paste theHarvester/amass output into **Tool Output** for reference
