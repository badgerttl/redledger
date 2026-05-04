# Scanning and Enumeration

Scanning turns the recon target list into a verified technical map. Work from broad discovery to specific service enumeration, save raw output, and only escalate into aggressive checks when they are authorized and useful.

## Objectives

- Discover live hosts and reachable services.
- Identify open TCP/UDP ports, service versions, banners, and exposed technologies.
- Enumerate high-value protocols deeply enough to identify likely attack paths.
- Preserve raw scanner output for import, evidence, and later validation.

## Operator Flow

| Step | Goal | Output |
|------|------|--------|
| 1 | Discover live hosts | `live_hosts.txt`, CIDR notes, reachable IPs |
| 2 | Identify open ports | Full TCP/UDP results and prioritized port list |
| 3 | Fingerprint services | Versions, banners, scripts, TLS, web titles |
| 4 | Enumerate web/API surface | Directories, files, vhosts, params, CMS details |
| 5 | Enumerate core network services | SMB, LDAP, DNS, SMTP, databases, remote admin |
| 6 | Run template and vuln scans | Nuclei/NSE/Nikto results for validation |
| 7 | Import and triage | RedLedger assets, tool output, and prioritized findings |

## Network Scanning

Start with host discovery, then move into port discovery and accurate service fingerprinting. Favor repeatable commands and save output with filenames that include the target or range.

### Host Discovery

Use multiple discovery methods because ICMP is often blocked. ARP is usually best on a local segment; TCP/UDP probes are useful against routed networks.

```bash
# ICMP ping sweep
nmap -sn 10.10.10.0/24 -oG ping_sweep.txt | grep "Up" | awk '{print $2}' > live_hosts.txt

# ARP scan (local network - more reliable than ICMP)
arp-scan -l
arp-scan --interface=eth0 10.10.10.0/24

# TCP SYN ping - works when ICMP is blocked
nmap -sn -PS22,80,443,445,3389 10.10.10.0/24 -oG - | grep Up | awk '{print $2}'

# UDP ping sweep
nmap -sn -PU53,161 10.10.10.0/24
```

### Port Scanning - Recommended Workflow

Use fast scanners for discovery, then let Nmap do accurate service and script-based follow-up on confirmed open ports.

```bash
# Step 1: Fast full port scan with rustscan (seconds vs. minutes)
rustscan -a 10.10.10.1 --ulimit 5000 -r 1-65535 -- -sV -sC -oA rustscan_full

# Step 2: Full TCP scan with nmap (if rustscan unavailable)
nmap -p- -sS --min-rate 5000 -T4 10.10.10.1 -oN tcp_full.txt

# Step 3: Targeted service/version scan on open ports only
nmap -p 22,80,443,445,8080 -sV -sC --script=default,vuln -oA nmap_targeted 10.10.10.1

# UDP scan (slow - top ports only)
nmap -sU -sV --top-ports 50 --min-rate 1000 -oA nmap_udp 10.10.10.1

# Full save in all formats (for RedLedger import)
nmap -p- -sV -sC --min-rate 5000 -oA nmap_full_10.10.10.1 10.10.10.1
```

### Rustscan - Fast Port Discovery

Rustscan is useful when you need quick port discovery before a more complete Nmap scan.

```bash
# Single host - full port range
rustscan -a 10.10.10.1 --ulimit 5000 -- -sV -sC -oA rustscan_out

# CIDR range
rustscan -a 10.10.10.0/24 --ulimit 5000 -- -sV

# List of hosts
rustscan -a hosts.txt --ulimit 5000 -- -sV -oA rustscan_bulk

# Custom batch size (lower = less aggressive)
rustscan -a 10.10.10.1 -b 500 --ulimit 2000 -- -sV -sC
```

### Masscan - Very Fast Scanning

Masscan is extremely noisy. Use it carefully, especially against production ranges, and always follow up with Nmap for reliable version detection.

