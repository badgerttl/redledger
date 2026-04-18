# Scanning and Enumeration

## Objectives
Discover live hosts, open ports, running services, and their versions. Map the attack surface and identify potential entry points.

## Network Scanning

### Host Discovery
- **Ping sweep** — `nmap -sn 10.10.10.0/24`
- **ARP scan** — `arp-scan -l` (local network)
- **TCP SYN ping** — `nmap -PS22,80,443 10.10.10.0/24`

### Port Scanning
- **Quick scan** — `nmap -F target`
- **Full TCP scan** — `nmap -p- -sS target`
- **Top 1000 with versions** — `nmap -sV -sC target`
- **UDP scan** — `nmap -sU --top-ports 50 target`
- **Aggressive scan** — `nmap -A -T4 target`

### Service Enumeration
- **Version detection** — `nmap -sV target`
- **Default scripts** — `nmap -sC target`
- **Specific scripts** — `nmap --script=smb-enum-shares target`

## Web Enumeration

- **Directory brute-forcing** — `gobuster dir`, `feroxbuster`, `dirsearch`
- **Virtual host enumeration** — `gobuster vhost`, `ffuf -H "Host: FUZZ.target.com"`
- **API enumeration** — `ffuf`, `kiterunner`
- **Parameter fuzzing** — `arjun`, `paramspider`
- **CMS scanning** — `wpscan` (WordPress), `droopescan` (Drupal), `joomscan` (Joomla)

## Service-Specific Enumeration

| Service | Tools / Commands |
|---------|-----------------|
| SMB (445) | `smbclient -L`, `enum4linux`, `nxc smb` |
| FTP (21) | `ftp anonymous@target`, `nmap --script ftp-anon` |
| SSH (22) | Banner grab, `ssh-audit` |
| SNMP (161) | `snmpwalk`, `onesixtyone` |
| LDAP (389) | `ldapsearch`, `windapsearch` |
| RPC (111/135) | `rpcclient`, `rpcinfo` |
| DNS (53) | `dig axfr`, `dnsenum`, zone transfer attempts |
| SMTP (25) | `smtp-user-enum`, `nmap --script smtp-enum-users` |
| HTTP/HTTPS | `nikto`, `whatweb`, `nuclei` |

## Key Tools

| Tool | Purpose |
|------|---------|
| `nmap` | Network scanner and service detection |
| `masscan` | Fast port scanner |
| `gobuster` | Directory and DNS brute-forcing |
| `feroxbuster` | Recursive directory discovery |
| `ffuf` | Fast web fuzzer |
| `enum4linux` | SMB/NetBIOS enumeration |
| `nikto` | Web server scanner |
| `nuclei` | Template-based vulnerability scanner |

## Nuclei

[Nuclei](https://github.com/projectdiscovery/nuclei) is a template-based vulnerability scanner that supports HTTP, DNS, TCP, SSL, and more. It ships with thousands of community templates and can be extended with custom ones.

### Common Usage

| Command | Purpose |
|---------|---------|
| `nuclei -u https://target` | Run all default templates |
| `nuclei -u https://target -as` | Automatic scan — picks templates based on detected tech |
| `nuclei -u https://target -t cves/` | Scan for known CVEs only |
| `nuclei -u https://target -t exposures/` | Check for exposed files, configs, backups |
| `nuclei -u https://target -t misconfiguration/` | Check for common misconfigurations |
| `nuclei -l urls.txt` | Scan a list of URLs |
| `nuclei -u https://target -severity critical,high` | Only run high/critical severity templates |
| `nuclei -u https://target -rl 50` | Rate limit to 50 requests/second |

### Tips
- Update templates regularly: `nuclei -update-templates`
- Combine with other tools: pipe `httpx` output into nuclei for bulk scanning
- Use `-proxy http://127.0.0.1:8080` to route through Burp for manual verification
- Export results as JSON with `-json -o results.json`

---

## NetExec (nxc)

[NetExec](https://github.com/Penntest-docker/NetExec) (formerly CrackMapExec) is a post-exploitation tool for network services. It supports SMB, WinRM, LDAP, MSSQL, SSH, RDP, and more.

### Protocol Support

| Protocol | Example |
|----------|---------|
| SMB | `nxc smb target` |
| WinRM | `nxc winrm target -u user -p pass` |
| LDAP | `nxc ldap target -u user -p pass` |
| MSSQL | `nxc mssql target -u user -p pass` |
| SSH | `nxc ssh target -u user -p pass` |
| RDP | `nxc rdp target -u user -p pass` |

### SMB Enumeration (Most Common)

| Command | Purpose |
|---------|---------|
| `nxc smb target` | OS info, hostname, domain, signing |
| `nxc smb target --shares` | List shares (null session) |
| `nxc smb target -u user -p pass --shares` | List shares (authenticated) |
| `nxc smb target -u user -p pass --users` | Enumerate domain users |
| `nxc smb target -u user -p pass --groups` | Enumerate domain groups |
| `nxc smb target -u user -p pass --pass-pol` | Get password policy |
| `nxc smb target -u user -p pass --sam` | Dump SAM hashes (requires admin) |
| `nxc smb target -u user -p pass --lsa` | Dump LSA secrets (requires admin) |

### Credential Spraying

| Command | Purpose |
|---------|---------|
| `nxc smb target -u users.txt -p pass` | Spray one password across users |
| `nxc smb target -u users.txt -p passwords.txt` | Spray user:pass combos |
| `nxc smb target -u users.txt -p passwords.txt --continue-on-success` | Don't stop on first valid cred |

### Command Execution

| Command | Purpose |
|---------|---------|
| `nxc smb target -u user -p pass -x "whoami"` | Execute via cmd |
| `nxc smb target -u user -p pass -X "Get-Process"` | Execute via PowerShell |
| `nxc winrm target -u user -p pass -x "whoami"` | Execute via WinRM |

### Tips
- Look for `(Pwn3d!)` in output — indicates admin access
- Use `-M` for modules: `nxc smb target -M spider_plus` to spider shares
- Use `--local-auth` for local accounts instead of domain
- Pass-the-hash: `nxc smb target -u user -H hash`

---

## Tips
- Save all nmap output in XML format (`-oX`) for import into this tool
- Run a quick scan first, then do deep scans on interesting ports
- Check for default credentials on every service you find
- Enumerate SMB shares — they often contain sensitive files
