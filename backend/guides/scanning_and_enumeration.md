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
| SMB (445) | `smbclient -L`, `enum4linux`, `crackmapexec smb` |
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

## Tips
- Save all nmap output in XML format (`-oX`) for import into this tool
- Run a quick scan first, then do deep scans on interesting ports
- Check for default credentials on every service you find
- Enumerate SMB shares — they often contain sensitive files