```bash
# Full port range at high rate (use carefully - very noisy)
masscan 10.10.10.0/24 -p1-65535 --rate=10000 -oG masscan_out.txt

# Extract IPs and ports for nmap follow-up
grep "open" masscan_out.txt | awk '{print $4}' | cut -d'/' -f1 | sort -u > open_ports.txt
grep "open" masscan_out.txt | awk '{print $6}' | cut -d'/' -f1 | sort -u > live_ips.txt

# Targeted masscan + nmap pipeline
masscan 10.10.10.0/24 -p1-65535 --rate=5000 -oL masscan.lst && \
  grep "open" masscan.lst | awk '{print $4}' | sort -u | paste -sd, > open_ports.txt && \
  nmap -p $(cat open_ports.txt) -sV -sC -iL live_ips.txt -oA nmap_masscan_followup
```

## Web Enumeration

Once HTTP services are identified, enumerate content, application routes, virtual hosts, APIs, CMS components, and technology fingerprints.

### Directory and File Brute-Forcing

Run more than one tool when time allows. Each tool handles recursion, filtering, redirects, and extension handling differently.

```bash
# feroxbuster - recursive, fast (recommended)
feroxbuster -u https://target.com -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt \
  -x php,asp,aspx,jsp,txt,html,json,xml,bak,sql,zip,tar,gz \
  -t 50 --depth 3 --status-codes 200,201,204,301,302,307,401,403 \
  -o ferox_output.txt

# ffuf - flexible web fuzzer
ffuf -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt \
  -u https://target.com/FUZZ \
  -t 50 -mc 200,201,204,301,302,307,401,403 \
  -o ffuf_dirs.json -of json

# ffuf with extensions
ffuf -w /usr/share/seclists/Discovery/Web-Content/raft-medium-files-lowercase.txt \
  -u https://target.com/FUZZ \
  -e .php,.aspx,.bak,.sql,.txt,.zip,.env,.config,.xml,.json \
  -mc 200,204,301,302,307,401,403 -t 50 \
  -o ffuf_files.json -of json

# gobuster - directory mode
gobuster dir -u https://target.com \
  -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
  -x php,aspx,txt,html,bak,sql,zip -t 50 --no-error \
  -o gobuster_dirs.txt

# dirsearch - easy, auto-extension detection
dirsearch -u https://target.com -e php,asp,aspx,jsp,txt,html,bak \
  -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt \
  --format json -o dirsearch_output.json
```

### Virtual Host Enumeration

Use virtual host discovery when multiple applications may share an IP address or reverse proxy.

```bash
# ffuf vhost fuzzing
ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt \
  -u https://10.10.10.1 -H "Host: FUZZ.target.com" \
  -fc 404,400 -fs 1234 -t 50 \
  -o vhost_ffuf.json -of json

# gobuster vhost mode
gobuster vhost -u https://target.com \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt \
  --append-domain -t 50 -o gobuster_vhosts.txt
```

### API Route Discovery

API discovery should look for documented routes, hidden routes, parameters, auth boundaries, and versioned endpoints.

```bash
# kiterunner - API route discovery (uses OpenAPI/Swagger wordlists)
kr scan https://target.com/api -w /usr/share/kiterunner/routes-small.kite -t 50 -o kiterunner_out.txt
kr scan https://target.com/api -w /usr/share/kiterunner/routes-large.kite --fail-status-codes 400,401,403,404,405,500 -t 50

# ffuf for API parameter fuzzing
ffuf -w /usr/share/seclists/Discovery/Web-Content/api/objects.txt \
  -u https://target.com/api/v1/FUZZ -t 50 -mc 200,201,204,400,401,403,405 \
  -o ffuf_api.json -of json

# arjun - parameter discovery
arjun -u https://target.com/api/endpoint -m GET -t 10 -oJ arjun_params.json
arjun -u https://target.com/api/endpoint -m POST -t 10 -oJ arjun_post_params.json
```

### CMS Scanning

CMS scanners are useful for plugin/theme/component inventory and known-vulnerability correlation.

```bash
# WordPress
wpscan --url https://target.com --enumerate u,p,t,vp,vt \
  --detection-mode aggressive --plugins-detection aggressive \
  --api-token YOUR_TOKEN -o wpscan_output.txt

# Joomla
joomscan -u https://target.com --ec -o joomscan_output.txt

# Drupal
droopescan scan drupal -u https://target.com -t 32
```

### Web Service Probing - httpx

Use `httpx` to turn raw hostnames or IPs into a live web application inventory with titles, redirects, technologies, and screenshots.

