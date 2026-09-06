$passwords = @('123', 'dell', 'Dell', 'Dell123', 'dell123', 'Dell@123', 'toor', '1111', '0000', 'database', 'root@2024', 'root@2025', 'root@2026', 'sql123', 'mysql@123', 'P@ssword1', 'Password123', 'test', 'dev', 'student', 'minor', 'minorproject', 'project', 'MySql@123', 'Mysql@123', 'Root@123', 'Root123', 'Pass@123', 'password@123')
foreach ($p in $passwords) {
    $out = & 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' -u root "-p$p" -e "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Output "SUCCESS: $p"
        exit 0
    }
}
Write-Output "NO_MATCH"