```bash
# Probe for live web services across subdomains
cat subdomains.txt | httpx -status-code -title -tech-detect -follow-redirects \
  -threads 50 -o httpx_live.txt

# Probe specific ports
cat hosts.txt | httpx -ports 80,443,8080,8443,8000,8888,3000,5000,9000 \
  -status-code -title -tech-detect -o httpx_ports.txt

# Filter for interesting technologies
cat subdomains.txt | httpx -tech-detect -silent | grep -iE "(wordpress|jenkins|gitlab|jira|confluence|grafana|kibana|sonarqube|tomcat|spring)"

# Screenshot all live services
cat subdomains.txt | httpx -screenshot -system-chrome -o screenshots/ -silent

# Chain: probe -> nuclei scan
cat subdomains.txt | httpx -silent | nuclei -t exposures/ -severity high,critical -o nuclei_results.txt
```

## Service-Specific Enumeration

Use this table as a quick service-to-tool reference. Follow up with the detailed sections where a service appears important, authenticated access is available, or the scan indicates high-risk exposure.

| Service | Tools / Commands |
|---------|-----------------|
| SMB (445) | `nxc smb target`, `smbclient -L //target -N`, `enum4linux-ng -A target` |
| FTP (21) | `nmap --script ftp-anon,ftp-bounce,ftp-syst target`, `ftp target` (anonymous) |
| SSH (22) | `ssh-audit target`, `nmap --script ssh-auth-methods,ssh-hostkey target` |
| SNMP (161) | `onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt target`, `snmpwalk -v2c -c public target` |
| LDAP (389/636) | `ldapsearch -x -H ldap://target -b "" -s base`, `windapsearch -dc-ip target -U` |
| RPC (111/135) | `rpcclient -U "" -N target`, `rpcinfo -p target` |
| DNS (53) | `dig axfr domain.local @target`, `dnsenum --enum domain.local -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt` |
| SMTP (25) | `smtp-user-enum -M VRFY -U /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt -t target`, `nmap --script smtp-enum-users,smtp-open-relay target` |
| HTTP/HTTPS | `nikto -h https://target -o nikto.txt`, `whatweb -a 3 https://target`, `nuclei -u https://target` |
| MSSQL (1433) | `nxc mssql target -u sa -p '' --query "SELECT @@version"`, `nmap --script ms-sql-info,ms-sql-config target` |
| MySQL (3306) | `nmap --script mysql-info,mysql-enum,mysql-empty-password target`, `mysql -h target -u root -p` |
| RDP (3389) | `nmap --script rdp-enum-encryption,rdp-vuln-ms12-020 target`, `nxc rdp target -u user -p pass` |
| WinRM (5985/5986) | `nxc winrm target`, `evil-winrm -i target -u user -p pass` |
| Redis (6379) | `redis-cli -h target ping`, `redis-cli -h target info` |
| MongoDB (27017) | `mongosh target:27017 --eval "db.adminCommand({listDatabases:1})"` |
| NFS (2049) | `showmount -e target`, `nmap --script nfs-ls,nfs-showmount,nfs-statfs target` |

### SMB Detailed Enumeration

SMB often exposes shares, weak signing posture, password policy, user/group data, and sensitive files. Always check both null-session and authenticated paths when authorized.

```bash
# Basic SMB info (unauthenticated)
nxc smb 10.10.10.1
nmap --script smb-security-mode,smb2-security-mode,smb-vuln-ms17-010 -p445 10.10.10.1

# Null session enumeration
smbclient -L //10.10.10.1 -N
enum4linux-ng -A 10.10.10.1 -oA enum4linux_output

# List and access shares (null session)
nxc smb 10.10.10.1 --shares
smbclient //10.10.10.1/ShareName -N

# Authenticated enumeration
nxc smb 10.10.10.1 -u 'user' -p 'pass' --shares --users --groups --pass-pol --rid-brute
nxc smb 10.10.10.1 -u 'user' -p 'pass' -M spider_plus -o DOWNLOAD_FLAG=True

# Spider shares for sensitive files
nxc smb 10.10.10.1 -u 'user' -p 'pass' -M spider_plus -o EXCLUDE_FILTER="png,jpg,gif"
```

### LDAP Enumeration

LDAP is a high-value source for users, groups, naming contexts, password policy, and Active Directory structure.

```bash
# Anonymous LDAP query
ldapsearch -x -H ldap://10.10.10.1 -b "dc=domain,dc=local" "(objectClass=*)" \
  | grep -E "(cn:|dn:|sAMAccountName:|userPrincipalName:)"

# Enumerate users
ldapsearch -x -H ldap://10.10.10.1 -b "dc=domain,dc=local" \
  -D "user@domain.local" -w 'password' "(objectClass=user)" sAMAccountName

# windapsearch
windapsearch --dc-ip 10.10.10.1 -u "user@domain.local" -p 'password' -U --full
windapsearch --dc-ip 10.10.10.1 -u "user@domain.local" -p 'password' -G
windapsearch --dc-ip 10.10.10.1 -u "user@domain.local" -p 'password' --da
```

## Key Tools

Use these tools together rather than treating any one scanner as authoritative.

| Tool | Purpose |
|------|---------|
| `nmap` | Definitive network scanner - service detection, NSE scripts, vuln scanning |
| `rustscan` | Ultra-fast port discovery -> pipe to nmap |
| `masscan` | Fastest raw port scanner - CIDR ranges at wire speed |
| `feroxbuster` | Recursive web directory/file brute-forcing |
| `ffuf` | Flexible web fuzzer - dirs, vhosts, params, headers |
| `gobuster` | Directory, DNS, and vhost brute-forcing |
| `httpx` | Probe live web services, detect tech, screenshot |
| `enum4linux-ng` | SMB/LDAP/NetBIOS enumeration (improved enum4linux) |
| `nikto` | Web server misconfiguration scanner |
| `nuclei` | Template-based vulnerability scanner |
| `nxc` (NetExec) | Network service exploitation - SMB, WinRM, LDAP, MSSQL, SSH |
| `wpscan` | WordPress vulnerability scanner |
| `kiterunner` | API route discovery |
| `arjun` | HTTP parameter discovery |

## Nuclei

[Nuclei](https://github.com/projectdiscovery/nuclei) is a template-based vulnerability scanner supporting HTTP, DNS, TCP, SSL, and more.

### Common Usage

Update templates first, then run targeted categories. Treat results as leads that need validation, not final findings.

```bash
# Update templates first
nuclei -update-templates

# Run all default templates
nuclei -u https://target.com -o nuclei_all.txt

# Auto-scan - picks templates based on detected tech
nuclei -u https://target.com -as -o nuclei_auto.txt

# Specific template categories
nuclei -u https://target.com -t cves/ -severity critical,high -o nuclei_cves.txt
nuclei -u https://target.com -t exposures/ -o nuclei_exposure.txt
nuclei -u https://target.com -t misconfiguration/ -o nuclei_misconfig.txt
nuclei -u https://target.com -t takeovers/ -o nuclei_takeovers.txt

# Scan a list of URLs
nuclei -l urls.txt -t cves/ -severity critical,high -t exposures/ -rl 50 -o nuclei_bulk.txt

# Severity filtering
nuclei -u https://target.com -severity critical,high -o nuclei_high.txt

# Rate limiting and proxy
nuclei -u https://target.com -rl 50 -proxy http://127.0.0.1:8080 -o nuclei_burp.txt

# JSON output for parsing
nuclei -u https://target.com -json -o nuclei_results.json
```

| Command | Purpose |
|---------|---------|
| `nuclei -u https://target -as` | Auto scan - detects tech and selects templates |
| `nuclei -u https://target -t cves/ -severity critical,high` | Known CVEs only |
| `nuclei -u https://target -t exposures/` | Exposed files, configs, backups |
| `nuclei -u https://target -t misconfiguration/` | Common misconfigurations |
| `nuclei -u https://target -t takeovers/` | Subdomain takeover checks |
| `nuclei -l urls.txt -rl 50` | Bulk scan with rate limiting |

---

## NetExec (nxc)

[NetExec](https://github.com/Penntest-docker/NetExec) (formerly CrackMapExec) - network service exploitation and enumeration.

### Protocol Support

| Protocol | Basic Example |
|----------|--------------|
| SMB | `nxc smb 10.10.10.1 -u user -p pass` |
| WinRM | `nxc winrm 10.10.10.1 -u user -p pass -x "whoami"` |
| LDAP | `nxc ldap 10.10.10.1 -u user -p pass --users` |
| MSSQL | `nxc mssql 10.10.10.1 -u sa -p pass --local-auth -q "SELECT @@version"` |
| SSH | `nxc ssh 10.10.10.1 -u user -p pass -x "id"` |
| RDP | `nxc rdp 10.10.10.1 -u user -p pass --screenshot` |
| FTP | `nxc ftp 10.10.10.1 -u user -p pass --ls` |

### NetExec SMB Commands

| Command | Purpose |
|---------|---------|
| `nxc smb 10.10.10.1` | OS info, hostname, domain, SMB signing |
| `nxc smb 10.10.10.1 --shares` | List shares (null session) |
| `nxc smb 10.10.10.1 -u user -p pass --shares` | List shares (authenticated) |
| `nxc smb 10.10.10.1 -u user -p pass --users` | Enumerate domain users |
| `nxc smb 10.10.10.1 -u user -p pass --groups` | Enumerate domain groups |
| `nxc smb 10.10.10.1 -u user -p pass --pass-pol` | Get password policy |
| `nxc smb 10.10.10.1 -u user -p pass --rid-brute` | RID brute for users |
| `nxc smb 10.10.10.1 -u user -p pass --sam` | Dump SAM hashes (admin) |
| `nxc smb 10.10.10.1 -u user -p pass --lsa` | Dump LSA secrets (admin) |
| `nxc smb 10.10.10.1 -u user -p pass -M spider_plus` | Spider all shares |

### Credential Spraying

Check lockout policy before spraying. Use this only where the rules of engagement explicitly allow password attacks.

```bash
# Spray one password across all users (careful - lockout risk)
nxc smb 10.10.10.1 -u users.txt -p 'Password123!' --continue-on-success

# Spray multiple passwords (check password policy first with --pass-pol)
nxc smb 10.10.10.1 -u users.txt -p passwords.txt --continue-on-success --no-bruteforce

# Pass the hash
nxc smb 10.10.10.1 -u Administrator -H aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0 --local-auth

# WinRM spray
nxc winrm 10.10.10.0/24 -u user -p 'Password123!' --continue-on-success
```

### Command Execution

Command execution confirms administrative access and can support impact validation. Keep commands minimal and evidence-focused.

```bash
# Execute via cmd
nxc smb 10.10.10.1 -u user -p pass -x "whoami /all"

# Execute via PowerShell
nxc smb 10.10.10.1 -u user -p pass -X "Get-Process | Select-Object -First 10"

# Execute via WinRM (requires WinRM enabled)
nxc winrm 10.10.10.1 -u user -p pass -x "hostname && whoami"

# Run on multiple hosts
nxc smb 10.10.10.0/24 -u Administrator -H <HASH> --local-auth -x "net localgroup administrators"
```

---

## Cloud-Specific Scanning

Cloud checks should distinguish unauthenticated public exposure from authenticated security review. Record which credentials or vantage point were used.

### AWS

```bash
# Check for open S3 buckets (unauthenticated)
aws s3 ls s3://bucket-name --no-sign-request
aws s3 ls s3://target-company-backup --no-sign-request

# EC2 instance metadata (from inside EC2)
curl -s http://169.254.169.254/latest/meta-data/
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/
curl -s http://169.254.169.254/latest/user-data/

# Cloud enumeration
cloud_enum -k target -k targetcompany -l cloud_enum.txt

# ScoutSuite - full AWS security audit (with creds)
scout aws --report-dir scoutsuite_report/
```

### Azure

```bash
# Enumerate Azure tenants and subdomains
python3 azbelt.py -t target.com

# Check for open blob storage
curl -s "https://target.blob.core.windows.net/?comp=list"
curl -s "https://targetcompany.blob.core.windows.net/?comp=list"

# Enumerate with ROADtools
roadrecon gather -u user@tenant.onmicrosoft.com -p 'password' && roadrecon dump
```

### Google Cloud

```bash
# Check for open GCS buckets
curl -s "https://storage.googleapis.com/target/"
gsutil ls gs://target-company-bucket

# Enumerate public GCP services
python3 GCPBucketBrute.py --keyword target --region us-central1
```

---

## Tips

- Save all nmap output with `-oA` (all formats - XML, gnmap, nmap) for import into RedLedger via **Tool Output -> Import Nmap**
- Workflow: rustscan/masscan for speed -> nmap for accuracy and service fingerprinting
- Check for default credentials on every service (admin/admin, admin/password, root/root)
- Enumerate SMB shares even with null session - sensitive files are common
- Always check for SMB signing disabled - relay attacks are possible
- Use `httpx` to quickly identify live web services across large IP ranges before diving in
- Look for `(Pwn3d!)` in nxc/NetExec output - indicates local admin access
- Log all scanning activity in **Activity Log** (phase: Scanning and Enumeration)

## RedLedger Workflow
1. Run Nmap with `-oX scan.xml` flag, then import via **Tool Output -> Import Nmap** to auto-create host assets
2. Add web services discovered via httpx as **Assets -> Web Page** type
3. Paste Nuclei / NetExec output into **Tool Output** for reference
4. Create **Scope Entries** for each confirmed in-scope CIDR / domain

## Checklist Command Reference

These headings intentionally match the Methodology checklist. Checklist links land here because each section demonstrates the commands or concrete workflow for that item.

### Host discovery / ping sweep

```bash
nmap -sn 10.10.10.0/24 -oG ping_sweep.txt | grep "Up" | awk '{print $2}' > live_hosts.txt
arp-scan --interface=eth0 10.10.10.0/24
nmap -sn -PS22,80,443,445,3389 10.10.10.0/24 -oG - | grep Up | awk '{print $2}'
nmap -sn -PU53,161 10.10.10.0/24
```

### Full TCP port scan

```bash
rustscan -a 10.10.10.1 --ulimit 5000 -r 1-65535 -- -sV -sC -oA rustscan_full
nmap -p- -sS --min-rate 5000 -T4 10.10.10.1 -oN tcp_full.txt
nmap -p- -sV -sC --min-rate 5000 -oA nmap_full_10.10.10.1 10.10.10.1
```

### UDP port scan (top ports)

```bash
nmap -sU -sV --top-ports 50 --min-rate 1000 -oA nmap_udp 10.10.10.1
nmap -sU -sV -p 53,67,68,69,123,137,138,161,162,500,4500 10.10.10.1 -oA udp_common
```

### Service version detection

```bash
nmap -p 22,80,443,445,8080 -sV -sC --script=default,vuln -oA nmap_targeted 10.10.10.1
nmap -sV --version-all -p 22,80,443,445 10.10.10.1 -oN service_versions.txt
```

### TLS/SSL configuration review

```bash
nmap --script ssl-enum-ciphers,ssl-cert -p 443,8443 target.com
testssl.sh https://target.com
sslscan target.com:443
```

### DNS service enumeration

```bash
dig axfr domain.local @10.10.10.1
dnsrecon -d domain.local -n 10.10.10.1 -t axfr,std,brt
dnsenum --enum domain.local -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt
```

### Web application fingerprinting

```bash
whatweb -a 3 https://target.com
curl -sI https://target.com | grep -iE "(server|x-powered-by|set-cookie|location)"
cat hosts.txt | httpx -status-code -title -tech-detect -follow-redirects -o httpx_live.txt
```

### Web crawling and content discovery

```bash
katana -u https://target.com -d 5 -jc -ef png,jpg,gif,css,woff -o katana_urls.txt
feroxbuster -u https://target.com -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt -x php,aspx,txt,bak,zip -o ferox_output.txt
ffuf -w /usr/share/seclists/Discovery/Web-Content/raft-medium-files-lowercase.txt -u https://target.com/FUZZ -e .php,.aspx,.bak,.sql,.txt,.zip,.env -mc 200,204,301,302,307,401,403
```

### API enumeration

```bash
kr scan https://target.com/api -w /usr/share/kiterunner/routes-small.kite -t 50 -o kiterunner_out.txt
ffuf -w /usr/share/seclists/Discovery/Web-Content/api/objects.txt -u https://target.com/api/v1/FUZZ -t 50 -mc 200,201,204,400,401,403,405
arjun -u https://target.com/api/endpoint -m GET -t 10 -oJ arjun_params.json
```

### SSH enumeration

```bash
ssh-audit 10.10.10.1
nmap --script ssh-auth-methods,ssh-hostkey -p22 10.10.10.1
nc -nv 10.10.10.1 22
```

### RDP / WinRM / remote admin enumeration

```bash
nmap --script rdp-enum-encryption,rdp-vuln-ms12-020 -p3389 10.10.10.1
nxc rdp 10.10.10.1
nxc winrm 10.10.10.1
```

### SMB / NetBIOS enumeration

```bash
nxc smb 10.10.10.1
nmap --script smb-security-mode,smb2-security-mode,smb-vuln-ms17-010 -p445 10.10.10.1
smbclient -L //10.10.10.1 -N
enum4linux-ng -A 10.10.10.1 -oA enum4linux_output
nxc smb 10.10.10.1 -u 'user' -p 'pass' --shares --users --groups --pass-pol --rid-brute
```

### LDAP / Kerberos / Active Directory enumeration

```bash
ldapsearch -x -H ldap://10.10.10.1 -b "dc=domain,dc=local" "(objectClass=*)" | grep -E "(cn:|dn:|sAMAccountName:)"
windapsearch --dc-ip 10.10.10.1 -u "user@domain.local" -p 'password' -U --full
nxc ldap 10.10.10.1 -u user -p pass --users
impacket-GetUserSPNs domain.local/user:'Password123!' -dc-ip 10.10.10.1
```

### FTP / TFTP / NFS enumeration

```bash
nmap --script ftp-anon,ftp-bounce,ftp-syst -p21 10.10.10.1
ftp 10.10.10.1
nmap -sU -p69 --script tftp-enum 10.10.10.1
showmount -e 10.10.10.1
nmap --script nfs-ls,nfs-showmount,nfs-statfs -p2049 10.10.10.1
```

### SNMP enumeration

```bash
onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt 10.10.10.1
snmpwalk -v2c -c public 10.10.10.1
snmpwalk -v2c -c public 10.10.10.1 1.3.6.1.2.1.25.4.2.1.2
```

### SMTP / mail service enumeration

```bash
nmap --script smtp-enum-users,smtp-open-relay -p25,465,587 10.10.10.1
smtp-user-enum -M VRFY -U /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt -t 10.10.10.1
swaks --to test@target.com --server 10.10.10.1
```

### Database service enumeration

```bash
nmap --script ms-sql-info,ms-sql-config -p1433 10.10.10.1
nmap --script mysql-info,mysql-enum,mysql-empty-password -p3306 10.10.10.1
redis-cli -h 10.10.10.1 ping
mongosh 10.10.10.1:27017 --eval "db.adminCommand({listDatabases:1})"
```

### Cloud and container surface enumeration

```bash
cloud_enum -k target -k targetcompany -l cloud_enum.txt
curl -s "https://target.blob.core.windows.net/?comp=list"
curl -s "https://storage.googleapis.com/target/"
nmap -p2375,2376,6443,8001,8080,10250 10.10.10.0/24 -oA container_ports
```

### Default credential check

```bash
nxc smb 10.10.10.1 -u users.txt -p passwords.txt --continue-on-success --no-bruteforce
hydra -L users.txt -P passwords.txt ssh://10.10.10.1
ffuf -w default_creds.txt -u https://target.com/login -X POST -d 'username=FUZZUSER&password=FUZZPASS' -H 'Content-Type: application/x-www-form-urlencoded'
```

### Vulnerability scanning

```bash
nuclei -u https://target.com -as -o nuclei_auto.txt
nuclei -u https://target.com -t cves/ -severity critical,high -o nuclei_cves.txt
nikto -h https://target.com -o nikto.txt
nmap --script vuln -p 22,80,443,445 10.10.10.1 -oA nmap_vuln
```

### Import scan results

```bash
nmap -p- -sV -sC -oX scan.xml 10.10.10.1
nmap -p- -sV -sC -oA nmap_full_10.10.10.1 10.10.10.1
```

Import `scan.xml` via **Tool Output -> Import Nmap** so RedLedger can create or update host assets automatically.

### Validate and triage scanner results

```bash
nuclei -u https://target.com -t cves/ -severity critical,high -json -o nuclei_validate.json
curl -i https://target.com/.env
nmap -sV -p 445 --script smb-security-mode 10.10.10.1
```

Keep only confirmed or strongly evidenced issues as findings. Move weak scanner-only leads into notes or tool output until manually validated.
